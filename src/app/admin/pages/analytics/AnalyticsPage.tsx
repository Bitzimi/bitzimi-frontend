/**
 * Analytics & Reports Page — Phase 10
 *
 * Full date-range filtered analytics dashboard with charts and CSV export.
 * All data fetched from backend; frontend only renders what it receives.
 */
import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  TrendingUp, Users, DollarSign, Gamepad2, ClipboardList,
  BadgeCheck, Bell, Share2, Download, RefreshCw, Calendar,
} from "lucide-react";
import { adminAnalyticsService, type AnalyticsPreset } from "../../services/adminDataService";
import { useAdminAccess } from "../../hooks/useAdminAccess";

// ── Colour palette ────────────────────────────────────────────────────────────
const PALETTE = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#fb923c"];

// ── Preset config ─────────────────────────────────────────────────────────────
const PRESETS: { label: string; value: AnalyticsPreset | "custom" }[] = [
  { label: "Today",      value: "today" },
  { label: "Yesterday",  value: "yesterday" },
  { label: "Last 7 Days",  value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "This Month",   value: "this_month" },
  { label: "Last Month",   value: "last_month" },
  { label: "Custom",       value: "custom" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDay(s: string) {
  try { return format(parseISO(s), "MMM d"); } catch { return s; }
}

function fmtUSD(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => JSON.stringify(r[h] ?? "")).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-100 rounded w-full" />
      ))}
    </div>
  );
}

function SectionCard({ title, icon: Icon, onExport, children }: {
  title: string;
  icon: React.ElementType;
  onExport?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-500" />
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
        </div>
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        )}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ── Tab definitions ───────────────────────────────────────────────────────────
const TABS = [
  { id: "overview",      label: "Overview",      icon: TrendingUp },
  { id: "users",         label: "Users",         icon: Users },
  { id: "financial",     label: "Financial",     icon: DollarSign },
  { id: "revenue",       label: "Revenue",       icon: TrendingUp },
  { id: "games",         label: "Games",         icon: Gamepad2 },
  { id: "tasks",         label: "Tasks",         icon: ClipboardList },
  { id: "kyc",           label: "KYC",           icon: BadgeCheck },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "referrals",     label: "Referrals",     icon: Share2 },
] as const;

type TabId = typeof TABS[number]["id"];

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { can } = useAdminAccess();

  const [activeTab, setActiveTab]     = useState<TabId>("overview");
  const [preset, setPreset]           = useState<AnalyticsPreset | "custom">("30d");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState("");
  const [loading, setLoading]         = useState(false);
  const [data, setData]               = useState<Record<string, any>>({});

  const buildOpts = useCallback(() => {
    if (preset === "custom") {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    return { preset: preset as AnalyticsPreset };
  }, [preset, customFrom, customTo]);

  const fetchTab = useCallback(async (tab: TabId) => {
    setLoading(true);
    try {
      const opts = buildOpts();
      let result: any;
      switch (tab) {
        case "overview":      result = await adminAnalyticsService.fetchOverview(opts);      break;
        case "users":         result = await adminAnalyticsService.fetchUsers(opts);         break;
        case "financial":     result = await adminAnalyticsService.fetchFinancial(opts);     break;
        case "revenue":       result = await adminAnalyticsService.fetchRevenue(opts);       break;
        case "games":         result = await adminAnalyticsService.fetchGames(opts);         break;
        case "tasks":         result = await adminAnalyticsService.fetchTasks(opts);         break;
        case "kyc":           result = await adminAnalyticsService.fetchKyc(opts);           break;
        case "notifications": result = await adminAnalyticsService.fetchNotifications(opts); break;
        case "referrals":     result = await adminAnalyticsService.fetchReferrals(opts);     break;
      }
      setData(prev => ({ ...prev, [tab]: result }));
    } catch (e) {
      console.error("Analytics fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [buildOpts]);

  useEffect(() => {
    fetchTab(activeTab);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, preset, customFrom, customTo]);

  if (!can("admin.analytics.view")) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        You do not have permission to view analytics.
      </div>
    );
  }

  const tabData = data[activeTab] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Platform performance across all modules</p>
        </div>
        <button
          onClick={() => fetchTab(activeTab)}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Date Range Controls */}
      <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Date Range</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                preset === p.value
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-indigo-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap gap-3 mt-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">To</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-100 hover:bg-gray-50"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {loading && !tabData ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
              <LoadingSkeleton rows={6} />
            </div>
          ))}
        </div>
      ) : (
        <TabContent tab={activeTab} data={tabData} loading={loading} />
      )}
    </div>
  );
}

// ── Tab Content Router ────────────────────────────────────────────────────────

function TabContent({ tab, data, loading }: { tab: TabId; data: any; loading: boolean }) {
  if (!data && !loading) return (
    <div className="bg-white border border-gray-100 rounded-xl p-8 text-center text-gray-400 text-sm shadow-sm">
      No data available for this period.
    </div>
  );
  if (!data) return null;

  switch (tab) {
    case "overview":      return <OverviewTab data={data} />;
    case "users":         return <UsersTab data={data} />;
    case "financial":     return <FinancialTab data={data} />;
    case "revenue":       return <RevenueTab data={data} />;
    case "games":         return <GamesTab data={data} />;
    case "tasks":         return <TasksTab data={data} />;
    case "kyc":           return <KycTab data={data} />;
    case "notifications": return <NotificationsTab data={data} />;
    case "referrals":     return <ReferralsTab data={data} />;
    default: return null;
  }
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ data }: { data: any }) {
  const cards = [
    { label: "New Users",          value: data.users?.new ?? 0 },
    { label: "Deposits",           value: fmtUSD(data.financial?.deposits?.volumeUSD ?? 0), sub: `${data.financial?.deposits?.count ?? 0} transactions` },
    { label: "Withdrawals",        value: fmtUSD(data.financial?.withdrawals?.volumeUSD ?? 0), sub: `${data.financial?.withdrawals?.count ?? 0} requests` },
    { label: "Game Bets",          value: (data.games?.bets ?? 0).toLocaleString(), sub: fmtUSD(data.games?.wageredUSD ?? 0) + " wagered" },
    { label: "Game Revenue",       value: fmtUSD(data.games?.revenueUSD ?? 0) },
    { label: "Task Rewards Paid",  value: fmtUSD(data.tasks?.rewardsUSD ?? 0), sub: `${data.tasks?.proofsPaid ?? 0} proofs` },
    { label: "KYC Submissions",    value: data.kyc?.submissions ?? 0 },
    { label: "New Referrals",      value: data.referrals?.new ?? 0 },
    { label: "Notifications Sent", value: (data.notifications?.sent ?? 0).toLocaleString() },
    { label: "New VIP Subs",       value: data.vip?.newSubscriptions ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map(c => <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} />)}
      </div>
      <p className="text-xs text-gray-400 text-center">
        Period: {data.period?.from ? format(parseISO(data.period.from), "MMM d, yyyy") : "—"} –{" "}
        {data.period?.to ? format(parseISO(data.period.to), "MMM d, yyyy") : "—"}
      </p>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────

function UsersTab({ data }: { data: any }) {
  const registrations = (data.registrations ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));
  const totals = data.totals ?? {};
  const kycDist = data.kycDistribution ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Users"    value={totals.totalUsers?.toLocaleString() ?? 0} />
        <StatCard label="KYC Verified"   value={totals.verifiedUsers?.toLocaleString() ?? 0} />
        <StatCard label="Active VIP"     value={totals.vipUsers?.toLocaleString() ?? 0} />
        <StatCard label="Suspended"      value={totals.suspendedUsers?.toLocaleString() ?? 0} />
      </div>
      <SectionCard
        title="New Registrations"
        icon={Users}
        onExport={() => downloadCsv(data.registrations ?? [], "users-registrations.csv")}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={registrations}>
            <defs>
              <linearGradient id="ugr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#ugr)" name="New Users" />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>
      {kycDist.length > 0 && (
        <SectionCard title="KYC Status Distribution (All-Time)" icon={BadgeCheck}>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={kycDist} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}>
                {kycDist.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </SectionCard>
      )}
    </div>
  );
}

// ── Financial Tab ─────────────────────────────────────────────────────────────

function FinancialTab({ data }: { data: any }) {
  const deposits    = (data.deposits ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));
  const withdrawals = (data.withdrawals ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));

  const combined = deposits.map((d: any, i: number) => ({
    day: d.day,
    deposits:    d.value ?? 0,
    withdrawals: withdrawals[i]?.value ?? 0,
  }));

  return (
    <div className="space-y-4">
      <SectionCard
        title="Deposit & Withdrawal Volume (USD)"
        icon={DollarSign}
        onExport={() => downloadCsv(combined, "financial-volume.csv")}
      >
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={combined}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v: number) => fmtUSD(v)} />
            <Legend />
            <Bar dataKey="deposits"    fill="#10b981" name="Deposits"    radius={[3,3,0,0]} />
            <Bar dataKey="withdrawals" fill="#f43f5e" name="Withdrawals" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {data.depositsByStatus?.length > 0 && (
          <SectionCard title="Deposits by Status" icon={DollarSign}>
            <div className="space-y-2">
              {(data.depositsByStatus as any[]).map((r: any) => (
                <div key={r.status} className="flex justify-between text-sm">
                  <span className="text-gray-600 capitalize">{r.status}</span>
                  <span className="font-medium text-gray-900">{r.count}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {data.depositsByMethod?.length > 0 && (
          <SectionCard title="Deposits by Method" icon={DollarSign}>
            <div className="space-y-2">
              {(data.depositsByMethod as any[]).map((r: any) => (
                <div key={r.method} className="flex justify-between text-sm">
                  <span className="text-gray-600 capitalize">{r.method?.replace("_", " ") ?? "Unknown"}</span>
                  <span className="font-medium text-gray-900">{r.count} · {fmtUSD(r.volumeUSD)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ── Revenue Tab ───────────────────────────────────────────────────────────────

function RevenueTab({ data }: { data: any }) {
  const rows = (data.netRevenue ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));
  const totals = data.totals ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Game Fees"        value={fmtUSD(totals.gameFees ?? 0)} />
        <StatCard label="VIP Revenue"      value={fmtUSD(totals.vipRevenue ?? 0)} />
        <StatCard label="Affiliate Costs"  value={fmtUSD(totals.affiliateCosts ?? 0)} />
        <StatCard label="Net Revenue"      value={fmtUSD(totals.net ?? 0)} />
      </div>
      <SectionCard
        title="Daily Revenue Breakdown (USD)"
        icon={TrendingUp}
        onExport={() => downloadCsv(data.netRevenue ?? [], "revenue-breakdown.csv")}
      >
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="feegr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="vipgr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v: number) => fmtUSD(v)} />
            <Legend />
            <Area type="monotone" dataKey="gameFees"       stroke="#6366f1" fill="url(#feegr)" name="Game Fees" />
            <Area type="monotone" dataKey="vipRevenue"     stroke="#f59e0b" fill="url(#vipgr)" name="VIP Revenue" />
            <Area type="monotone" dataKey="affiliateCosts" stroke="#f43f5e" fill="none" name="Affiliate Costs" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>
    </div>
  );
}

// ── Games Tab ─────────────────────────────────────────────────────────────────

function GamesTab({ data }: { data: any }) {
  const rows    = (data.combined ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));
  const totals  = data.totals ?? {};
  const byType  = data.byGameType ?? [];
  const outcomes = data.outcomes ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Bets"    value={totals.bets?.toLocaleString() ?? 0} />
        <StatCard label="Total Wagered" value={fmtUSD(totals.wagered ?? 0)} />
        <StatCard label="Total Paid Out" value={fmtUSD(totals.paid ?? 0)} />
        <StatCard label="Platform Revenue" value={fmtUSD(totals.revenue ?? 0)} />
      </div>

      <SectionCard
        title="Daily Bets & Wagered Volume"
        icon={Gamepad2}
        onExport={() => downloadCsv(data.combined ?? [], "games-daily.csv")}
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="bets" orientation="left"  tick={{ fontSize: 11 }} />
            <YAxis yAxisId="vol"  orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v: number, name: string) => name === "Wagered" ? fmtUSD(v) : v} />
            <Legend />
            <Bar yAxisId="bets" dataKey="bets"    fill="#6366f1" name="Bets"    radius={[3,3,0,0]} />
            <Bar yAxisId="vol"  dataKey="wagered" fill="#22d3ee" name="Wagered" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {byType.length > 0 && (
          <SectionCard title="Rounds by Game Type" icon={Gamepad2}>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={byType} dataKey="rounds" nameKey="gameType" cx="50%" cy="50%" outerRadius={70} label={({ gameType, percent }) => `${gameType} ${(percent * 100).toFixed(0)}%`}>
                  {byType.map((_: any, i: number) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </SectionCard>
        )}
        <SectionCard title="Bet Outcomes" icon={Gamepad2}>
          <div className="space-y-3 pt-2">
            {[
              { label: "Wins",   value: outcomes.wins ?? 0,   color: "bg-emerald-500" },
              { label: "Losses", value: outcomes.losses ?? 0, color: "bg-rose-500" },
              { label: "Draws",  value: outcomes.draws ?? 0,  color: "bg-amber-400" },
            ].map(o => {
              const total = (outcomes.wins ?? 0) + (outcomes.losses ?? 0) + (outcomes.draws ?? 0);
              const pct   = total > 0 ? Math.round((o.value / total) * 100) : 0;
              return (
                <div key={o.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{o.label}</span>
                    <span className="font-medium">{o.value.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${o.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Tasks Tab ─────────────────────────────────────────────────────────────────

function TasksTab({ data }: { data: any }) {
  const rows   = (data.combined ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));
  const totals = data.totals ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Proofs Submitted" value={totals.proofs ?? 0} />
        <StatCard label="Approved"         value={totals.approved ?? 0} />
        <StatCard label="Rewards Paid"     value={fmtUSD(totals.rewardsPaid ?? 0)} />
        <StatCard label="Tasks Created"    value={totals.tasksCreated ?? 0} />
      </div>
      <SectionCard
        title="Daily Task Activity"
        icon={ClipboardList}
        onExport={() => downloadCsv(data.combined ?? [], "tasks-daily.csv")}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="pgr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="proofs"  orientation="left"  tick={{ fontSize: 11 }} />
            <YAxis yAxisId="rewards" orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v: number, name: string) => name === "Rewards" ? fmtUSD(v) : v} />
            <Legend />
            <Area yAxisId="proofs"  type="monotone" dataKey="proofs"       stroke="#10b981" fill="url(#pgr)" name="Proofs" />
            <Area yAxisId="rewards" type="monotone" dataKey="rewards"      stroke="#6366f1" fill="none"      name="Rewards" />
            <Area yAxisId="proofs"  type="monotone" dataKey="tasksCreated" stroke="#f59e0b" fill="none"      name="New Tasks" strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>

      {data.proofsByStatus?.length > 0 && (
        <SectionCard title="Proofs by Status" icon={ClipboardList}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(data.proofsByStatus as any[]).map((r: any) => (
              <div key={r.status} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500 capitalize">{r.status.replace("_", " ")}</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{r.count}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── KYC Tab ───────────────────────────────────────────────────────────────────

function KycTab({ data }: { data: any }) {
  const rows   = (data.combined ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));
  const totals = data.totals ?? {};
  const dist   = data.statusDistribution ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Submitted" value={totals.submitted ?? 0} />
        <StatCard label="Verified"  value={totals.verified ?? 0} />
        <StatCard label="Rejected"  value={totals.rejected ?? 0} />
        <StatCard label="Pending"   value={totals.pending ?? 0} />
      </div>
      <SectionCard
        title="KYC Submissions & Reviews"
        icon={BadgeCheck}
        onExport={() => downloadCsv(data.combined ?? [], "kyc-daily.csv")}
      >
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="submitted" fill="#6366f1" name="Submitted" radius={[3,3,0,0]} />
            <Bar dataKey="reviewed"  fill="#22d3ee" name="Reviewed"  radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </SectionCard>
      {dist.length > 0 && (
        <SectionCard title="All-Time KYC Status" icon={BadgeCheck}>
          <div className="flex flex-wrap gap-3 justify-center">
            {(dist as any[]).map((r: any, i: number) => (
              <div key={r.status} className="text-center">
                <div className="w-3 h-3 rounded-full mx-auto mb-1" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                <p className="text-xs text-gray-500 capitalize">{r.status}</p>
                <p className="font-bold text-gray-900">{r.count}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Notifications Tab ─────────────────────────────────────────────────────────

function NotificationsTab({ data }: { data: any }) {
  const rows   = (data.combined ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));
  const totals = data.totals ?? {};
  const byType = data.byType ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Sent"   value={(totals.sent ?? 0).toLocaleString()} />
        <StatCard label="Read"   value={(totals.read ?? 0).toLocaleString()} />
        <StatCard label="Unread" value={(totals.unread ?? 0).toLocaleString()} />
      </div>
      <SectionCard
        title="Daily Notifications"
        icon={Bell}
        onExport={() => downloadCsv(data.combined ?? [], "notifications-daily.csv")}
      >
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="ngr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="sent" stroke="#a78bfa" fill="url(#ngr)" name="Sent" />
            <Area type="monotone" dataKey="read" stroke="#10b981" fill="none"      name="Read" />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>
      {byType.length > 0 && (
        <SectionCard title="By Notification Type" icon={Bell}>
          <div className="space-y-2">
            {(byType as any[]).slice(0, 10).map((r: any, i: number) => (
              <div key={r.type} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                <span className="text-sm text-gray-600 flex-1 capitalize">{r.type?.replace(/_/g, " ")}</span>
                <span className="text-sm font-medium text-gray-900">{r.count}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Referrals Tab ─────────────────────────────────────────────────────────────

function ReferralsTab({ data }: { data: any }) {
  const rows     = (data.combined ?? []).map((r: any) => ({ ...r, day: fmtDay(r.day) }));
  const totals   = data.totals ?? {};
  const byTier   = data.byTier ?? [];
  const byEvent  = data.byEventType ?? [];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Referrals"   value={totals.referrals ?? 0} />
        <StatCard label="Active"            value={totals.active ?? 0} />
        <StatCard label="Rewarded"          value={totals.rewarded ?? 0} />
        <StatCard label="Commissions Paid"  value={fmtUSD(totals.commissionsUSD ?? 0)} />
      </div>
      <SectionCard
        title="Daily Referrals & Commissions"
        icon={Share2}
        onExport={() => downloadCsv(data.combined ?? [], "referrals-daily.csv")}
      >
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={rows}>
            <defs>
              <linearGradient id="rgr" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fb923c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="refs"  orientation="left"  tick={{ fontSize: 11 }} />
            <YAxis yAxisId="comm"  orientation="right" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v: number, name: string) => name === "Commissions" ? fmtUSD(v) : v} />
            <Legend />
            <Area yAxisId="refs" type="monotone" dataKey="referrals"   stroke="#fb923c" fill="url(#rgr)" name="New Referrals" />
            <Area yAxisId="comm" type="monotone" dataKey="commissions" stroke="#6366f1" fill="none"      name="Commissions" />
          </AreaChart>
        </ResponsiveContainer>
      </SectionCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {byTier.length > 0 && (
          <SectionCard title="Commissions by Tier" icon={Share2}>
            <div className="space-y-2">
              {(byTier as any[]).sort((a: any, b: any) => a.tier - b.tier).map((r: any) => (
                <div key={r.tier} className="flex justify-between text-sm">
                  <span className="text-gray-600">Tier {r.tier}</span>
                  <span className="font-medium text-gray-900">{fmtUSD(r.total)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
        {byEvent.length > 0 && (
          <SectionCard title="By Event Type" icon={Share2}>
            <div className="space-y-2">
              {(byEvent as any[]).map((r: any) => (
                <div key={r.eventType} className="flex justify-between text-sm">
                  <span className="text-gray-600 capitalize">{r.eventType?.replace(/_/g, " ")}</span>
                  <span className="font-medium text-gray-900">{fmtUSD(r.total)}</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}

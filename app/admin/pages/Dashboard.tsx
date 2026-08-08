/**
 * Admin Dashboard — Phase 2: Dashboard & Monitoring
 *
 * All data comes from backend APIs only. No hardcoded operational values.
 * Sections: KPI overview (2 rows), quick access, recent activity,
 * platform health, action queue, revenue summary, game stats.
 */

import { useNavigate } from "react-router";
import { useEffect, useState, useCallback } from "react";
import {
  adminStatsService,
  type AdminStats,
  type ActivityItem,
  type HealthStatus,
  EMPTY_STATS,
} from "../services/adminDataService";
import {
  Users, ShieldCheck, ArrowUpFromLine, ClipboardCheck,
  FileCheck, Gamepad2, Crown, Activity, ChevronRight,
  CheckCircle2, ArrowDownToLine, Share2, TrendingUp,
  Database, Cpu, Clock, RefreshCw, DollarSign, Zap,
  AlertTriangle, CircleDot, Server, BarChart3,
} from "lucide-react";
import { StatCard }   from "../components/ui/StatCard";
import { PageHeader } from "../components/ui/PageHeader";
import { SectionCard } from "../components/ui/SectionCard";
import { EmptyState }  from "../components/ui/EmptyState";
import { useAdminAccess } from "../hooks/useAdminAccess";
import { useIdentity }    from "../../contexts/IdentityContext";

// ─── Quick-access module links ───────────────────────────────────────────────

const QUICK_LINKS = [
  { label: "Users",          description: "Manage accounts, tiers, limits",  path: "/admin/users",                  icon: Users,          iconBg: "bg-indigo-500/10", iconColor: "text-indigo-400" },
  { label: "KYC Review",     description: "Identity verification queue",     path: "/admin/kyc",                    icon: ShieldCheck,    iconBg: "bg-sky-500/10",    iconColor: "text-sky-400" },
  { label: "Withdrawals",    description: "Process pending payouts",         path: "/admin/financial/withdrawals",  icon: ArrowUpFromLine,iconBg: "bg-amber-500/10",  iconColor: "text-amber-400" },
  { label: "Deposits",       description: "Monitor incoming deposits",       path: "/admin/financial/deposits",     icon: ArrowDownToLine,iconBg: "bg-emerald-500/10",iconColor: "text-emerald-400" },
  { label: "Task Approval",  description: "Approve task campaigns",          path: "/admin/tasks/pending",          icon: ClipboardCheck, iconBg: "bg-violet-500/10", iconColor: "text-violet-400" },
  { label: "Proof Review",   description: "AI-flagged task proofs",          path: "/admin/tasks/proofs",           icon: FileCheck,      iconBg: "bg-rose-500/10",   iconColor: "text-rose-400" },
  { label: "Games",          description: "Monitor active lobbies",          path: "/admin/games",                  icon: Gamepad2,       iconBg: "bg-pink-500/10",   iconColor: "text-pink-400" },
  { label: "VIP Members",    description: "Subscription management",         path: "/admin/vip",                    icon: Crown,          iconBg: "bg-yellow-500/10", iconColor: "text-yellow-400" },
] as const;

// ─── Activity type label mapping ──────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  deposit:              "Deposit confirmed",
  withdrawal:           "Withdrawal submitted",
  transfer:             "Wallet transfer",
  game_win:             "Game win",
  game_loss:            "Game played",
  game_bet:             "Game bet placed",
  task_reward:          "Task reward earned",
  referral_bonus:       "Referral bonus",
  referral_earned:      "Referral bonus",
  vip_purchase:         "VIP upgrade",
  affiliate_commission: "Affiliate commission",
  commission:           "Affiliate commission",
  streak_reward:        "Daily streak claimed",
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400)return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

// ─── Game type display names ──────────────────────────────────────────────────

const GAME_LABELS: Record<string, string> = {
  color_game:   "Color Game",
  spin_battle:  "Spin Battle",
  dice_duel:    "Dice Duel",
  dice_royale:  "Dice Royale",
  dice_arena:   "Dice Arena",
  reaction_tap: "Reaction Tap",
  pvp_coinflip: "Coin Flip",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const { can }  = useAdminAccess();
  const { identity } = useIdentity();

  const [stats,        setStats]        = useState<AdminStats>(EMPTY_STATS);
  const [activity,     setActivity]     = useState<ActivityItem[]>([]);
  const [health,       setHealth]       = useState<HealthStatus | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [actLoading,   setActLoading]   = useState(true);
  const [healthLoading,setHealthLoading]= useState(true);
  const [lastRefreshed,setLastRefreshed]= useState<Date | null>(null);

  const loadAll = useCallback(async () => {
    setStatsLoading(true);
    setActLoading(true);
    setHealthLoading(true);

    const [s, a, h] = await Promise.all([
      adminStatsService.fetchSummary(),
      adminStatsService.fetchRecentActivity(8),
      adminStatsService.fetchHealth(),
    ]);

    setStats(s);        setStatsLoading(false);
    setActivity(a);     setActLoading(false);
    setHealth(h);       setHealthLoading(false);
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => {
    if (identity.userId) loadAll();
  }, [identity.userId, loadAll]);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title={`${greeting}, ${identity.username || "Admin"}`}
          description="Platform overview and operational status."
        />
        <button
          onClick={loadAll}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-all"
        >
          <RefreshCw className="w-3 h-3" />
          {lastRefreshed ? `Updated ${timeAgo(lastRefreshed.toISOString())}` : "Refresh"}
        </button>
      </div>

      {/* ── Row 1: Primary KPI cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          subtitle={`${stats.verifiedUsers} verified · ${stats.vipUsers} VIP`}
          icon={Users}
          iconColor="text-indigo-400"
          iconBg="bg-indigo-500/10"
          loading={statsLoading}
          onClick={can("admin.users.view") ? () => navigate("/admin/users") : undefined}
          trend={stats.newUsersThisWeek > 0 ? { direction: "up", value: `+${stats.newUsersThisWeek}`, label: "this week" } : undefined}
        />
        <StatCard
          title="Pending Withdrawals"
          value={stats.pendingWithdrawals}
          subtitle={`${stats.pendingDeposits} deposits · ${fmtUSD(stats.totalWithdrawalVolume)} total vol.`}
          icon={ArrowUpFromLine}
          iconColor="text-amber-400"
          iconBg="bg-amber-500/10"
          loading={statsLoading}
          onClick={can("admin.financial.process_withdrawals") ? () => navigate("/admin/financial/withdrawals") : undefined}
          trend={stats.pendingWithdrawals > 0 ? { direction: "up", value: `${stats.pendingWithdrawals}`, label: "need action" } : undefined}
        />
        <StatCard
          title="Tasks Pending"
          value={stats.pendingTasks}
          subtitle={`${stats.activeTasks} active · ${stats.completedTasks} completed`}
          icon={ClipboardCheck}
          iconColor="text-violet-400"
          iconBg="bg-violet-500/10"
          loading={statsLoading}
          onClick={can("admin.tasks.approve") ? () => navigate("/admin/tasks/pending") : undefined}
          trend={stats.pendingTasks > 0 ? { direction: "up", value: `${stats.pendingTasks}`, label: "to review" } : undefined}
        />
        <StatCard
          title="Proof Review Queue"
          value={stats.proofReviewQueue}
          subtitle={`AI confidence 70–84% · ${stats.totalProofsApproved} approved total`}
          icon={FileCheck}
          iconColor="text-rose-400"
          iconBg="bg-rose-500/10"
          loading={statsLoading}
          onClick={can("admin.tasks.proofs.view") ? () => navigate("/admin/tasks/proofs") : undefined}
          trend={stats.proofReviewQueue > 0 ? { direction: "up", value: `${stats.proofReviewQueue}`, label: "awaiting" } : undefined}
        />
      </div>

      {/* ── Row 2: Revenue + game KPI cards ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Game Fee Revenue"
          value={fmtUSD(stats.gameFeeRevenue)}
          subtitle={`${stats.totalBets.toLocaleString()} bets · ${fmtUSD(stats.totalWagered)} wagered`}
          icon={DollarSign}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
          loading={statsLoading}
        />
        <StatCard
          title="Active Game Rounds"
          value={stats.activeGameRounds}
          subtitle={`${fmtUSD(stats.totalPaidOut)} paid out total`}
          icon={Gamepad2}
          iconColor="text-pink-400"
          iconBg="bg-pink-500/10"
          loading={statsLoading}
          onClick={can("admin.games.view") ? () => navigate("/admin/games") : undefined}
        />
        <StatCard
          title="Task Rewards Paid"
          value={fmtUSD(stats.taskRewardsPaidUSD)}
          subtitle={`${stats.totalProofsApproved.toLocaleString()} proofs approved`}
          icon={Zap}
          iconColor="text-yellow-400"
          iconBg="bg-yellow-500/10"
          loading={statsLoading}
        />
        <StatCard
          title="Affiliate Commissions"
          value={fmtUSD(stats.affiliateCommsTotal)}
          subtitle={`${stats.affiliateCommsCount.toLocaleString()} payments · ${stats.totalReferrals} referrals`}
          icon={Share2}
          iconColor="text-teal-400"
          iconBg="bg-teal-500/10"
          loading={statsLoading}
          onClick={can("admin.referrals.view") ? () => navigate("/admin/referrals") : undefined}
        />
      </div>

      {/* ── Row 3: Quick access + Recent activity ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Quick links — 2/3 */}
        <div className="lg:col-span-2">
          <SectionCard title="Quick Access" description="Direct links to all operational modules">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {QUICK_LINKS.map(link => {
                const Icon = link.icon;
                return (
                  <button
                    key={link.path}
                    onClick={() => navigate(link.path)}
                    className="flex items-center gap-3.5 rounded-xl border border-white/[0.05] bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-white/[0.09] px-4 py-3.5 text-left transition-all duration-150 group"
                  >
                    <div className={`w-9 h-9 rounded-xl ${link.iconBg} flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform`}>
                      <Icon className={`w-4 h-4 ${link.iconColor}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{link.label}</p>
                      <p className="text-xs text-zinc-500 truncate">{link.description}</p>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 flex-shrink-0 transition-colors" />
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>

        {/* Recent Activity — 1/3 */}
        <div>
          <SectionCard
            title="Recent Activity"
            description="Latest platform transactions"
            actions={
              <button
                onClick={() => navigate("/admin/audit-log")}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
              >
                View all
              </button>
            }
          >
            {actLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 py-1">
                    <div className="w-7 h-7 rounded-full bg-zinc-800 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-zinc-800 rounded animate-pulse w-3/4" />
                      <div className="h-2.5 bg-zinc-800 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity.length === 0 ? (
              <EmptyState icon={Activity} title="No activity yet" description="Platform transactions will appear here." />
            ) : (
              <div className="space-y-1">
                {activity.map(item => (
                  <div key={item.id} className="flex items-center gap-3 py-1.5 rounded-lg hover:bg-zinc-900/50 px-2 -mx-2 transition-colors">
                    <span className="text-lg leading-none flex-shrink-0 w-7 text-center">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-300 truncate">
                        <span className="text-zinc-400">{item.username}</span>
                        {" · "}
                        {ACTIVITY_LABELS[item.type] ?? item.type.replace(/_/g, " ")}
                      </p>
                      <p className="text-[11px] text-zinc-600">{timeAgo(item.createdAt)}</p>
                    </div>
                    {item.amount > 0 && (
                      <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">${item.amount.toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Row 4: Platform health + Action required ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Platform health */}
        <SectionCard title="Platform Health" description="System status and queue depths">
          {healthLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-zinc-800 rounded-lg animate-pulse" />)}
            </div>
          ) : !health ? (
            <EmptyState icon={Server} title="Health check unavailable" description="Backend health endpoint unreachable." />
          ) : (
            <div className="space-y-3">
              {/* Database */}
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">Database</p>
                    <p className="text-xs text-zinc-500">{health.database.latencyMs}ms latency</p>
                  </div>
                </div>
                <StatusPill status={health.database.status} />
              </div>

              {/* Queue depths */}
              <div className="rounded-xl bg-zinc-900/50 border border-white/[0.04] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2.5">Queue Depths</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Withdrawals",  value: health.queues.pendingWithdrawals, warn: health.queues.pendingWithdrawals > 10 },
                    { label: "Deposits",     value: health.queues.pendingDeposits,    warn: health.queues.pendingDeposits > 20 },
                    { label: "KYC Queue",    value: health.queues.pendingKyc,         warn: health.queues.pendingKyc > 20 },
                    { label: "Proof Review", value: health.queues.pendingProofs,      warn: health.queues.pendingProofs > 15 },
                    { label: "Task Approval",value: health.queues.pendingTasks,       warn: health.queues.pendingTasks > 10 },
                    { label: "Active Games", value: health.queues.activeGameRounds,   warn: false },
                  ].map(q => (
                    <div key={q.label} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500">{q.label}</span>
                      <span className={`text-xs font-semibold tabular-nums ${q.warn ? "text-amber-400" : "text-zinc-300"}`}>
                        {q.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Background jobs */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600 mb-2">Background Jobs</p>
                <div className="space-y-1.5">
                  {health.backgroundJobs.map(job => (
                    <div key={job.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Cpu className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                        <span className="text-xs text-zinc-400 truncate">{job.name}</span>
                      </div>
                      <StatusPill status={job.status} compact />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Action required */}
        <SectionCard title="Action Required" description="Items needing admin attention">
          <div className="space-y-1">
            {([
              { icon: ShieldCheck,    label: "KYC Verifications",     count: stats.pendingKyc,         path: "/admin/kyc",                   permission: "admin.kyc.view" as const },
              { icon: ClipboardCheck, label: "Task Approvals",         count: stats.pendingTasks,       path: "/admin/tasks/pending",          permission: "admin.tasks.approve" as const },
              { icon: FileCheck,      label: "Proof Review",           count: stats.proofReviewQueue,   path: "/admin/tasks/proofs",           permission: "admin.tasks.proofs.view" as const },
              { icon: ArrowUpFromLine,label: "Withdrawals",            count: stats.pendingWithdrawals, path: "/admin/financial/withdrawals",  permission: "admin.financial.process_withdrawals" as const },
              { icon: ArrowDownToLine,label: "Deposits",               count: stats.pendingDeposits,    path: "/admin/financial/deposits",     permission: "admin.financial.confirm_deposits" as const },
              { icon: Share2,         label: "Affiliate Applications", count: 0,                        path: "/admin/referrals",              permission: "admin.affiliates.approve" as const },
            ] as const).filter(item => can(item.permission)).map(item => {
              const Icon = item.icon;
              const hasAction = item.count > 0;
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl hover:bg-zinc-900/60 border border-transparent hover:border-white/[0.05] transition-all group text-left"
                >
                  <Icon className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 flex-shrink-0 transition-colors" />
                  <p className="flex-1 text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{item.label}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {statsLoading ? (
                      <div className="w-8 h-4 bg-zinc-800 rounded animate-pulse" />
                    ) : hasAction ? (
                      <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                        {item.count}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">—</span>
                    )}
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                  </div>
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* ── Row 5: Revenue breakdown + Game type breakdown ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Revenue summary */}
        <SectionCard title="Revenue Summary" description="Platform income breakdown">
          {statsLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-8 bg-zinc-800 rounded animate-pulse" />)}</div>
          ) : (
            <div className="space-y-1">
              {[
                { label: "Game Fee Revenue",       value: stats.revenueGameFees,       color: "text-emerald-400", description: "10% platform fee on all games" },
                { label: "VIP Subscriptions",      value: stats.revenueVipSubs,        color: "text-yellow-400",  description: "Active VIP subscription revenue" },
                { label: "Affiliate Commissions",  value: -stats.revenueAffiliateComms,color: "text-rose-400",    description: "Paid to affiliate network (cost)" },
                { label: "Task Rewards Paid",      value: -stats.taskRewardsPaidUSD,   color: "text-violet-400",  description: "Paid to task completers (cost)" },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-900/40 transition-colors">
                  <div>
                    <p className="text-sm text-zinc-300">{r.label}</p>
                    <p className="text-[11px] text-zinc-600">{r.description}</p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${r.color}`}>
                    {r.value >= 0 ? "+" : ""}{fmtUSD(Math.abs(r.value))}
                  </span>
                </div>
              ))}
              <div className="border-t border-white/[0.06] mt-2 pt-2 flex items-center justify-between px-3">
                <span className="text-sm font-semibold text-zinc-200">Net Game Revenue</span>
                <span className={`text-sm font-bold tabular-nums ${stats.netGameRevenue >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {fmtUSD(stats.netGameRevenue)}
                </span>
              </div>
            </div>
          )}
        </SectionCard>

        {/* Game type breakdown */}
        <SectionCard title="Game Activity" description="Completed rounds by game type">
          {statsLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-7 bg-zinc-800 rounded animate-pulse" />)}</div>
          ) : stats.gameTypeBreakdown.length === 0 ? (
            <EmptyState icon={BarChart3} title="No game data" description="Game activity will appear here once rounds are completed." />
          ) : (
            <div className="space-y-2">
              {stats.gameTypeBreakdown.map((g, i) => {
                const maxRounds = stats.gameTypeBreakdown[0]?.rounds ?? 1;
                const pct = Math.round((g.rounds / maxRounds) * 100);
                return (
                  <div key={g.gameType}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400">{GAME_LABELS[g.gameType] ?? g.gameType}</span>
                      <span className="text-xs font-semibold text-zinc-300 tabular-nums">{g.rounds.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-xs text-zinc-500">
                <span>Total active rounds</span>
                <span className="font-semibold text-zinc-300">{stats.activeGameRounds}</span>
              </div>
            </div>
          )}
        </SectionCard>
      </div>

    </div>
  );
}

// ─── Status pill helper component ─────────────────────────────────────────────

function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) {
  const cfg: Record<string, { bg: string; text: string; dot: string; label: string }> = {
    operational: { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", label: "Operational" },
    running:     { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400", label: "Running" },
    disabled:    { bg: "bg-zinc-500/10",    text: "text-zinc-500",    dot: "bg-zinc-500",    label: "Disabled" },
    error:       { bg: "bg-red-500/10",     text: "text-red-400",     dot: "bg-red-400",     label: "Error" },
    degraded:    { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400",   label: "Degraded" },
  };
  const c = cfg[status] ?? cfg.disabled;
  if (compact) {
    return (
      <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${c.bg}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        <span className={`text-[10px] font-semibold ${c.text}`}>{c.label}</span>
      </div>
    );
  }
  return (
    <span className={`text-[11px] font-medium ${c.text} ${c.bg} border border-current/20 px-2 py-0.5 rounded-full flex-shrink-0`}>
      {c.label}
    </span>
  );
}

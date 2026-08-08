/**
 * Admin VIP Management Page
 *
 * Tabs:
 *   1. Overview       — subscription stats, revenue, streak metrics
 *   2. Members        — paginated VIP member list with search/filter + detail/manage drawer
 *   3. Access Control — platform feature access levels (VIP early access, feature flags)
 *   4. Config         — VIP pricing and streak configuration
 *
 * All data sourced exclusively from backend APIs. No financial calculations in frontend.
 * Management actions (cancel subscription, reset streak) require admin.vip.manage.
 * Access control edits require admin.config.edit.
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Crown, BarChart3, Users, Settings, RefreshCw, Search,
  X, TrendingUp, DollarSign, Flame, Calendar,
  ChevronRight, AlertCircle, ShieldCheck, Layers,
  Ban, RotateCcw, CheckCircle2, Lock, Globe, Star,
} from "lucide-react";
import { PageHeader }  from "../../components/ui/PageHeader";
import { StatCard }    from "../../components/ui/StatCard";
import { SectionCard } from "../../components/ui/SectionCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { EmptyState }  from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  adminVipService,
  type AdminVipStats,
  type AdminVipMember,
  type AdminVipMemberDetail,
  type FeatureAccessLevel,
  type AdminFeatureAccessEntry,
} from "../../services/adminDataService";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "members" | "access" | "config";

const TABS: Array<{ id: Tab; label: string; icon: typeof Crown }> = [
  { id: "overview", label: "Overview",       icon: BarChart3   },
  { id: "members",  label: "Members",        icon: Users       },
  { id: "access",   label: "Access Control", icon: ShieldCheck },
  { id: "config",   label: "Config",         icon: Settings    },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function daysLeft(endsAt: string): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000));
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats,   setStats]   = useState<AdminVipStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStats(await adminVipService.fetchStats()); }
    catch { toast.error("Failed to load VIP stats"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-[#18181b] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-[#18181b] border border-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return <EmptyState icon={Crown} title="No VIP data" description="No statistics available." />;

  const s  = stats.subscriptions;
  const r  = stats.revenue;
  const st = stats.streaks;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active VIP Members" value={s.active.toLocaleString()} subtitle={`${s.newThisWeek} new this week`} icon={Crown} iconColor="text-amber-400" iconBg="bg-amber-500/10" />
        <StatCard title="Total Revenue"      value={fmtUSD(r.totalUSD)}         subtitle={`${s.total} subscriptions all-time`} icon={DollarSign} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="Streak Claimers"    value={st.totalClaimers.toLocaleString()} subtitle={`${st.activeClaimers} claimed last 7d`} icon={Flame} iconColor="text-orange-400" iconBg="bg-orange-500/10" />
        <StatCard title="Streak Rewards Paid" value={fmtUSD(st.totalEarnedUSD)} subtitle={`${fmtUSD(st.payoutsLast30DaysUSD)} last 30d`} icon={TrendingUp} iconColor="text-indigo-400" iconBg="bg-indigo-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Subscription Health">
          <div className="space-y-3">
            <Row label="Active"           value={s.active}            color="text-emerald-400" />
            <Row label="Expired"          value={s.expired}           color="text-zinc-400" />
            <Row label="Cancelled"        value={s.cancelled}         color="text-red-400" />
            <Row label="Expiring next 7d" value={s.expiringNext7Days} color="text-amber-400" />
            <Row label="New this week"    value={s.newThisWeek}       color="text-indigo-400" />
          </div>
        </SectionCard>

        <SectionCard title="Streak Analytics">
          <div className="space-y-3">
            <Row label="Total streak claimers"   value={st.totalClaimers}          color="text-zinc-300" />
            <Row label="Active claimers (7d)"    value={st.activeClaimers}         color="text-emerald-400" />
            <Row label="Avg current streak"      value={`${st.avgCurrentStreak} days`} color="text-indigo-400" />
            <Row label="Total earned by users"   value={fmtUSD(st.totalEarnedUSD)} color="text-amber-400" />
            <Row label="Payouts last 30d"        value={`${fmtUSD(st.payoutsLast30DaysUSD)} (${st.payoutsLast30DaysCount} claims)`} color="text-orange-400" />
          </div>
        </SectionCard>
      </div>

      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
  );
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, description, confirmLabel, confirmVariant = "danger", onConfirm, onCancel,
}: {
  title: string; description: string; confirmLabel: string;
  confirmVariant?: "danger" | "warning"; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-[#18181b] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 mb-5">{description}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-sm text-zinc-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              confirmVariant === "danger"
                ? "bg-red-500/15 border border-red-500/20 text-red-400 hover:text-red-300"
                : "bg-amber-500/15 border border-amber-500/20 text-amber-400 hover:text-amber-300"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Member Detail Drawer ───────────────────────────────────────────────────────

function MemberDetailDrawer({
  userId, canManage, onClose, onMemberUpdated,
}: {
  userId: string; canManage: boolean; onClose: () => void; onMemberUpdated: () => void;
}) {
  const [detail,   setDetail]   = useState<AdminVipMemberDetail | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState<"cancel" | "reset" | null>(null);
  const [acting,   setActing]   = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true); setError(null);
    try { setDetail(await adminVipService.fetchMemberDetail(userId)); }
    catch (e: any) { setError(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  }, [userId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleCancel = async () => {
    setActing(true);
    try {
      await adminVipService.cancelSubscription(userId);
      toast.success("VIP subscription cancelled");
      setConfirm(null);
      loadDetail();
      onMemberUpdated();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to cancel subscription");
    } finally { setActing(false); }
  };

  const handleReset = async () => {
    setActing(true);
    try {
      const r = await adminVipService.resetStreak(userId);
      toast.success(`Streak reset from Day ${r.previousStreak} to 0`);
      setConfirm(null);
      loadDetail();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reset streak");
    } finally { setActing(false); }
  };

  const sub     = detail?.subscription;
  const streak  = detail?.streak;
  const history = detail?.streakHistory ?? [];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <aside className="relative z-10 h-full w-full max-w-md bg-[#111115] border-l border-white/[0.06] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-semibold text-white">VIP Member Detail</h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {loading && (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-zinc-900 animate-pulse" />)}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            )}

            {detail && (
              <>
                {/* Identity */}
                <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-4 space-y-2">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-amber-400">
                        {(detail.username || detail.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{detail.username}</p>
                      <p className="text-xs text-zinc-500 truncate">{detail.email}</p>
                    </div>
                  </div>
                  {detail.fullName && <p className="text-xs text-zinc-400">{detail.fullName}</p>}
                  <p className="text-xs text-zinc-600">Joined {fmtDate(detail.joinedAt)}</p>
                </div>

                {/* Subscription */}
                {sub && (
                  <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-4 space-y-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Subscription</p>
                      <StatusBadge status={sub.isActive ? "active" : "expired"} label={sub.isActive ? "Active" : "Expired"} />
                    </div>
                    <Row label="Plan"      value={sub.plan}               color="text-zinc-300" />
                    <Row label="Price"     value={fmtUSD(sub.price)}      color="text-emerald-400" />
                    <Row label="Started"   value={fmtDate(sub.startedAt)} color="text-zinc-300" />
                    <Row label="Expires"   value={fmtDate(sub.endsAt)}    color={sub.isActive ? "text-amber-400" : "text-zinc-500"} />
                    {sub.isActive && <Row label="Days left" value={`${daysLeft(sub.endsAt)} days`} color="text-indigo-400" />}
                    {sub.cancelledAt && <Row label="Cancelled" value={fmtDate(sub.cancelledAt)} color="text-red-400" />}

                    {/* Cancel action */}
                    {canManage && sub.isActive && (
                      <button
                        onClick={() => setConfirm("cancel")}
                        disabled={acting}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/15 text-xs text-red-400 hover:text-red-300 hover:border-red-500/25 disabled:opacity-40 transition-all"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Cancel VIP Subscription
                      </button>
                    )}
                  </div>
                )}

                {/* Streak */}
                <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-4 space-y-2">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Daily Streak</p>
                  {streak ? (
                    <>
                      <Row label="Current streak" value={`Day ${streak.current}`}     color="text-orange-400" />
                      <Row label="Total earned"    value={fmtUSD(streak.totalEarned)}  color="text-emerald-400" />
                      <Row label="Last claim"      value={streak.lastClaim ? timeAgo(streak.lastClaim) : "Never"} color="text-zinc-300" />

                      {canManage && streak.current > 0 && (
                        <button
                          onClick={() => setConfirm("reset")}
                          disabled={acting}
                          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/15 text-xs text-amber-400 hover:text-amber-300 hover:border-amber-500/25 disabled:opacity-40 transition-all"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset Streak to 0
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-zinc-600">No streak activity yet.</p>
                  )}
                </div>

                {/* Claim history */}
                {history.length > 0 && (
                  <div className="rounded-2xl bg-zinc-900/60 border border-white/[0.06] p-4">
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Claim History (last 30)</p>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto">
                      {history.map(h => (
                        <div key={h.id} className="flex items-center justify-between py-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <Flame className="w-3 h-3 text-orange-400 flex-shrink-0" />
                            <span className="text-xs text-zinc-400 truncate">{h.day ? `Day ${h.day}` : "Streak"} reward</span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs text-emerald-400 font-medium">+{fmtUSD(h.amount)}</span>
                            <span className="text-xs text-zinc-600">{timeAgo(h.claimedAt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* Confirm dialogs */}
      {confirm === "cancel" && (
        <ConfirmDialog
          title="Cancel VIP Subscription"
          description="This will immediately deactivate the user's VIP subscription. No refund is issued. The user loses VIP access instantly."
          confirmLabel="Cancel Subscription"
          confirmVariant="danger"
          onConfirm={handleCancel}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "reset" && (
        <ConfirmDialog
          title="Reset Daily Streak"
          description="This resets the user's daily streak to Day 0. Their total earnings history is preserved. Use only for support cases where the streak is corrupted."
          confirmLabel="Reset Streak"
          confirmVariant="warning"
          onConfirm={handleReset}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}

// ── Members Tab ───────────────────────────────────────────────────────────────

function MembersTab({ canManage }: { canManage: boolean }) {
  const [items,       setItems]       = useState<AdminVipMember[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [search,      setSearch]      = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [status,      setStatus]      = useState<"active" | "expired" | "all">("all");
  const [selected,    setSelected]    = useState<string | null>(null);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const result = await adminVipService.fetchMembers({
        search: search || undefined, status, limit: 50,
        cursor: reset ? undefined : (nextCursor ?? undefined),
      });
      if (reset) setItems(result.items); else setItems(p => [...p, ...result.items]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch { toast.error("Failed to load VIP members"); }
    finally { if (reset) setLoading(false); else setLoadingMore(false); }
  }, [search, status, nextCursor]);

  useEffect(() => { load(true); }, [search, status]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2 flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && setSearch(searchInput.trim())}
            placeholder="Search username or email…"
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-600 focus:outline-none"
          />
          {searchInput && (
            <button onClick={() => { setSearchInput(""); setSearch(""); }} className="text-zinc-600 hover:text-white">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-xl p-1">
          {(["all", "active", "expired"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                status === s
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      {/* Table */}
      <SectionCard noPadding>
        {loading ? (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-zinc-800 rounded w-32 animate-pulse" />
                  <div className="h-2.5 bg-zinc-800 rounded w-48 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Crown} title="No VIP members found" description={search ? "No members match your search." : "No VIP subscriptions yet."} />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map(m => (
              <button
                key={m.userId}
                onClick={() => setSelected(m.userId)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.isActive ? "bg-amber-500/10" : "bg-zinc-800"}`}>
                  <span className={`text-xs font-bold ${m.isActive ? "text-amber-400" : "text-zinc-500"}`}>
                    {m.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{m.username}</span>
                    {m.isActive && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{m.email}</p>
                </div>
                <div className="flex-shrink-0 hidden sm:block">
                  <StatusBadge status={m.isActive ? "active" : "expired"} label={m.isActive ? "Active" : "Expired"} />
                </div>
                <div className="flex-shrink-0 hidden md:flex items-center gap-1.5">
                  <Flame className={`w-3.5 h-3.5 ${m.streak && m.streak.current > 0 ? "text-orange-400" : "text-zinc-700"}`} />
                  <span className="text-xs text-zinc-500">{m.streak ? `Day ${m.streak.current}` : "—"}</span>
                </div>
                <div className="flex-shrink-0 hidden lg:flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                  <span className="text-xs text-zinc-500">
                    {m.isActive ? `${daysLeft(m.endsAt)}d left` : fmtDate(m.endsAt)}
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="px-5 py-3 border-t border-white/[0.04]">
            <button onClick={() => load(false)} disabled={loadingMore} className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors">
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </SectionCard>

      {selected && (
        <MemberDetailDrawer
          userId={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onMemberUpdated={() => load(true)}
        />
      )}
    </div>
  );
}

// ── Access Control Tab ────────────────────────────────────────────────────────

const ACCESS_LEVEL_OPTIONS: Array<{ value: FeatureAccessLevel; label: string; icon: typeof Globe; color: string }> = [
  { value: "disabled", label: "Disabled",    icon: Ban,          color: "text-red-400"    },
  { value: "all",      label: "All Users",   icon: Globe,        color: "text-emerald-400" },
  { value: "vip",      label: "VIP Only",    icon: Crown,        color: "text-amber-400"  },
  { value: "staff",    label: "Staff Only",  icon: ShieldCheck,  color: "text-indigo-400" },
  { value: "admin",    label: "Admin Only",  icon: Lock,         color: "text-purple-400" },
];

const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  football_prediction: "Football AI Prediction",
};

const BOOLEAN_FLAG_LABELS: Record<string, { label: string; hint: string }> = {
  bank_deposits:     { label: "Bank Deposits",          hint: "Enable NGN bank deposit flow for Nigerian users" },
  bank_withdrawals:  { label: "Bank Withdrawals",       hint: "Enable NGN bank withdrawal flow for Nigerian users" },
  crypto_deposits:   { label: "Crypto Deposits",        hint: "Enable USDT BEP-20 crypto deposit flow" },
  crypto_withdrawals:{ label: "Crypto Withdrawals",     hint: "Enable USDT BEP-20 crypto withdrawal flow" },
  kyc_required_vip:  { label: "KYC Required for VIP",  hint: "Require identity verification before VIP upgrade" },
  task_marketplace:  { label: "Task Marketplace",       hint: "Enable the task marketplace for users" },
  affiliate_program: { label: "Affiliate Program",      hint: "Enable the affiliate / referral program" },
};

function AccessControlTab() {
  const { can } = useAdminAccess();
  const canEdit = can("admin.config.edit");

  const [accessEntries, setAccessEntries] = useState<AdminFeatureAccessEntry[]>([]);
  const [boolFlags,     setBoolFlags]     = useState<Array<{ key: string; flagName: string; enabled: boolean; description: string | null; updatedAt: string }>>([]);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState<Record<string, boolean>>({});

  const getToken = () => localStorage.getItem("bitzimi_access_token");

  const load = async () => {
    setLoading(true);
    try {
      const [ae, bf] = await Promise.all([
        adminVipService.fetchFeatureAccessEntries(),
        adminVipService.fetchBooleanFeatureFlags(),
      ]);
      setAccessEntries(ae);
      setBoolFlags(bf);
    } catch { toast.error("Failed to load feature flags"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const saveAccessLevel = async (key: string, level: FeatureAccessLevel) => {
    setSaving(p => ({ ...p, [key]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ value: level }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.error?.message ?? "Save failed"); }
      toast.success(`Access level updated`);
      setAccessEntries(prev => prev.map(e => e.key === key ? { ...e, level } : e));
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const saveBoolFlag = async (key: string, enabled: boolean) => {
    setSaving(p => ({ ...p, [key]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ value: enabled }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.error?.message ?? "Save failed"); }
      toast.success(`${enabled ? "Enabled" : "Disabled"} feature flag`);
      setBoolFlags(prev => prev.map(f => f.key === key ? { ...f, enabled } : f));
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-[#18181b] border border-white/[0.06] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-500">
          Changes take effect within 60 seconds (runtime cache).
          {!canEdit && " Read-only — editing requires admin.config.edit permission."}
        </p>
      </div>

      {/* Feature Access Levels — VIP Early Access */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Star className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Early Access & Feature Rollout</h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Control which user tier can access each platform feature. Set to <span className="text-amber-400">VIP Only</span> for early access rollouts before public release.
        </p>

        {accessEntries.length === 0 ? (
          <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-6 text-center">
            <p className="text-sm text-zinc-600">No feature access entries configured.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accessEntries.map(entry => {
              const displayName = FEATURE_DISPLAY_NAMES[entry.featureName] ?? entry.featureName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
              const current = ACCESS_LEVEL_OPTIONS.find(o => o.value === entry.level) ?? ACCESS_LEVEL_OPTIONS[1];
              const CurrentIcon = current.icon;

              return (
                <div key={entry.key} className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{displayName}</p>
                      {entry.description && <p className="text-xs text-zinc-500 mt-0.5">{entry.description}</p>}
                    </div>
                    {saving[entry.key] && <div className="w-4 h-4 border border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin flex-shrink-0 mt-0.5" />}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {ACCESS_LEVEL_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const isSelected = entry.level === opt.value;
                      return (
                        <button
                          key={opt.value}
                          disabled={!canEdit || saving[entry.key]}
                          onClick={() => saveAccessLevel(entry.key, opt.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSelected
                              ? `bg-zinc-800 border border-white/[0.12] ${opt.color}`
                              : "text-zinc-600 hover:text-zinc-400 border border-transparent hover:border-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed"
                          }`}
                        >
                          <Icon className="w-3 h-3" />
                          {opt.label}
                          {isSelected && <CheckCircle2 className="w-3 h-3 ml-0.5 opacity-70" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Boolean feature flags */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Platform Feature Toggles</h3>
        </div>
        <p className="text-xs text-zinc-500 mb-4">
          Enable or disable platform features globally. Disabling a feature hides it from all users.
        </p>

        <div className="space-y-2">
          {boolFlags.map(flag => {
            const meta = BOOLEAN_FLAG_LABELS[flag.flagName] ?? { label: flag.flagName, hint: flag.description ?? "" };
            return (
              <div key={flag.key} className="flex items-center justify-between rounded-2xl bg-[#18181b] border border-white/[0.06] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">{meta.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{meta.hint}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  {saving[flag.key] && <div className="w-3.5 h-3.5 border border-indigo-500/40 border-t-indigo-400 rounded-full animate-spin" />}
                  <button
                    disabled={!canEdit || saving[flag.key]}
                    onClick={() => saveBoolFlag(flag.key, !flag.enabled)}
                    className={`relative w-10 h-5.5 rounded-full transition-colors focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${
                      flag.enabled ? "bg-emerald-500" : "bg-zinc-700"
                    }`}
                    style={{ height: "22px" }}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${
                        flag.enabled ? "translate-x-4.5" : "translate-x-0"
                      }`}
                      style={{ width: "18px", height: "18px", transform: flag.enabled ? "translateX(18px)" : "translateX(0)" }}
                    />
                  </button>
                  <span className={`text-xs font-medium w-12 ${flag.enabled ? "text-emerald-400" : "text-zinc-500"}`}>
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Config Tab ────────────────────────────────────────────────────────────────

interface ConfigEntry { key: string; value: any; rawValue: string; description: string | null; updatedAt: string | null }

function ConfigTab() {
  const { can } = useAdminAccess();
  const canEdit = can("admin.config.edit");

  const [configs,  setConfigs]  = useState<ConfigEntry[]>([]);
  const [editing,  setEditing]  = useState<Record<string, string>>({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState<Record<string, boolean>>({});

  const VIP_KEYS = [
    "platform.vip_price_usd",
    "vip.streak_rewards_usd",
    "vip.streak_reset_hours",
    "feature.kyc_required_vip",
  ];

  const getToken = () => localStorage.getItem("bitzimi_access_token");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/config`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      const all: ConfigEntry[] = json.data ?? [];
      setConfigs(all.filter(c => VIP_KEYS.includes(c.key)));
    } catch { toast.error("Failed to load VIP config"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getValue = (key: string) => {
    if (editing[key] !== undefined) return editing[key];
    const c = configs.find(x => x.key === key);
    return c ? c.rawValue : "";
  };

  const handleSave = async (key: string) => {
    const raw = editing[key];
    if (raw === undefined) return;
    setSaving(p => ({ ...p, [key]: true }));
    try {
      JSON.parse(raw);
      const res = await fetch(`${API_BASE}/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ value: JSON.parse(raw) }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j?.error?.message ?? "Save failed"); }
      toast.success(`Saved: ${key}`);
      setEditing(p => { const n = { ...p }; delete n[key]; return n; });
      load();
    } catch (e: any) { toast.error(e.message ?? "Value must be valid JSON"); }
    finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const CONFIG_META: Record<string, { label: string; hint: string }> = {
    "platform.vip_price_usd":   { label: "VIP Price (USD/month)",     hint: "Monthly subscription price in USD — e.g. 4" },
    "vip.streak_rewards_usd":   { label: "Daily Streak Rewards",       hint: "[day1, day2, ..., day7] amounts in USD — e.g. [0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50]" },
    "vip.streak_reset_hours":   { label: "Streak Reset Hours",         hint: "Hours of inactivity before streak resets (default 48)" },
    "feature.kyc_required_vip": { label: "KYC Required for VIP",       hint: "true/false — require identity verification before VIP purchase" },
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-2xl bg-[#18181b] border border-white/[0.06] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 mb-1">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-zinc-500">
          Changes propagate within 60 seconds (runtime cache). Values must be valid JSON.
          {!canEdit && " Read-only — editing requires admin.config.edit permission."}
        </p>
      </div>

      {VIP_KEYS.map(key => {
        const meta    = CONFIG_META[key];
        const value   = getValue(key);
        const isDirty = editing[key] !== undefined;
        return (
          <div key={key} className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4">
            <div className="flex items-start justify-between mb-2 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{meta?.label ?? key}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{meta?.hint ?? ""}</p>
              </div>
              {isDirty && canEdit && (
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setEditing(p => { const n = { ...p }; delete n[key]; return n; })} className="text-xs text-zinc-500 hover:text-white px-2 py-1 rounded-lg transition-colors">Cancel</button>
                  <button disabled={saving[key]} onClick={() => handleSave(key)} className="text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 disabled:opacity-40 transition-colors">
                    {saving[key] ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
            <input
              value={value}
              onChange={e => canEdit && setEditing(p => ({ ...p, [key]: e.target.value }))}
              readOnly={!canEdit}
              className={`w-full bg-zinc-900 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none transition-colors ${
                isDirty ? "border border-amber-500/40 text-amber-200" : "border border-white/[0.06] text-zinc-300"
              } ${!canEdit ? "cursor-default opacity-70" : ""}`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VIPPage() {
  const { can } = useAdminAccess();
  const [tab, setTab] = useState<Tab>("overview");

  const canView   = can("admin.vip.view");
  const canManage = can("admin.vip.manage");

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto">
        <EmptyState icon={Crown} title="Access Denied" description="You do not have permission to view VIP data." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="VIP Members"
        description="VIP subscription management, daily streak monitoring, feature access control, and $4/month pricing configuration."
        badge={{ label: "Live", variant: "success" }}
        actions={canManage ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs text-amber-400 font-medium">Manage Access</span>
          </div>
        ) : undefined}
      />

      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-1 w-fit flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "members"  && <MembersTab canManage={canManage} />}
      {tab === "access"   && <AccessControlTab />}
      {tab === "config"   && <ConfigTab />}
    </div>
  );
}

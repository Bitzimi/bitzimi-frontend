/**
 * Admin Referrals & Affiliates Management Page
 *
 * Tabs:
 *   1. Overview   — platform-wide stats + top earners + recent commissions
 *   2. Referrals  — all referral relationships (search, filter, paginate)
 *   3. Applications — affiliate program application queue (approve/reject)
 *   4. Commissions — all commission records (filter by event/tier)
 *   5. Config     — live referral bonus + commission rate settings
 *
 * All data sourced exclusively from backend APIs.
 * No financial calculations in the frontend.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Share2, Users, CheckCircle2, Clock, DollarSign, TrendingUp,
  RefreshCw, Search, ChevronRight, ChevronDown, ExternalLink,
  Award, Layers, Settings, BarChart3, FileText, X,
  AlertCircle, Crown, Star,
} from "lucide-react";
import { PageHeader }   from "../../components/ui/PageHeader";
import { StatCard }     from "../../components/ui/StatCard";
import { SectionCard }  from "../../components/ui/SectionCard";
import { StatusBadge }  from "../../components/ui/StatusBadge";
import { EmptyState }   from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  adminReferralService,
  adminAffiliateService,
  type AdminReferralItem,
  type AdminReferralStats,
  type AdminAffiliateApplication,
  type AdminAffiliateCommission,
  type AdminAffiliateStats,
  type AdminTopEarner,
  type AdminCommissionAnalytics,
  type AdminCommissionJob,
} from "../../services/adminDataService";

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "referrals" | "applications" | "commissions" | "config";

const TABS: Array<{ id: Tab; label: string; icon: typeof Share2 }> = [
  { id: "overview",      label: "Overview",      icon: BarChart3  },
  { id: "referrals",     label: "Referrals",     icon: Share2     },
  { id: "applications",  label: "Applications",  icon: FileText   },
  { id: "commissions",   label: "Commissions",   icon: DollarSign },
  { id: "config",        label: "Config",        icon: Settings   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(2)}K`;
  return `$${v.toFixed(4)}`;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const EVENT_LABELS: Record<string, string> = {
  vip_subscription: "VIP Subscription",
  task_completion:  "Task Completion",
  game_fee:         "Game Fee (1v1)",
  game_fee_multi:   "Game Fee (Multi)",
};

const PLATFORM_LABELS: Record<string, string> = {
  facebook:  "Facebook",
  instagram: "Instagram",
  x:         "X (Twitter)",
  telegram:  "Telegram",
  whatsapp:  "WhatsApp",
  youtube:   "YouTube",
  tiktok:    "TikTok",
  discord:   "Discord",
};

// ── Reject Dialog ─────────────────────────────────────────────────────────────

function RejectDialog({
  appId, onConfirm, onCancel,
}: { appId: string; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#18181b] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Reject Application</h3>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          Provide a reason for rejection. The applicant will be notified and may re-apply.
        </p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Insufficient audience size, unverified account, etc."
          rows={3}
          className="w-full bg-zinc-900 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600"
        />
        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={reason.trim().length < 3}
            onClick={() => onConfirm(reason.trim())}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-sm text-red-400 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Application Detail Modal ──────────────────────────────────────────────────

function ApplicationModal({
  app, onApprove, onReject, onClose, acting, canApprove, canReject,
}: {
  app: AdminAffiliateApplication;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onClose: () => void;
  acting: boolean;
  canApprove: boolean;
  canReject: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#18181b] border border-white/[0.08] rounded-2xl w-full max-w-lg mx-4 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h3 className="text-base font-semibold text-white">Affiliate Application</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Username</p>
              <p className="text-sm text-white font-medium">@{app.username}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Full Name</p>
              <p className="text-sm text-white">{app.fullName}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Platform</p>
              <p className="text-sm text-white">{PLATFORM_LABELS[app.socialPlatform] ?? app.socialPlatform}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Handle / Username</p>
              <p className="text-sm text-white">{app.socialUsername}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Claimed Audience</p>
              <p className="text-sm text-white font-medium">{app.totalMembers.toLocaleString()} members</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">Status</p>
              <StatusBadge status={app.status} />
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-1">Social Link</p>
            <a
              href={app.socialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 break-all"
            >
              {app.socialLink}
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
          </div>

          {app.screenshotUrl && (
            <div>
              <p className="text-xs text-zinc-500 mb-2">Ownership Screenshot</p>
              <img
                src={app.screenshotUrl}
                alt="Ownership proof"
                className="rounded-xl border border-white/[0.06] max-h-64 object-contain w-full bg-zinc-900"
              />
            </div>
          )}

          {app.rejectionReason && (
            <div className="bg-red-500/8 border border-red-500/15 rounded-xl p-3">
              <p className="text-xs text-red-400 font-medium mb-1">Rejection Reason</p>
              <p className="text-sm text-zinc-300">{app.rejectionReason}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500">
            <div>Submitted: {new Date(app.submittedAt).toLocaleString()}</div>
            {app.reviewedAt && <div>Reviewed: {new Date(app.reviewedAt).toLocaleString()}</div>}
          </div>
        </div>

        {app.status === "pending" && (canApprove || canReject) && (
          <div className="px-6 py-4 border-t border-white/[0.06] flex gap-2">
            {canReject && (
              <button
                disabled={acting}
                onClick={() => onReject(app.id)}
                className="flex-1 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/25 text-sm text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
            )}
            {canApprove && (
              <button
                disabled={acting}
                onClick={() => onApprove(app.id)}
                className="flex-1 px-4 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-sm text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-40 transition-colors"
              >
                {acting ? "Processing…" : "Approve"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [refStats,  setRefStats]  = useState<AdminReferralStats | null>(null);
  const [affStats,  setAffStats]  = useState<AdminAffiliateStats | null>(null);
  const [topEarners,setTopEarners]= useState<AdminTopEarner[]>([]);
  const [analytics, setAnalytics] = useState<AdminCommissionAnalytics | null>(null);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rs, as, te, an] = await Promise.all([
        adminReferralService.fetchStats(),
        adminAffiliateService.fetchStats(),
        adminAffiliateService.fetchTopEarners(10),
        adminAffiliateService.fetchAnalytics(),
      ]);
      setRefStats(rs);
      setAffStats(as);
      setTopEarners(te);
      setAnalytics(an);
    } catch { /* silent */ }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-5 h-28 animate-pulse" />
        ))}
      </div>
    );
  }

  const jobPending = affStats?.jobQueue?.pending ?? 0;
  const jobFailed  = affStats?.jobQueue?.failed  ?? 0;

  return (
    <div className="space-y-6">
      {/* Referral stats row */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Referrals</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Referrals" value={refStats?.total ?? 0}
            icon={Share2} iconColor="text-indigo-400" iconBg="bg-indigo-500/10"
            subtitle={`${refStats?.last7Days.newReferrals ?? 0} this week`}
          />
          <StatCard
            title="Rewarded" value={refStats?.rewarded ?? 0}
            icon={CheckCircle2} iconColor="text-emerald-400" iconBg="bg-emerald-500/10"
            subtitle={`${refStats?.last7Days.newRewarded ?? 0} this week`}
          />
          <StatCard
            title="Pending (no VIP)" value={refStats?.pending ?? 0}
            icon={Clock} iconColor="text-amber-400" iconBg="bg-amber-500/10"
          />
          <StatCard
            title="Total Paid Out" value={fmtUSD(refStats?.totalPaidUSD ?? 0)}
            icon={DollarSign} iconColor="text-emerald-400" iconBg="bg-emerald-500/10"
            subtitle={`$${refStats?.bonusUSD ?? 0.50}/referral bonus`}
          />
        </div>
      </div>

      {/* Affiliate stats row */}
      <div>
        <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Affiliates & Commissions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Applications" value={affStats?.applications.total ?? 0}
            icon={FileText} iconColor="text-violet-400" iconBg="bg-violet-500/10"
            subtitle={`${affStats?.applications.pending ?? 0} pending review`}
          />
          <StatCard
            title="Approved Affiliates" value={affStats?.applications.approved ?? 0}
            icon={Award} iconColor="text-emerald-400" iconBg="bg-emerald-500/10"
          />
          <StatCard
            title="Total Commissions" value={(affStats?.commissions.total ?? 0).toLocaleString()}
            icon={Layers} iconColor="text-blue-400" iconBg="bg-blue-500/10"
            subtitle={`${affStats?.last7Days.newCommissions ?? 0} this week`}
          />
          <StatCard
            title="Commission Paid" value={fmtUSD(affStats?.commissions.totalEarnedUSD ?? 0)}
            icon={TrendingUp} iconColor="text-emerald-400" iconBg="bg-emerald-500/10"
            subtitle={fmtUSD(affStats?.last7Days.earnedUSD ?? 0) + " this week"}
          />
        </div>
      </div>

      {/* Job queue status */}
      {(jobPending > 0 || jobFailed > 0) && (
        <div className={`rounded-2xl border p-4 flex items-center gap-3 ${jobFailed > 0 ? "bg-red-500/8 border-red-500/20" : "bg-amber-500/8 border-amber-500/20"}`}>
          <AlertCircle className={`w-4 h-4 flex-shrink-0 ${jobFailed > 0 ? "text-red-400" : "text-amber-400"}`} />
          <p className="text-sm text-zinc-300">
            Commission job queue: <span className="font-medium">{jobPending} pending</span>
            {jobFailed > 0 && <>, <span className="text-red-400 font-medium">{jobFailed} failed</span></>}
          </p>
        </div>
      )}

      {/* Commission breakdown by event type */}
      {affStats?.commissions.byEventType && affStats.commissions.byEventType.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard title="By Event Type">
            <div className="space-y-2">
              {affStats.commissions.byEventType.map(e => (
                <div key={e.eventType} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-zinc-300">{EVENT_LABELS[e.eventType] ?? e.eventType}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-zinc-500">{e.count} payouts</span>
                    <span className="text-sm font-medium text-white tabular-nums">{fmtUSD(e.totalUSD)}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="By Tier">
            <div className="space-y-2">
              {(affStats?.commissions.byTier ?? []).sort((a, b) => a.tier - b.tier).map(t => (
                <div key={t.tier} className="flex items-center justify-between py-1.5">
                  <span className="text-sm text-zinc-300">Tier {t.tier}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-zinc-500">{t.count} payouts</span>
                    <span className="text-sm font-medium text-white tabular-nums">{fmtUSD(t.totalUSD)}</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {/* 30-day daily analytics */}
      {analytics && analytics.daily.length > 0 && (
        <SectionCard title="Daily Commission Volume (Last 30 Days)">
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-24 min-w-max">
              {analytics.daily.map(d => {
                const maxVal = Math.max(...analytics.daily.map(x => x.total));
                const pct = maxVal > 0 ? (d.total / maxVal) * 100 : 0;
                return (
                  <div key={d.day} className="flex flex-col items-center gap-1 group" title={`${d.day}: ${fmtUSD(d.total)} (${d.count} commissions)`}>
                    <div
                      className="w-3 rounded-t bg-indigo-500/60 group-hover:bg-indigo-400 transition-colors"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Top earners */}
      {topEarners.length > 0 && (
        <SectionCard title="Top Affiliate Earners">
          <div className="space-y-1">
            {topEarners.map((u, i) => (
              <div key={u.userId} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.02] transition-colors">
                <div className="w-6 text-center">
                  {i === 0 ? <Star className="w-4 h-4 text-yellow-400 mx-auto" /> : <span className="text-xs text-zinc-600">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">@{u.username}</p>
                  <p className="text-xs text-zinc-500">{u.commissions} commissions</p>
                </div>
                <span className="text-sm font-semibold text-emerald-400 tabular-nums">{fmtUSD(u.totalEarned)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ── Referrals Tab ─────────────────────────────────────────────────────────────

function ReferralsTab() {
  const [items,      setItems]      = useState<AdminReferralItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [loadingMore,setLoadingMore]= useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore,    setHasMore]    = useState(false);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<"all" | "rewarded" | "pending">("all");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, f: typeof filter, cursor?: string) => {
    if (!cursor) setLoading(true); else setLoadingMore(true);
    try {
      const rewarded = f === "rewarded" ? true : f === "pending" ? false : undefined;
      const res = await adminReferralService.fetchReferrals({ search: q || undefined, rewarded, cursor, limit: 50 });
      if (cursor) setItems(prev => [...prev, ...res.items]);
      else        setItems(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch { /* silent */ }
    finally  { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { load(search, filter); }, []);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(val, filter), 350);
  };

  const handleFilter = (f: typeof filter) => {
    setFilter(f);
    load(search, f);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by username…"
            className="w-full bg-zinc-900 border border-white/[0.08] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "rewarded", "pending"] as const).map(f => (
            <button
              key={f}
              onClick={() => handleFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors capitalize ${
                filter === f
                  ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          onClick={() => load(search, filter)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <SectionCard noPadding>
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Share2} title="No referrals found" description="No referral records match your filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Referrer", "Referred User", "VIP Status", "Reward", "Joined"].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-zinc-500 px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map(r => (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-medium">@{r.referrerUsername}</span>
                          {r.referrerIsVIP && <Crown className="w-3 h-3 text-yellow-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-zinc-300">@{r.referredUsername}</span>
                          {r.referredIsVIP && <Crown className="w-3 h-3 text-yellow-400" />}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={r.referredIsVIP ? "active" : "pending"}
                          label={r.referredIsVIP ? "VIP" : "Not VIP"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={r.referralRewarded ? "approved" : "pending"}
                          label={r.referralRewarded ? "Paid" : "Pending"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-500">{timeAgo(r.joinedAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="px-4 py-3 border-t border-white/[0.06]">
                <button
                  disabled={loadingMore}
                  onClick={() => load(search, filter, nextCursor ?? undefined)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                  {!loadingMore && <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ── Applications Tab ──────────────────────────────────────────────────────────

function ApplicationsTab({ canApprove, canReject }: { canApprove: boolean; canReject: boolean }) {
  const [items,       setItems]       = useState<AdminAffiliateApplication[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [filter,      setFilter]      = useState<"" | "pending" | "approved" | "rejected">("");
  const [selected,    setSelected]    = useState<AdminAffiliateApplication | null>(null);
  const [acting,      setActing]      = useState(false);
  const [rejectTarget,setRejectTarget]= useState<string | null>(null);

  const load = useCallback(async (f: typeof filter, cursor?: string) => {
    if (!cursor) setLoading(true); else setLoadingMore(true);
    try {
      const res = await adminAffiliateService.fetchApplications({ status: f || undefined, cursor, limit: 50 });
      if (cursor) setItems(prev => [...prev, ...res.items]);
      else        setItems(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch { /* silent */ }
    finally  { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { load(""); }, []);

  const handleFilter = (f: typeof filter) => { setFilter(f); load(f); };

  const handleApprove = async (id: string) => {
    setActing(true);
    try {
      await adminAffiliateService.approveApplication(id);
      toast.success("Application approved — applicant notified");
      setSelected(null);
      load(filter);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to approve");
    } finally { setActing(false); }
  };

  const handleReject = (id: string) => { setRejectTarget(id); };

  const confirmReject = async (reason: string) => {
    if (!rejectTarget) return;
    setActing(true);
    try {
      await adminAffiliateService.rejectApplication(rejectTarget, reason);
      toast.success("Application rejected — applicant notified");
      setRejectTarget(null);
      setSelected(null);
      load(filter);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reject");
    } finally { setActing(false); }
  };

  const pendingCount = items.filter(a => a.status === "pending").length;

  return (
    <>
      {selected && (
        <ApplicationModal
          app={selected}
          onApprove={handleApprove}
          onReject={handleReject}
          onClose={() => setSelected(null)}
          acting={acting}
          canApprove={canApprove}
          canReject={canReject}
        />
      )}
      {rejectTarget && (
        <RejectDialog
          appId={rejectTarget}
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2">
            {(["", "pending", "approved", "rejected"] as const).map(f => (
              <button
                key={f}
                onClick={() => handleFilter(f)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors capitalize ${
                  filter === f
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "bg-zinc-900 border border-white/[0.06] text-zinc-400 hover:text-white"
                }`}
              >
                {f === "" ? "All" : f}
                {f === "pending" && pendingCount > 0 && (
                  <span className="ml-1.5 bg-amber-500/20 text-amber-400 rounded-full px-1.5 py-0.5">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => load(filter)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <SectionCard noPadding>
          {loading ? (
            <div className="p-8 flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState icon={FileText} title="No applications" description="No affiliate applications match your filter." />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {["Applicant", "Platform", "Audience", "Status", "Submitted", ""].map((h, i) => (
                        <th key={i} className="text-left text-xs font-medium text-zinc-500 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {items.map(a => (
                      <tr key={a.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          <p className="text-sm text-white font-medium">@{a.username}</p>
                          <p className="text-xs text-zinc-500">{a.fullName}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-zinc-300">{PLATFORM_LABELS[a.socialPlatform] ?? a.socialPlatform}</p>
                          <p className="text-xs text-zinc-600">{a.socialUsername}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-zinc-300">{a.totalMembers.toLocaleString()}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={a.status} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-zinc-500">{timeAgo(a.submittedAt)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setSelected(a)}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            Review <ChevronRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMore && (
                <div className="px-4 py-3 border-t border-white/[0.06]">
                  <button
                    disabled={loadingMore}
                    onClick={() => load(filter, nextCursor ?? undefined)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-40 transition-colors"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                    {!loadingMore && <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              )}
            </>
          )}
        </SectionCard>
      </div>
    </>
  );
}

// ── Commissions Tab ───────────────────────────────────────────────────────────

function CommissionsTab() {
  const [items,       setItems]       = useState<AdminAffiliateCommission[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);
  const [eventFilter, setEventFilter] = useState("");
  const [tierFilter,  setTierFilter]  = useState("");

  const load = useCallback(async (event: string, tier: string, cursor?: string) => {
    if (!cursor) setLoading(true); else setLoadingMore(true);
    try {
      const res = await adminAffiliateService.fetchCommissions({
        eventType: event || undefined,
        tier:      tier ? Number(tier) : undefined,
        cursor,
        limit:     50,
      });
      if (cursor) setItems(prev => [...prev, ...res.items]);
      else        setItems(res.items);
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
    } catch { /* silent */ }
    finally  { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { load("", ""); }, []);

  const handleEventFilter = (e: string) => { setEventFilter(e); load(e, tierFilter); };
  const handleTierFilter  = (t: string) => { setTierFilter(t); load(eventFilter, t); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={eventFilter}
          onChange={e => handleEventFilter(e.target.value)}
          className="bg-zinc-900 border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="">All Event Types</option>
          {Object.entries(EVENT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={e => handleTierFilter(e.target.value)}
          className="bg-zinc-900 border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
        >
          <option value="">All Tiers</option>
          <option value="1">Tier 1</option>
          <option value="2">Tier 2</option>
          <option value="3">Tier 3</option>
        </select>
        <button
          onClick={() => load(eventFilter, tierFilter)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <SectionCard noPadding>
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={DollarSign} title="No commissions found" description="No commission records match your filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {["Beneficiary", "Source", "Tier", "Event", "Gross", "Rate", "Commission", "Status", "Date"].map(h => (
                      <th key={h} className="text-left text-xs font-medium text-zinc-500 px-3 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {items.map(c => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-3 py-2.5">
                        <span className="text-sm text-white">@{c.beneficiaryUsername}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-sm text-zinc-400">@{c.sourceUsername}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-zinc-300 bg-zinc-800 rounded px-1.5 py-0.5">T{c.tier}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-zinc-400">{EVENT_LABELS[c.eventType] ?? c.eventType}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-sm text-zinc-300 tabular-nums">{fmtUSD(c.grossAmount)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-zinc-500">{(c.rate * 100).toFixed(0)}%</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-sm font-medium text-emerald-400 tabular-nums">{fmtUSD(c.commission)}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <StatusBadge status={c.status === "paid" ? "completed" : "pending"} label={c.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs text-zinc-500 whitespace-nowrap">{timeAgo(c.createdAt)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="px-4 py-3 border-t border-white/[0.06]">
                <button
                  disabled={loadingMore}
                  onClick={() => load(eventFilter, tierFilter, nextCursor ?? undefined)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 disabled:opacity-40 transition-colors"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                  {!loadingMore && <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}

// ── Config Tab ────────────────────────────────────────────────────────────────

function ConfigTab() {
  const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;

  type ConfigEntry = { key: string; value: string; description: string | null };
  const [configs, setConfigs]   = useState<ConfigEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Record<string, string>>({});
  const [saving,  setSaving]    = useState<Record<string, boolean>>({});

  const KEYS = [
    "referral.bonus_usd",
    "affiliate.commission_rates.vip_subscription",
    "affiliate.commission_rates.task_completion",
    "affiliate.commission_rates.game_fee",
    "affiliate.commission_rates.game_fee_multi",
    "affiliate.min_members_to_apply",
    "platform.vip_price_usd",
    "vip.streak_rewards_usd",
    "vip.streak_reset_hours",
    "feature.affiliate_program",
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
      setConfigs(all.filter(c => KEYS.includes(c.key)));
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getValue = (key: string) => {
    if (editing[key] !== undefined) return editing[key];
    const c = configs.find(x => x.key === key);
    return c ? c.value : "";
  };

  const handleSave = async (key: string) => {
    const raw = editing[key];
    if (raw === undefined) return;
    setSaving(p => ({ ...p, [key]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body:    JSON.stringify({ value: JSON.parse(raw) }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j?.error?.message ?? "Save failed");
      }
      toast.success(`Saved: ${key}`);
      setEditing(p => { const n = { ...p }; delete n[key]; return n; });
      load();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed — ensure value is valid JSON");
    } finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const CONFIG_LABELS: Record<string, { label: string; hint: string }> = {
    "referral.bonus_usd":                               { label: "Referral Bonus (USD)",            hint: "One-time bonus paid to referrer on referred user's first VIP" },
    "affiliate.commission_rates.vip_subscription":      { label: "Commission: VIP Subscription",    hint: "[tier1%, tier2%, tier3%] — e.g. [0.28, 0.07, 0.04]" },
    "affiliate.commission_rates.task_completion":       { label: "Commission: Task Completion",     hint: "[tier1%, tier2%, tier3%]" },
    "affiliate.commission_rates.game_fee":              { label: "Commission: Game Fee (1v1)",       hint: "[tier1%, tier2%, tier3%]" },
    "affiliate.commission_rates.game_fee_multi":        { label: "Commission: Game Fee (Multi)",     hint: "[tier1%, tier2%, tier3%]" },
    "affiliate.min_members_to_apply":                   { label: "Min Members to Apply",            hint: "Minimum social media members/followers required" },
    "platform.vip_price_usd":                           { label: "VIP Price (USD/month)",           hint: "Monthly VIP subscription price" },
    "vip.streak_rewards_usd":                           { label: "VIP Streak Rewards",              hint: "[day1, day2, ..., day7] — daily streak reward amounts" },
    "vip.streak_reset_hours":                           { label: "Streak Reset Hours",              hint: "Hours of inactivity before streak resets (e.g. 48)" },
    "feature.affiliate_program":                        { label: "Affiliate Program Enabled",       hint: "true/false — disabling hides the affiliate program from users" },
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => <div key={i} className="h-16 rounded-2xl bg-[#18181b] border border-white/[0.06] animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-zinc-500">
        Changes take effect within 60 seconds (runtime cache). Values must be valid JSON.
      </p>
      {KEYS.map(key => {
        const meta  = CONFIG_LABELS[key];
        const value = getValue(key);
        const isDirty = editing[key] !== undefined;
        return (
          <div key={key} className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-4">
            <div className="flex items-start justify-between mb-2 gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white">{meta?.label ?? key}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{meta?.hint ?? key}</p>
              </div>
              {isDirty && (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setEditing(p => { const n = { ...p }; delete n[key]; return n; })}
                    className="text-xs text-zinc-500 hover:text-white px-2 py-1 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving[key]}
                    onClick={() => handleSave(key)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 disabled:opacity-40 transition-colors"
                  >
                    {saving[key] ? "Saving…" : "Save"}
                  </button>
                </div>
              )}
            </div>
            <input
              value={value}
              onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))}
              className={`w-full bg-zinc-900 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none transition-colors ${
                isDirty ? "border border-amber-500/40 text-amber-200" : "border border-white/[0.06] text-zinc-300"
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReferralsPage() {
  const { can } = useAdminAccess();
  const [tab, setTab] = useState<Tab>("overview");

  const canView    = can("admin.referrals.view");
  const canApprove = can("admin.affiliates.approve");
  const canReject  = can("admin.affiliates.reject");

  if (!canView) {
    return (
      <div className="max-w-7xl mx-auto">
        <EmptyState icon={Share2} title="Access Denied" description="You do not have permission to view referral data." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Referrals & Affiliates"
        description="Referral network, affiliate applications, commission history, and reward configuration."
        badge={{ label: "Live", variant: "success" }}
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

      {/* Tab content */}
      {tab === "overview"     && <OverviewTab />}
      {tab === "referrals"    && <ReferralsTab />}
      {tab === "applications" && <ApplicationsTab canApprove={canApprove} canReject={canReject} />}
      {tab === "commissions"  && <CommissionsTab />}
      {tab === "config"       && <ConfigTab />}
    </div>
  );
}

/**
 * Admin Notifications Management Page
 *
 * Tabs:
 *   1. Overview  — statistics (total, unread, by type, volume)
 *   2. Broadcast — compose and send global announcements
 *   3. History   — paginated list of all notifications with filters
 */
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Bell, BarChart3, Send, History, RefreshCw, Trash2,
  Search, X, Users, Crown, ShieldCheck, AlertCircle,
  CheckCircle2, Clock,
} from "lucide-react";
import { PageHeader }  from "../../components/ui/PageHeader";
import { StatCard }    from "../../components/ui/StatCard";
import { SectionCard } from "../../components/ui/SectionCard";
import { EmptyState }  from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import {
  adminNotificationService,
  type AdminNotificationItem,
  type AdminNotificationStats,
} from "../../services/adminDataService";

type Tab = "overview" | "broadcast" | "history";

const TABS: Array<{ id: Tab; label: string; icon: typeof Bell }> = [
  { id: "overview",  label: "Overview",  icon: BarChart3 },
  { id: "broadcast", label: "Broadcast", icon: Send      },
  { id: "history",   label: "History",   icon: History   },
];

const SEGMENT_OPTIONS = [
  { value: "all",      label: "All Users",        icon: Users,       color: "text-emerald-400" },
  { value: "vip",      label: "VIP Members",      icon: Crown,       color: "text-amber-400"   },
  { value: "verified", label: "Verified Users",   icon: ShieldCheck, color: "text-indigo-400"  },
] as const;

type Segment = "all" | "vip" | "verified";

const TYPE_OPTIONS = [
  "announcement", "system", "daily_streak", "vip_expiry", "kyc_approved",
  "kyc_rejected", "task_approved", "task_rejected", "withdrawal_processed",
  "deposit_confirmed",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [stats,   setStats]   = useState<AdminNotificationStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setStats(await adminNotificationService.fetchStats()); }
    catch { toast.error("Failed to load notification stats"); }
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
      </div>
    );
  }

  if (!stats) return <EmptyState icon={Bell} title="No data" description="Failed to load statistics." />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Notifications" value={fmtNum(stats.total)}  icon={Bell}         iconColor="text-indigo-400" iconBg="bg-indigo-500/10" />
        <StatCard title="Unread"              value={fmtNum(stats.unread)} icon={AlertCircle}  iconColor="text-amber-400"  iconBg="bg-amber-500/10"  />
        <StatCard title="Sent (Last 7 Days)"  value={fmtNum(stats.last7d)} icon={Clock}        iconColor="text-emerald-400" iconBg="bg-emerald-500/10" subtitle={`${fmtNum(stats.last30d)} in 30 days`} />
        <StatCard title="Read Rate"           value={stats.total > 0 ? `${Math.round((stats.read / stats.total) * 100)}%` : "—"} icon={CheckCircle2} iconColor="text-sky-400" iconBg="bg-sky-500/10" />
      </div>

      {stats.byType.length > 0 && (
        <SectionCard title="Distribution by Type">
          <div className="space-y-2">
            {stats.byType.map(t => (
              <div key={t.type} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-40 truncate font-mono">{t.type}</span>
                <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500/60"
                    style={{ width: `${Math.min(100, (t.count / (stats.total || 1)) * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 w-12 text-right tabular-nums">{fmtNum(t.count)}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>
    </div>
  );
}

// ── Broadcast Tab ─────────────────────────────────────────────────────────────

function BroadcastTab() {
  const { can } = useAdminAccess();
  const canBroadcast = can("admin.notifications.broadcast");

  const [type,     setType]     = useState("announcement");
  const [title,    setTitle]    = useState("");
  const [message,  setMessage]  = useState("");
  const [segment,  setSegment]  = useState<Segment>("all");
  const [sending,  setSending]  = useState(false);
  const [lastSent, setLastSent] = useState<{ sent: number } | null>(null);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error("Title and message are required");
      return;
    }
    setSending(true);
    try {
      const result = await adminNotificationService.broadcast({ type, title: title.trim(), message: message.trim(), segment });
      setLastSent(result);
      toast.success(`Sent to ${result.sent} users`);
      setTitle(""); setMessage("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send broadcast");
    } finally { setSending(false); }
  };

  if (!canBroadcast) {
    return <EmptyState icon={Send} title="Access Restricted" description="You need admin.notifications.broadcast permission to send broadcasts." />;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
        <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-300">
          Broadcasts are sent immediately and cannot be recalled. Verify your message before sending.
        </p>
      </div>

      {lastSent && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <p className="text-xs text-emerald-300">Last broadcast sent to <strong>{lastSent.sent}</strong> users successfully.</p>
        </div>
      )}

      <SectionCard title="Compose Broadcast">
        <div className="space-y-4">
          {/* Segment */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Audience</label>
            <div className="flex flex-wrap gap-2">
              {SEGMENT_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setSegment(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      segment === opt.value
                        ? `bg-zinc-800 border-white/[0.12] ${opt.color}`
                        : "border-white/[0.06] text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            >
              {TYPE_OPTIONS.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Notification title…"
              className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
            />
            <p className="text-[10px] text-zinc-600 mt-1 text-right">{title.length}/200</p>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              maxLength={2000}
              placeholder="Notification message body…"
              className="w-full bg-zinc-900 border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50 resize-none"
            />
            <p className="text-[10px] text-zinc-600 mt-1 text-right">{message.length}/2000</p>
          </div>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !message.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors"
          >
            <Send className="w-4 h-4" />
            {sending ? "Sending…" : `Send to ${SEGMENT_OPTIONS.find(s => s.value === segment)?.label}`}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────────────────

function HistoryTab() {
  const { can } = useAdminAccess();
  const canManage = can("admin.notifications.manage");

  const [items,       setItems]       = useState<AdminNotificationItem[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor,  setNextCursor]  = useState<string | null>(null);
  const [hasMore,     setHasMore]     = useState(false);

  const [filterType,  setFilterType]    = useState("");
  const [filterRead,  setFilterRead]    = useState<"" | "true" | "false">("");
  const [deleting,    setDeleting]      = useState<Set<string>>(new Set());

  const [types, setTypes] = useState<string[]>([]);

  const load = useCallback(async (reset = true) => {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const opts: any = { limit: 50 };
      if (filterType) opts.type = filterType;
      if (filterRead !== "") opts.read = filterRead === "true";
      if (!reset && nextCursor) opts.cursor = nextCursor;

      const result = await adminNotificationService.fetchAll(opts);
      if (reset) setItems(result.items); else setItems(p => [...p, ...result.items]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch { toast.error("Failed to load notifications"); }
    finally { if (reset) setLoading(false); else setLoadingMore(false); }
  }, [filterType, filterRead, nextCursor]);

  useEffect(() => {
    adminNotificationService.fetchTypes()
      .then(t => setTypes(t.map(x => x.type)))
      .catch(() => {});
  }, []);

  useEffect(() => { load(true); }, [filterType, filterRead]);

  const handleDelete = async (id: string) => {
    setDeleting(p => new Set(p).add(id));
    try {
      await adminNotificationService.deleteNotification(id);
      setItems(p => p.filter(n => n.id !== id));
      toast.success("Notification deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    } finally {
      setDeleting(p => { const n = new Set(p); n.delete(id); return n; });
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={filterRead}
          onChange={e => setFilterRead(e.target.value as any)}
          className="bg-zinc-900/60 border border-white/[0.06] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
        >
          <option value="">All Status</option>
          <option value="false">Unread</option>
          <option value="true">Read</option>
        </select>

        <button onClick={() => load(true)} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors ml-auto">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      <SectionCard noPadding>
        {loading ? (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-zinc-800 rounded w-48 animate-pulse" />
                  <div className="h-2.5 bg-zinc-800 rounded w-64 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications" description="No notifications match your filters." />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map(n => (
              <div key={n.id} className="flex items-start gap-4 px-5 py-3 hover:bg-white/[0.01]">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${n.read ? "bg-zinc-700" : "bg-indigo-400"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-white truncate">{n.title}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono flex-shrink-0">{n.type}</span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    {n.username ?? n.email} · {timeAgo(n.createdAt)}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDelete(n.id)}
                    disabled={deleting.has(n.id)}
                    className="flex-shrink-0 text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
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
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { can } = useAdminAccess();
  const [tab, setTab] = useState<Tab>("overview");

  if (!can("admin.notifications.view")) {
    return (
      <div className="max-w-7xl mx-auto">
        <EmptyState icon={Bell} title="Access Denied" description="You do not have permission to view notifications." />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Notifications"
        description="Manage platform notifications, send broadcasts to user segments, and monitor notification history."
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

      {tab === "overview"  && <OverviewTab />}
      {tab === "broadcast" && <BroadcastTab />}
      {tab === "history"   && <HistoryTab />}
    </div>
  );
}

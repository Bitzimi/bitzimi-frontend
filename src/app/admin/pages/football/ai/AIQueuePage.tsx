/**
 * AI Analysis Queue — Phase 17.1
 *
 * Displays the queue of matches pending AI analysis.
 * Admins can remove queued items or trigger analysis for a match.
 */

import { useEffect, useState } from "react";
import { Clock, RefreshCw, Trash2, Play, RotateCcw, ChevronDown } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...opts?.headers },
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok) throw new Error((json as { error?: { message: string } }).error?.message ?? "Request failed");
  return json.data as T;
}

interface Match { homeTeam: string; awayTeam: string; kickoffAt: string; league: { name: string } }
interface QueueItem {
  id: string; matchId: string; priority: number; status: string;
  attempts: number; maxAttempts: number; scheduledAt: string;
  startedAt: string | null; completedAt: string | null; error: string | null;
  queuedBy: string | null; match: Match;
}
interface QueueStats { total: number; queued: number; processing: number; completed: number; failed: number }
interface QueueData { items: QueueItem[]; nextCursor: string | null; hasMore: boolean; stats: QueueStats }

const STATUS_COLOR: Record<string, string> = {
  queued:     "bg-blue-500/15 text-blue-300",
  processing: "bg-amber-500/15 text-amber-300",
  completed:  "bg-green-500/15 text-green-300",
  failed:     "bg-red-500/15 text-red-300",
  skipped:    "bg-zinc-500/15 text-zinc-400",
};

function fmtDate(iso: string) { return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }); }

export default function AIQueuePage() {
  const [data, setData]           = useState<QueueData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [statusFilter, setFilter] = useState("");
  const [removing, setRemoving]   = useState<string | null>(null);
  const [triggering, setTrigger]  = useState<string | null>(null);
  const [retrying, setRetrying]   = useState<string | null>(null);

  const load = (cursor?: string) => {
    setLoading(true); setError("");
    const p = new URLSearchParams({ limit: "20" });
    if (statusFilter) p.set("status", statusFilter);
    if (cursor)       p.set("cursor", cursor);
    apiFetch<QueueData>(`/api/v1/admin/ai/queue?${p}`)
      .then(d => setData(prev => cursor && prev
        ? { ...d, items: [...prev.items, ...d.items] }
        : d
      ))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setData(null); load(); }, [statusFilter]);

  const remove = async (id: string) => {
    setRemoving(id);
    try {
      await apiFetch(`/api/v1/admin/ai/queue/${id}`, { method: "DELETE" });
      setData(prev => prev ? { ...prev, items: prev.items.filter(i => i.id !== id) } : null);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setRemoving(null);
    }
  };

  const retry = async (id: string) => {
    setRetrying(id);
    try {
      await apiFetch(`/api/v1/admin/ai/queue/${id}/retry`, { method: "POST" });
      load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setRetrying(null);
    }
  };

  const trigger = async (matchId: string) => {
    setTrigger(matchId);
    try {
      await apiFetch(`/api/v1/admin/ai/analyses/${matchId}/trigger`, { method: "POST" });
      load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setTrigger(null);
    }
  };

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Analysis Queue</h1>
            <p className="text-xs text-zinc-500">Matches queued for AI analysis</p>
          </div>
        </div>
        <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-2">
          {[
            { label: "Total",      val: stats.total,      color: "text-white"      },
            { label: "Queued",     val: stats.queued,     color: "text-blue-400"   },
            { label: "Processing", val: stats.processing, color: "text-amber-400"  },
            { label: "Completed",  val: stats.completed,  color: "text-green-400"  },
            { label: "Failed",     val: stats.failed,     color: "text-red-400"    },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.val}</p>
              <p className="text-[10px] text-zinc-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["", "queued", "processing", "completed", "failed", "skipped"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === s
                ? "bg-amber-600/20 text-amber-300 border border-amber-500/30"
                : "bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.07]"
            }`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="ml-auto relative">
          <select className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-7 text-xs text-white focus:outline-none">
            <option>Priority ↓</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {error && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{error}</div>}
      {loading && !data && <div className="text-center py-12 text-zinc-500 text-sm">Loading queue…</div>}
      {!loading && data?.items.length === 0 && <div className="text-center py-12 text-zinc-500 text-sm">No items in queue.</div>}

      {/* Queue items */}
      <div className="space-y-2">
        {(data?.items ?? []).map(item => (
          <div key={item.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLOR[item.status] ?? "bg-zinc-500/15 text-zinc-400"}`}>
                  {item.status}
                </span>
                <span className="text-[10px] text-zinc-500">Priority {item.priority}</span>
                {item.attempts > 0 && (
                  <span className="text-[10px] text-zinc-600">{item.attempts}/{item.maxAttempts} attempts</span>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">{item.match.league.name}</p>
              <p className="text-sm font-medium text-white">{item.match.homeTeam} vs {item.match.awayTeam}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Scheduled {fmtDate(item.scheduledAt)}</p>
              {item.error && <p className="text-[10px] text-red-400 mt-1 break-all">{item.error}</p>}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {item.status === "queued" && (
                <button
                  onClick={() => trigger(item.matchId)}
                  disabled={triggering === item.matchId}
                  className="p-2 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 text-violet-400 transition-all disabled:opacity-50"
                  title="Trigger analysis"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
              {item.status === "failed" && (
                <button
                  onClick={() => retry(item.id)}
                  disabled={retrying === item.id}
                  className="p-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all disabled:opacity-50"
                  title="Retry failed item"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${retrying === item.id ? "animate-spin" : ""}`} />
                </button>
              )}
              {["queued", "failed", "skipped"].includes(item.status) && (
                <button
                  onClick={() => remove(item.id)}
                  disabled={removing === item.id}
                  className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all disabled:opacity-50"
                  title="Remove from queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {data?.hasMore && (
        <button
          onClick={() => load(data.nextCursor ?? undefined)}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-400 text-sm hover:bg-white/[0.05] transition-all"
        >
          Load more
        </button>
      )}
    </div>
  );
}

import { useEffect, useRef, useState, useCallback } from "react";
import { RefreshCw, Activity, ChevronDown } from "lucide-react";

function getToken() {
  return localStorage.getItem("bitzimi_access_token") ?? "";
}

interface MonitoringLog {
  id: string;
  component: string;
  event: string;
  details: string;
  durationMs: number;
  createdAt: string;
}

interface ApiResponse {
  data: {
    items: MonitoringLog[];
    nextCursor: string | null;
    hasMore: boolean;
  };
}

type ComponentFilter =
  | "all"
  | "worker"
  | "sync"
  | "publish"
  | "learning"
  | "drift"
  | "provider"
  | "scheduler";

const COMPONENT_FILTERS: { label: string; value: ComponentFilter }[] = [
  { label: "All", value: "all" },
  { label: "Worker", value: "worker" },
  { label: "Sync", value: "sync" },
  { label: "Publish", value: "publish" },
  { label: "Learning", value: "learning" },
  { label: "Drift", value: "drift" },
  { label: "Provider", value: "provider" },
  { label: "Scheduler", value: "scheduler" },
];

const COMPONENT_COLORS: Record<string, string> = {
  worker: "bg-blue-900/60 text-blue-300 ring-1 ring-blue-700/50",
  sync: "bg-purple-900/60 text-purple-300 ring-1 ring-purple-700/50",
  publish: "bg-emerald-900/60 text-emerald-300 ring-1 ring-emerald-700/50",
  learning: "bg-amber-900/60 text-amber-300 ring-1 ring-amber-700/50",
  drift: "bg-orange-900/60 text-orange-300 ring-1 ring-orange-700/50",
  scheduler: "bg-slate-700/60 text-slate-300 ring-1 ring-slate-600/50",
  provider: "bg-indigo-900/60 text-indigo-300 ring-1 ring-indigo-700/50",
};

const EVENT_COLORS: Record<string, string> = {
  completed: "bg-green-900/60 text-green-300 ring-1 ring-green-700/50",
  failed: "bg-red-900/60 text-red-300 ring-1 ring-red-700/50",
  started: "bg-blue-900/60 text-blue-300 ring-1 ring-blue-700/50",
  skipped: "bg-gray-700/60 text-gray-400 ring-1 ring-gray-600/50",
};

function getBadgeClass(map: Record<string, string>, key: string): string {
  return map[key] ?? "bg-gray-700/60 text-gray-400 ring-1 ring-gray-600/50";
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function formatAbsoluteTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function parseDetails(raw: string): string {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const parts: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (key === "error" && (value === null || value === undefined)) continue;
      if (value === null || value === undefined) continue;
      parts.push(`${key}: ${String(value)}`);
    }
    const joined = parts.join(", ");
    if (joined.length > 120) return joined.slice(0, 117) + "...";
    return joined;
  } catch {
    if (raw.length > 120) return raw.slice(0, 117) + "...";
    return raw;
  }
}

function TimestampCell({ isoString }: { isoString: string }) {
  const [relative, setRelative] = useState(() => formatRelativeTime(isoString));

  useEffect(() => {
    const interval = setInterval(() => {
      setRelative(formatRelativeTime(isoString));
    }, 15000);
    return () => clearInterval(interval);
  }, [isoString]);

  return (
    <span
      title={formatAbsoluteTime(isoString)}
      className="cursor-default text-gray-400 text-sm whitespace-nowrap"
    >
      {relative}
    </span>
  );
}

export default function MonitoringPage() {
  const [logs, setLogs] = useState<MonitoringLog[]>([]);
  const [filter, setFilter] = useState<ComponentFilter>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(
    async (opts: { reset?: boolean; nextCursor?: string | null } = {}) => {
      const isReset = opts.reset ?? false;
      const cursorParam = isReset ? null : (opts.nextCursor ?? null);

      if (isReset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      try {
        const params = new URLSearchParams({ limit: "50" });
        if (filter !== "all") params.set("component", filter);
        if (cursorParam) params.set("cursor", cursorParam);

        const res = await fetch(`/api/v1/admin/ai/monitoring?${params}`, {
          headers: { Authorization: "Bearer " + getToken() },
        });

        if (!res.ok) {
          throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        }

        const json: ApiResponse = await res.json();
        const { items, nextCursor, hasMore: more } = json.data;

        if (isReset) {
          setLogs(items);
        } else {
          setLogs((prev) => [...prev, ...items]);
        }
        setCursor(nextCursor);
        setHasMore(more);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter]
  );

  // Reload on filter change
  useEffect(() => {
    fetchLogs({ reset: true });
  }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        fetchLogs({ reset: true });
      }, 30000);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  function handleFilterClick(value: ComponentFilter) {
    if (value === filter) return;
    setFilter(value);
  }

  function handleLoadMore() {
    if (!hasMore || loadingMore) return;
    fetchLogs({ nextCursor: cursor });
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Activity className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-semibold text-white">Monitoring Logs</h1>
        </div>
        <p className="text-gray-400 text-sm ml-9">
          Background worker and scheduler activity
        </p>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {/* Filter buttons */}
        <div className="flex flex-wrap gap-1.5">
          {COMPONENT_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => handleFilterClick(f.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Auto-refresh toggle */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-400 hover:text-gray-200 transition-colors">
          <div className="relative">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-4" />
          </div>
          Auto-refresh every 30s
        </label>

        {/* Manual refresh button */}
        <button
          onClick={() => fetchLogs({ reset: true })}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200 text-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap w-32">
                  Timestamp
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap w-28">
                  Component
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium whitespace-nowrap w-24">
                  Event
                </th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">
                  Details
                </th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium whitespace-nowrap w-24">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                      <RefreshCw className="w-6 h-6 animate-spin" />
                      <span className="text-sm">Loading logs...</span>
                    </div>
                  </td>
                </tr>
              ) : !loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                      <Activity className="w-8 h-8 opacity-30" />
                      <p className="text-sm font-medium">No logs found</p>
                      <p className="text-xs text-gray-600">
                        {filter !== "all"
                          ? `No activity recorded for the "${filter}" component.`
                          : "No monitoring activity has been recorded yet."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="bg-gray-900/30 hover:bg-gray-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 align-middle">
                      <TimestampCell isoString={log.createdAt} />
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getBadgeClass(
                          COMPONENT_COLORS,
                          log.component
                        )}`}
                      >
                        {log.component}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getBadgeClass(
                          EVENT_COLORS,
                          log.event
                        )}`}
                      >
                        {log.event}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <span className="text-gray-400 text-xs font-mono">
                        {parseDetails(log.details)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <span className="text-gray-400 text-xs tabular-nums">
                        {formatDuration(log.durationMs)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Load more */}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" />
                Load more
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

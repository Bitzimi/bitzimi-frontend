import { useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Brain,
  CheckCircle,
  Circle,
  Clock,
  CloudOff,
  Cpu,
  Eye,
  FileText,
  Layers,
  RefreshCw,
  Server,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";

function getToken() {
  return localStorage.getItem("bitzimi_access_token") ?? "";
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProviderItem {
  id: string;
  name: string;
  type: string;
  isEnabled: boolean;
  isDefault: boolean;
  healthStatus: string;
  avgLatencyMs: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

interface DiagnosticsSnapshot {
  timestamp: string;
  overallHealth: "healthy" | "degraded" | "unhealthy";

  engine: {
    status: string;
    health: string;
    isEnabled: boolean;
    lastRunAt: string | null;
    lastError: string | null;
    analysisCount: number;
    queueDepth: number;
    modelVersion: string;
  };

  providers: {
    total: number;
    enabled: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
    items: ProviderItem[];
  };

  queue: {
    total: number;
    queued: number;
    processing: number;
    completed: number;
    failed: number;
    skipped: number;
  };

  learning: {
    latestPeriod: string | null;
    latestAccuracy: number | null;
    computedAt: string | null;
    totalPeriods: number;
  };

  drift: {
    unresolvedAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
  };

  publishing: {
    autoPublish: boolean;
    mode: string;
    pendingReview: number;
    pendingDraft: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REFRESH_INTERVAL = 30;

function healthColor(health: string): string {
  switch (health) {
    case "healthy":
      return "text-green-400";
    case "degraded":
      return "text-amber-400";
    case "unhealthy":
      return "text-red-400";
    default:
      return "text-gray-400";
  }
}

function healthBg(health: string): string {
  switch (health) {
    case "healthy":
      return "bg-green-900/40 text-green-300 border border-green-700/50";
    case "degraded":
      return "bg-amber-900/40 text-amber-300 border border-amber-700/50";
    case "unhealthy":
      return "bg-red-900/40 text-red-300 border border-red-700/50";
    default:
      return "bg-gray-800 text-gray-400 border border-gray-700";
  }
}

function statusBg(status: string): string {
  switch (status) {
    case "running":
      return "bg-green-900/40 text-green-300 border border-green-700/50";
    case "idle":
      return "bg-blue-900/40 text-blue-300 border border-blue-700/50";
    case "paused":
      return "bg-amber-900/40 text-amber-300 border border-amber-700/50";
    case "error":
      return "bg-red-900/40 text-red-300 border border-red-700/50";
    default:
      return "bg-gray-800 text-gray-400 border border-gray-700";
  }
}

function healthDot(health: string): string {
  switch (health) {
    case "healthy":
      return "bg-green-400";
    case "degraded":
      return "bg-amber-400";
    case "unhealthy":
      return "bg-red-400";
    default:
      return "bg-gray-500";
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 text-gray-100 font-semibold text-sm uppercase tracking-wider">
        <span className="text-gray-400">{icon}</span>
        {title}
      </div>
      {children}
    </div>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}

function StatBox({
  label,
  value,
  valueClass = "text-white",
}: {
  label: string;
  value: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="bg-gray-800/60 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-lg font-bold ${valueClass}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section components
// ---------------------------------------------------------------------------

function EngineSection({ engine }: { engine: DiagnosticsSnapshot["engine"] }) {
  return (
    <Card title="Engine" icon={<Cpu size={15} />}>
      <div className="flex flex-wrap gap-2 items-center">
        <Badge className={statusBg(engine.status)}>
          {engine.status.toUpperCase()}
        </Badge>
        <Badge className={healthBg(engine.health)}>
          {engine.health.toUpperCase()}
        </Badge>
        <Badge
          className={
            engine.isEnabled
              ? "bg-green-900/30 text-green-300 border border-green-700/40"
              : "bg-gray-800 text-gray-500 border border-gray-700"
          }
        >
          {engine.isEnabled ? "Enabled" : "Disabled"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatBox label="Analyses Run" value={engine.analysisCount.toLocaleString()} />
        <StatBox
          label="Queue Depth"
          value={engine.queueDepth}
          valueClass={engine.queueDepth > 50 ? "text-amber-400" : "text-white"}
        />
        <StatBox label="Model Version" value={engine.modelVersion || "—"} />
      </div>

      <div className="text-sm text-gray-400 space-y-1">
        <div className="flex gap-2">
          <Clock size={14} className="mt-0.5 shrink-0 text-gray-500" />
          <span>
            Last run:{" "}
            <span className="text-gray-200">{formatTime(engine.lastRunAt)}</span>
          </span>
        </div>
        {engine.lastError && (
          <div className="flex gap-2 items-start">
            <XCircle size={14} className="mt-0.5 shrink-0 text-red-400" />
            <span className="text-red-400 break-all">{engine.lastError}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

function ProvidersSection({ providers }: { providers: DiagnosticsSnapshot["providers"] }) {
  return (
    <Card title="Providers" icon={<Server size={15} />}>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="text-gray-400">
          <span className="text-white font-semibold">{providers.enabled}</span> enabled
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-green-400">
          <span className="font-semibold">{providers.healthy}</span> healthy
        </span>
        {providers.degraded > 0 && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-amber-400">
              <span className="font-semibold">{providers.degraded}</span> degraded
            </span>
          </>
        )}
        {providers.unhealthy > 0 && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-red-400">
              <span className="font-semibold">{providers.unhealthy}</span> unhealthy
            </span>
          </>
        )}
        {providers.unknown > 0 && (
          <>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">
              <span className="font-semibold">{providers.unknown}</span> unknown
            </span>
          </>
        )}
      </div>

      {providers.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wide border-b border-gray-800">
                <th className="text-left py-2 pr-4 font-medium">Name</th>
                <th className="text-left py-2 pr-4 font-medium">Type</th>
                <th className="text-center py-2 pr-4 font-medium">Status</th>
                <th className="text-right py-2 pr-4 font-medium">Latency</th>
                <th className="text-left py-2 pr-4 font-medium">Last Sync</th>
                <th className="text-left py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {providers.items.map((p) => (
                <tr key={p.id} className="text-gray-300">
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-1.5">
                      {p.name}
                      {p.isDefault && (
                        <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-700/40 px-1.5 py-0.5 rounded-full">
                          default
                        </span>
                      )}
                      {!p.isEnabled && (
                        <span className="text-[10px] text-gray-600">(off)</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-gray-500 capitalize">{p.type}</td>
                  <td className="py-2 pr-4">
                    <div className="flex justify-center">
                      <span
                        className={`inline-block w-2.5 h-2.5 rounded-full ${healthDot(p.healthStatus)}`}
                        title={p.healthStatus}
                      />
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-xs text-gray-400">
                    {formatLatency(p.avgLatencyMs)}
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-500 whitespace-nowrap">
                    {formatTime(p.lastSyncAt)}
                  </td>
                  <td className="py-2 max-w-xs">
                    {p.lastError ? (
                      <span className="text-red-400 text-xs break-all">{p.lastError}</span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {providers.items.length === 0 && (
        <p className="text-gray-600 text-sm">No providers configured.</p>
      )}
    </Card>
  );
}

function QueueSection({ queue }: { queue: DiagnosticsSnapshot["queue"] }) {
  return (
    <Card title="Queue" icon={<Layers size={15} />}>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatBox label="Queued" value={queue.queued} valueClass="text-blue-300" />
        <StatBox label="Processing" value={queue.processing} valueClass="text-amber-300" />
        <StatBox label="Completed" value={queue.completed} valueClass="text-green-300" />
        <StatBox label="Failed" value={queue.failed} valueClass={queue.failed > 0 ? "text-red-400" : "text-white"} />
        <StatBox label="Skipped" value={queue.skipped} valueClass="text-gray-400" />
      </div>
    </Card>
  );
}

function LearningSection({ learning }: { learning: DiagnosticsSnapshot["learning"] }) {
  const accuracy =
    learning.latestAccuracy !== null
      ? `${(learning.latestAccuracy * 100).toFixed(1)}%`
      : "—";

  const accuracyColor =
    learning.latestAccuracy === null
      ? "text-gray-400"
      : learning.latestAccuracy >= 0.8
      ? "text-green-300"
      : learning.latestAccuracy >= 0.6
      ? "text-amber-300"
      : "text-red-400";

  return (
    <Card title="Learning" icon={<TrendingUp size={15} />}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Latest Period" value={learning.latestPeriod ?? "—"} />
        <StatBox label="Accuracy" value={accuracy} valueClass={accuracyColor} />
        <StatBox label="Computed At" value={learning.computedAt ? formatTime(learning.computedAt) : "—"} />
        <StatBox label="Total Periods" value={learning.totalPeriods.toLocaleString()} />
      </div>
    </Card>
  );
}

function DriftSection({ drift }: { drift: DiagnosticsSnapshot["drift"] }) {
  const hasAlerts = drift.criticalAlerts > 0 || drift.highAlerts > 0;

  return (
    <Card title="Drift" icon={<Activity size={15} />}>
      {hasAlerts && (
        <div className="flex items-start gap-2 bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3 text-red-300 text-sm">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span>
            {drift.criticalAlerts > 0 && (
              <strong>{drift.criticalAlerts} critical</strong>
            )}
            {drift.criticalAlerts > 0 && drift.highAlerts > 0 && " and "}
            {drift.highAlerts > 0 && (
              <strong>{drift.highAlerts} high</strong>
            )}
            {" "}alert{drift.criticalAlerts + drift.highAlerts !== 1 ? "s" : ""} require attention.
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatBox
          label="Unresolved"
          value={drift.unresolvedAlerts}
          valueClass={drift.unresolvedAlerts > 0 ? "text-amber-300" : "text-white"}
        />
        <StatBox
          label="Critical"
          value={drift.criticalAlerts}
          valueClass={drift.criticalAlerts > 0 ? "text-red-400" : "text-white"}
        />
        <StatBox
          label="High"
          value={drift.highAlerts}
          valueClass={drift.highAlerts > 0 ? "text-orange-400" : "text-white"}
        />
      </div>
    </Card>
  );
}

function PublishingSection({ publishing }: { publishing: DiagnosticsSnapshot["publishing"] }) {
  return (
    <Card title="Publishing" icon={<FileText size={15} />}>
      <div className="flex flex-wrap gap-3 items-center text-sm">
        <div className="flex items-center gap-2">
          {publishing.autoPublish ? (
            <CheckCircle size={14} className="text-green-400" />
          ) : (
            <Circle size={14} className="text-gray-600" />
          )}
          <span className="text-gray-300">Auto-publish</span>
          <Badge className={publishing.autoPublish ? "bg-green-900/40 text-green-300 border border-green-700/40" : "bg-gray-800 text-gray-500 border border-gray-700"}>
            {publishing.autoPublish ? "On" : "Off"}
          </Badge>
        </div>
        <span className="text-gray-600">|</span>
        <div className="flex items-center gap-1.5 text-gray-400">
          Mode:{" "}
          <span className="text-gray-200 font-medium capitalize">{publishing.mode || "—"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatBox
          label="Pending Review"
          value={publishing.pendingReview}
          valueClass={publishing.pendingReview > 0 ? "text-amber-300" : "text-white"}
        />
        <StatBox
          label="Pending Draft"
          value={publishing.pendingDraft}
          valueClass={publishing.pendingDraft > 0 ? "text-blue-300" : "text-white"}
        />
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DiagnosticsPage() {
  const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchDiagnostics() {
    try {
      const res = await fetch("/api/v1/admin/ai/diagnostics", {
        headers: { Authorization: "Bearer " + getToken() },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSnapshot(json.data as DiagnosticsSnapshot);
      setLastRefreshed(new Date());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  }

  function scheduleNext() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (refreshRef.current) clearTimeout(refreshRef.current);

    setCountdown(REFRESH_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    refreshRef.current = setTimeout(() => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      fetchDiagnostics().then(scheduleNext);
    }, REFRESH_INTERVAL * 1000);
  }

  useEffect(() => {
    fetchDiagnostics().then(scheduleNext);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (refreshRef.current) clearTimeout(refreshRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleManualRefresh() {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (refreshRef.current) clearTimeout(refreshRef.current);
    setLoading(true);
    fetchDiagnostics().then(scheduleNext);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Brain size={22} className="text-indigo-400" />
          <h1 className="text-xl font-bold tracking-tight">AI Diagnostics</h1>
          {snapshot && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${healthBg(snapshot.overallHealth)}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${healthDot(snapshot.overallHealth)}`}
              />
              {snapshot.overallHealth.charAt(0).toUpperCase() +
                snapshot.overallHealth.slice(1)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400">
          {lastRefreshed && (
            <div className="flex items-center gap-1.5">
              <Clock size={13} />
              <span>
                Refreshed{" "}
                <span className="text-gray-300">
                  {lastRefreshed.toLocaleTimeString()}
                </span>
              </span>
            </div>
          )}

          <div className="flex items-center gap-1.5 text-gray-500">
            <Zap size={13} />
            <span>Next in {countdown}s</span>
          </div>

          <button
            onClick={handleManualRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-900/20 border border-red-700/40 rounded-lg px-4 py-3 text-red-300 text-sm">
          <CloudOff size={15} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !snapshot && (
        <div className="grid grid-cols-1 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 border border-gray-800 rounded-xl p-5 h-32 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Main content */}
      {snapshot && (
        <div className="grid grid-cols-1 gap-5">
          {/* Timestamp sub-note */}
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Eye size={11} />
            Snapshot captured at {formatTime(snapshot.timestamp)}
          </div>

          <EngineSection engine={snapshot.engine} />
          <ProvidersSection providers={snapshot.providers} />
          <QueueSection queue={snapshot.queue} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <LearningSection learning={snapshot.learning} />
            <DriftSection drift={snapshot.drift} />
          </div>

          <PublishingSection publishing={snapshot.publishing} />

          {/* Footer note */}
          <div className="flex items-center gap-1.5 text-xs text-gray-700 pb-2">
            <BookOpen size={11} />
            Data auto-refreshes every {REFRESH_INTERVAL} seconds. Manual refresh available above.
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Fraud Alerts Page — Phase 15
 *
 * Pattern-based fraud detection results with manual resolution workflow.
 * Backend generates alerts. No AI. No external calls.
 */

import { useState, useEffect, useCallback } from "react";
import { AlertOctagon, RefreshCw, Zap, ChevronDown } from "lucide-react";
import { toast } from "sonner";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface FraudAlert {
  id:          string;
  userId:      string | null;
  severity:    string;
  type:        string;
  description: string;
  metadata:    unknown;
  status:      string;
  resolvedAt:  string | null;
  resolution:  string | null;
  createdAt:   string;
  updatedAt:   string;
}

interface Result {
  items:      FraudAlert[];
  nextCursor: string | null;
  hasMore:    boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  low:      "bg-zinc-500/15 text-zinc-300",
  medium:   "bg-amber-500/15 text-amber-300",
  high:     "bg-orange-500/15 text-orange-300",
  critical: "bg-red-500/15 text-red-300",
};

const STATUS_COLOR: Record<string, string> = {
  open:         "bg-red-500/15 text-red-300",
  under_review: "bg-amber-500/15 text-amber-300",
  resolved:     "bg-green-500/15 text-green-300",
  dismissed:    "bg-zinc-500/15 text-zinc-400",
};

const TYPE_LABEL: Record<string, string> = {
  repeated_login_failures: "Repeated Login Failures",
  rapid_wallet_activity:   "Rapid Wallet Activity",
  suspicious_withdrawal:   "Suspicious Withdrawal",
  abnormal_game_activity:  "Abnormal Game Activity",
  multiple_accounts:       "Multiple Accounts",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" });
}

export default function FraudAlertsPage() {
  const [items, setItems]     = useState<FraudAlert[]>([]);
  const [cursor, setCursor]   = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatus] = useState("open");
  const [severity, setSeverity]   = useState("");
  const [scanning, setScanning]   = useState(false);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [resolution, setResolution] = useState<Record<string, string>>({});

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "50" });
    if (statusFilter) p.set("status", statusFilter);
    if (severity)     p.set("severity", severity);
    if (cur)          p.set("cursor", cur);
    apiFetch<Result>(`/api/v1/admin/security/fraud-alerts?${p}`)
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusFilter, severity]);

  useEffect(() => { load(); }, [load]);

  const runScan = async () => {
    setScanning(true);
    try {
      const res = await apiFetch<{ detected: number; created: number }>("/api/v1/admin/security/fraud-alerts/scan", { method: "POST", body: JSON.stringify({}) });
      toast.success(`Fraud scan complete: ${res.created} new alert${res.created !== 1 ? "s" : ""} detected`);
      load();
    } catch {
      toast.error("Fraud scan failed");
    } finally {
      setScanning(false);
    }
  };

  const updateAlert = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await apiFetch(`/api/v1/admin/security/fraud-alerts/${id}`, {
        method: "PATCH",
        body:   JSON.stringify({ status, resolution: resolution[id] }),
      });
      setItems(prev => prev.map(a => a.id === id ? { ...a, status, resolution: resolution[id] ?? null } : a));
      toast.success("Alert updated");
    } catch {
      toast.error("Failed to update alert");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
            <AlertOctagon className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Fraud Monitoring</h1>
            <p className="text-xs text-zinc-500">Pattern-based fraud detection — no AI, no external calls</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={runScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-sm transition-all"
          >
            <Zap className={`w-3.5 h-3.5 ${scanning ? "animate-pulse" : ""}`} />
            {scanning ? "Scanning…" : "Run Scan"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {["open", "under_review", "resolved", "dismissed", ""].map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                  : "bg-white/[0.04] text-zinc-400 border border-white/[0.06]"
              }`}
            >
              {s === "" ? "All" : s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <select
            value={severity}
            onChange={e => setSeverity(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-xs text-white focus:outline-none"
          >
            <option value="">All severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* Alerts */}
      <div className="space-y-3">
        {loading && items.length === 0 && <div className="text-center py-10 text-zinc-500 text-sm">Loading…</div>}
        {!loading && items.length === 0 && (
          <div className="text-center py-10 text-zinc-500 text-sm">
            No fraud alerts found.
            <button onClick={runScan} disabled={scanning} className="ml-2 text-amber-400 hover:text-amber-300 transition-colors">
              Run a scan to detect patterns.
            </button>
          </div>
        )}
        {items.map(alert => (
          <div key={alert.id} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${SEVERITY_COLOR[alert.severity] ?? ""}`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLOR[alert.status] ?? ""}`}>
                    {alert.status.replace("_", " ").toUpperCase()}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-600 flex-shrink-0">{formatDate(alert.createdAt)}</p>
            </div>

            <p className="text-sm font-medium text-white mb-1">
              {TYPE_LABEL[alert.type] ?? alert.type}
            </p>
            <p className="text-xs text-zinc-400 mb-3">{alert.description}</p>

            {alert.userId && (
              <p className="text-[10px] text-zinc-600 font-mono mb-3">User: {alert.userId}</p>
            )}

            {alert.metadata && (
              <pre className="text-[10px] text-zinc-500 bg-black/20 rounded p-2 overflow-auto max-h-16 mb-3">
                {JSON.stringify(alert.metadata, null, 2)}
              </pre>
            )}

            {alert.status === "open" && (
              <div className="flex items-center gap-2">
                <input
                  value={resolution[alert.id] ?? ""}
                  onChange={e => setResolution(prev => ({ ...prev, [alert.id]: e.target.value }))}
                  placeholder="Resolution note (optional)"
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={() => updateAlert(alert.id, "under_review")}
                  disabled={updating === alert.id}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs hover:bg-amber-500/20 transition-all"
                >
                  Review
                </button>
                <button
                  onClick={() => updateAlert(alert.id, "resolved")}
                  disabled={updating === alert.id}
                  className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs hover:bg-green-500/20 transition-all"
                >
                  Resolve
                </button>
                <button
                  onClick={() => updateAlert(alert.id, "dismissed")}
                  disabled={updating === alert.id}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-zinc-400 text-xs hover:bg-white/[0.07] transition-all"
                >
                  Dismiss
                </button>
              </div>
            )}

            {alert.resolution && (
              <p className="text-xs text-zinc-500 mt-2 italic">Resolution: {alert.resolution}</p>
            )}
          </div>
        ))}
        {hasMore && (
          <button onClick={() => load(cursor, true)} disabled={loading} className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-400 text-sm hover:bg-white/[0.05] transition-all">
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

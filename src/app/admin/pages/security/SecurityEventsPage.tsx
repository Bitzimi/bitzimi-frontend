/**
 * Security Events Page — Phase 15
 *
 * Displays security monitoring events: suspicious IPs, permission violations,
 * login spikes, rate limit hits, and admin alerts.
 */

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, CheckCircle, RefreshCw, ChevronDown } from "lucide-react";

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

interface SecurityEvent {
  id:          string;
  type:        string;
  severity:    string;
  actorId:     string | null;
  ipAddress:   string | null;
  description: string;
  metadata:    unknown;
  resolved:    boolean;
  resolvedAt:  string | null;
  createdAt:   string;
}

interface Result {
  items:      SecurityEvent[];
  nextCursor: string | null;
  hasMore:    boolean;
}

const SEVERITY_COLOR: Record<string, string> = {
  info:     "bg-blue-500/15 text-blue-300 border-blue-500/30",
  low:      "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/30",
  high:     "bg-orange-500/15 text-orange-300 border-orange-500/30",
  critical: "bg-red-500/15 text-red-300 border-red-500/30",
};

const TYPE_LABELS: Record<string, string> = {
  login_failure_spike:  "Login Failure Spike",
  suspicious_ip:        "Suspicious IP",
  rate_limit_hit:       "Rate Limit Hit",
  permission_violation: "Permission Violation",
  account_locked:       "Account Locked",
  fraud_pattern:        "Fraud Pattern",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" });
}

export default function SecurityEventsPage() {
  const [items, setItems]       = useState<SecurityEvent[]>([]);
  const [cursor, setCursor]     = useState<string | null>(null);
  const [hasMore, setHasMore]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [severity, setSeverity] = useState("");
  const [resolved, setResolved] = useState<string>("");
  const [resolving, setResolving] = useState<string | null>(null);

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "50" });
    if (severity) p.set("severity", severity);
    if (resolved) p.set("resolved", resolved);
    if (cur)      p.set("cursor", cur);
    apiFetch<Result>(`/api/v1/admin/security/events?${p}`)
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [severity, resolved]);

  useEffect(() => { load(); }, [load]);

  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      await apiFetch(`/api/v1/admin/security/events/${id}/resolve`, { method: "PATCH", body: JSON.stringify({}) });
      setItems(prev => prev.map(e => e.id === id ? { ...e, resolved: true, resolvedAt: new Date().toISOString() } : e));
    } catch {} finally {
      setResolving(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Security Events</h1>
            <p className="text-xs text-zinc-500">Suspicious activity, violations, and system alerts</p>
          </div>
        </div>
        <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        {["", "info", "low", "medium", "high", "critical"].map(s => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              severity === s
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                : "bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.07]"
            }`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <div className="ml-auto relative">
          <select
            value={resolved}
            onChange={e => setResolved(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-xs text-white focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="false">Open</option>
            <option value="true">Resolved</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* Events list */}
      <div className="space-y-2">
        {loading && items.length === 0 && (
          <div className="text-center py-10 text-zinc-500 text-sm">Loading security events…</div>
        )}
        {!loading && items.length === 0 && (
          <div className="text-center py-10 text-zinc-500 text-sm">No security events found.</div>
        )}
        {items.map(evt => (
          <div
            key={evt.id}
            className={`bg-white/[0.03] border rounded-xl p-4 ${evt.resolved ? "border-white/[0.04] opacity-60" : "border-white/[0.06]"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <span className={`flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SEVERITY_COLOR[evt.severity] ?? "bg-zinc-500/15 text-zinc-300"}`}>
                  {evt.severity.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white">
                    {TYPE_LABELS[evt.type] ?? evt.type}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">{evt.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-zinc-500">
                    <span>{formatDate(evt.createdAt)}</span>
                    {evt.ipAddress && <span className="font-mono">{evt.ipAddress}</span>}
                    {evt.resolved && <span className="text-green-400">Resolved {evt.resolvedAt ? formatDate(evt.resolvedAt) : ""}</span>}
                  </div>
                </div>
              </div>
              {!evt.resolved && (
                <button
                  onClick={() => handleResolve(evt.id)}
                  disabled={resolving === evt.id}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs transition-all"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {resolving === evt.id ? "Resolving…" : "Resolve"}
                </button>
              )}
            </div>
          </div>
        ))}
        {hasMore && (
          <button
            onClick={() => load(cursor, true)}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-zinc-400 text-sm hover:bg-white/[0.05] transition-all"
          >
            Load more events
          </button>
        )}
      </div>
    </div>
  );
}

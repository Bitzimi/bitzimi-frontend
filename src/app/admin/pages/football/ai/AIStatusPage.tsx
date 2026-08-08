/**
 * AI Engine Status — Phase 17.1
 *
 * Displays live engine health, status, config summary, and model version.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Brain, Activity, CheckCircle, XCircle, Pause, Clock,
  RefreshCw, Settings, BarChart2, ChevronRight, Globe, Zap, Stethoscope, Radio,
} from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface EngineStatus {
  id: string; status: string; health: string;
  lastRunAt: string | null; lastErrorAt: string | null; lastError: string | null;
  analysisCount: number; queueDepth: number; version: string;
  updatedAt: string;
}
interface ConfigSummary { isEnabled: boolean; modelVersion: string }
interface StatusData { status: EngineStatus; config: ConfigSummary }

const HEALTH_META: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
  healthy:   { icon: CheckCircle, color: "text-green-400",  label: "Healthy"   },
  degraded:  { icon: Activity,    color: "text-amber-400",  label: "Degraded"  },
  unhealthy: { icon: XCircle,     color: "text-red-400",    label: "Unhealthy" },
  unknown:   { icon: Pause,       color: "text-zinc-400",   label: "Unknown"   },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  idle:     { color: "bg-zinc-500/20 text-zinc-300",   label: "Idle"       },
  running:  { color: "bg-green-500/20 text-green-300", label: "Running"    },
  error:    { color: "bg-red-500/20 text-red-300",     label: "Error"      },
  paused:   { color: "bg-amber-500/20 text-amber-300", label: "Paused"     },
};

function fmtDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function AIStatusPage() {
  const navigate = useNavigate();
  const [data, setData]       = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    apiFetch<StatusData>("/api/v1/admin/ai/status")
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const s    = data?.status;
  const cfg  = data?.config;
  const hm   = HEALTH_META[s?.health ?? "unknown"] ?? HEALTH_META.unknown;
  const sm   = STATUS_META[s?.status ?? "idle"]    ?? STATUS_META.idle;
  const HealthIcon = hm.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Brain className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">AI Engine Status</h1>
            <p className="text-xs text-zinc-500">Football AI Intelligence — Phase 17.1 Foundation</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && <div className="text-center py-12 text-zinc-500 text-sm">Loading engine status…</div>}
      {!loading && error && (
        <div className="text-center py-12 text-zinc-500 text-sm">
          Failed to load engine status.{" "}
          <button onClick={load} className="text-violet-400 hover:text-violet-300 underline">Retry</button>
        </div>
      )}

      {!loading && !error && s && cfg && (
        <>
          {/* Health + Status cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <HealthIcon className={`w-5 h-5 ${hm.color} mb-2`} />
              <p className={`text-base font-bold ${hm.color}`}>{hm.label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Engine Health</p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mb-2 ${sm.color}`}>
                {sm.label}
              </div>
              <p className="text-base font-bold text-white">{s.status}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Engine Status</p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <Activity className="w-5 h-5 text-blue-400 mb-2" />
              <p className="text-base font-bold text-blue-400">{s.analysisCount}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Analyses Run</p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <Clock className="w-5 h-5 text-amber-400 mb-2" />
              <p className="text-base font-bold text-amber-400">{s.queueDepth}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Queue Depth</p>
            </div>
          </div>

          {/* Detail rows */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            {[
              { label: "Engine Version",    value: s.version      },
              { label: "Model Version",     value: cfg.modelVersion },
              { label: "Engine Enabled",    value: cfg.isEnabled ? "Yes" : "No" },
              { label: "Last Run",          value: fmtDate(s.lastRunAt) },
              { label: "Last Error",        value: s.lastErrorAt ? fmtDate(s.lastErrorAt) : "None" },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between px-4 py-3">
                <p className="text-xs text-zinc-500">{row.label}</p>
                <p className="text-xs text-white font-medium">{row.value}</p>
              </div>
            ))}
          </div>

          {s.lastError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-400 mb-1">Last Error</p>
              <p className="text-xs text-red-300 font-mono break-all">{s.lastError}</p>
            </div>
          )}

          {/* Quick nav */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">AI Management</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                { label: "Configuration",      path: "/admin/football/ai/config",         icon: Settings    },
                { label: "Analysis Queue",     path: "/admin/football/ai/queue",           icon: Clock       },
                { label: "Learning Metrics",   path: "/admin/football/ai/learning",        icon: BarChart2   },
                { label: "Data Providers",     path: "/admin/football/ai/providers",       icon: Globe       },
                { label: "Publish Config",     path: "/admin/football/ai/publish-config",  icon: Zap         },
                { label: "Diagnostics",        path: "/admin/football/ai/diagnostics",     icon: Stethoscope },
                { label: "Monitoring Logs",    path: "/admin/football/ai/monitoring",      icon: Radio       },
              ].map(l => (
                <button
                  key={l.path}
                  onClick={() => navigate(l.path)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-left transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <l.icon className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
                    <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{l.label}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

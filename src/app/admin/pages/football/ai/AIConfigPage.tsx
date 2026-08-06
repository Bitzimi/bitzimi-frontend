/**
 * AI Engine Configuration — Phase 17.1
 *
 * Manage AI engine settings: enable/disable, feature weights, confidence thresholds.
 * All changes are persisted to backend and take effect immediately.
 */

import { useEffect, useState } from "react";
import { Settings, RefreshCw, RotateCcw, Save, ChevronDown, ChevronUp } from "lucide-react";

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

interface Config {
  id: string; isEnabled: boolean; modelVersion: string;
  featureWeights: Record<string, number>;
  minConfidence: number; highConfidence: number;
  maxQueueSize: number; analysisTimeoutMs: number;
  updatedAt: string; updatedBy: string | null;
}

const WEIGHT_LABELS: Record<string, string> = {
  homeForm:       "Home Form",
  awayForm:       "Away Form",
  h2h:            "Head to Head",
  leagueStrength: "League Strength",
  venueAdvantage: "Venue Advantage",
};

export default function AIConfigPage() {
  const [config, setConfig]         = useState<Config | null>(null);
  const [form, setForm]             = useState<Partial<Config>>({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [resetting, setResetting]   = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");
  const [showWeights, setShowWeights] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    apiFetch<Config>("/api/v1/admin/ai/config")
      .then(cfg => { setConfig(cfg); setForm(cfg); })
      .catch(() => setError("Failed to load configuration."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const payload: Record<string, unknown> = {};
      if (form.isEnabled !== config?.isEnabled)         payload.isEnabled         = form.isEnabled;
      if (form.modelVersion !== config?.modelVersion)   payload.modelVersion      = form.modelVersion;
      if (form.minConfidence !== config?.minConfidence) payload.minConfidence     = form.minConfidence;
      if (form.highConfidence !== config?.highConfidence) payload.highConfidence  = form.highConfidence;
      if (form.maxQueueSize !== config?.maxQueueSize)   payload.maxQueueSize      = form.maxQueueSize;
      if (form.featureWeights)                          payload.featureWeights    = form.featureWeights;
      if (Object.keys(payload).length === 0) { setSuccess("No changes to save."); return; }
      const updated = await apiFetch<Config>("/api/v1/admin/ai/config", {
        method: "PATCH", body: JSON.stringify(payload),
      });
      setConfig(updated); setForm(updated); setSuccess("Configuration saved.");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!confirm("Reset all AI configuration to defaults?")) return;
    setResetting(true); setError(""); setSuccess("");
    try {
      const updated = await apiFetch<Config>("/api/v1/admin/ai/config/reset", { method: "POST" });
      setConfig(updated); setForm(updated); setSuccess("Configuration reset to defaults.");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setResetting(false);
    }
  };

  const updateWeight = (key: string, val: number) => {
    setForm(f => ({ ...f, featureWeights: { ...(f.featureWeights ?? {}), [key]: val } }));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Settings className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">AI Configuration</h1>
            <p className="text-xs text-zinc-500">Engine settings, thresholds, and feature weights</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && <div className="text-center py-12 text-zinc-500 text-sm">Loading configuration…</div>}

      {!loading && (
        <>
          {/* Feedback */}
          {error   && <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{error}</div>}
          {success && <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400">{success}</div>}

          {/* Engine toggle */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-white">AI Engine</p>
              <p className="text-xs text-zinc-500 mt-0.5">Enable or disable the AI prediction engine</p>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, isEnabled: !f.isEnabled }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.isEnabled ? "bg-violet-600" : "bg-zinc-700"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.isEnabled ? "translate-x-5" : ""}`} />
            </button>
          </div>

          {/* Core settings */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl divide-y divide-white/[0.04]">
            <div className="p-4 space-y-1">
              <label className="text-xs text-zinc-500">Model Version</label>
              <input
                type="text"
                value={form.modelVersion ?? ""}
                onChange={e => setForm(f => ({ ...f, modelVersion: e.target.value }))}
                className="w-full bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
              />
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Min Confidence ({form.minConfidence}%)</label>
                <input type="range" min={0} max={100} value={form.minConfidence ?? 60}
                  onChange={e => setForm(f => ({ ...f, minConfidence: parseInt(e.target.value) }))}
                  className="w-full accent-violet-500"
                />
                <p className="text-[10px] text-zinc-600">Minimum to include in results</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">High Confidence ({form.highConfidence}%)</label>
                <input type="range" min={0} max={100} value={form.highConfidence ?? 80}
                  onChange={e => setForm(f => ({ ...f, highConfidence: parseInt(e.target.value) }))}
                  className="w-full accent-violet-500"
                />
                <p className="text-[10px] text-zinc-600">Threshold for Elite Picks</p>
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Max Queue Size</label>
                <input type="number" min={1} max={1000} value={form.maxQueueSize ?? 100}
                  onChange={e => setForm(f => ({ ...f, maxQueueSize: parseInt(e.target.value) }))}
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Analysis Timeout (ms)</label>
                <input type="number" min={1000} value={form.analysisTimeoutMs ?? 30000}
                  onChange={e => setForm(f => ({ ...f, analysisTimeoutMs: parseInt(e.target.value) }))}
                  className="w-full bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                />
              </div>
            </div>
          </div>

          {/* Feature weights */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
            <button
              onClick={() => setShowWeights(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-white hover:bg-white/[0.02] transition-colors"
            >
              <span className="font-medium">Feature Weights</span>
              {showWeights ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
            </button>
            {showWeights && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/[0.04] pt-3">
                <p className="text-[11px] text-zinc-500">Weights must sum to 1.0. Used by Phase 17.2 prediction pipeline.</p>
                {Object.entries(form.featureWeights ?? {}).map(([key, val]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-zinc-400">{WEIGHT_LABELS[key] ?? key}</label>
                      <span className="text-xs font-mono text-violet-400">{Number(val).toFixed(2)}</span>
                    </div>
                    <input type="range" min={0} max={1} step={0.05} value={val}
                      onChange={e => updateWeight(key, parseFloat(e.target.value))}
                      className="w-full accent-violet-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
            <button
              onClick={reset}
              disabled={resetting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-sm transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {resetting ? "Resetting…" : "Reset Defaults"}
            </button>
          </div>

          {config?.updatedAt && (
            <p className="text-[10px] text-zinc-600">
              Last updated: {new Date(config.updatedAt).toLocaleString("en-GB")}
              {config.updatedBy ? ` by ${config.updatedBy}` : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}

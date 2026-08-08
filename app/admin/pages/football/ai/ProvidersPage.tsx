/**
 * Admin Football AI — Data Providers Page
 *
 * Manage external football data provider integrations:
 * create, edit, test, rotate API keys, view sync logs, manage league mappings.
 */

import { useEffect, useState, useCallback } from "react";
import {
  Globe, Zap, RefreshCw, Trash2, Key, CheckCircle, XCircle,
  AlertTriangle, HelpCircle, Plus, Edit2, Power, ChevronDown,
  ChevronUp, Link, Unlink,
} from "lucide-react";
const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
const tok = () => localStorage.getItem("bitzimi_access_token") ?? "";

async function apiFetch<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${tok()}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { data?: T; error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProviderType {
  type: string;
  name: string;
  defaultBaseUrl: string;
  docsUrl: string;
  freeQuota: number;
}

interface Provider {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  apiKey?: string;
  priority: number;
  isEnabled: boolean;
  isDefault: boolean;
  healthStatus: string;
  lastCheckedAt?: string;
  lastSyncAt?: string;
  lastError?: string;
  avgLatencyMs: number;
  dailyQuota: number;
  quotaUsed: number;
  rateLimit: number;
  createdAt: string;
  updatedAt: string;
}

interface SyncLog {
  id: string;
  syncType: string;
  status: string;
  durationMs: number;
  recordsProcessed: number;
  recordsFailed: number;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

interface LeagueMapping {
  id: string;
  leagueId: string;
  leagueName: string;
  externalId: string;
  externalName: string;
  createdAt: string;
}

interface DiscoveredLeague {
  externalId: string;
  name: string;
  country: string;
  logoUrl?: string;
}

interface LocalLeague {
  id: string;
  name: string;
  country: string;
}

interface TestResult {
  healthStatus: string;
  avgLatencyMs: number;
  lastError?: string;
}

type ExpandedPanel = "logs" | "mappings" | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium", timeStyle: "short",
  });
}

function fmtMs(ms: number) {
  if (!ms) return "—";
  return `${ms} ms`;
}

function HealthDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    healthy:   "bg-green-500",
    degraded:  "bg-yellow-400",
    unhealthy: "bg-red-500",
    unknown:   "bg-gray-500",
  };
  const color = map[status] ?? "bg-gray-500";
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-blue-600" : "bg-gray-600"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transform transition-transform ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// ─── Create / Edit Modal ─────────────────────────────────────────────────────

interface ProviderFormState {
  name: string;
  type: string;
  baseUrl: string;
  apiKey: string;
  priority: number;
  dailyQuota: number;
  rateLimit: number;
  isEnabled: boolean;
}

const EMPTY_FORM: ProviderFormState = {
  name: "", type: "", baseUrl: "", apiKey: "",
  priority: 5, dailyQuota: 1000, rateLimit: 60, isEnabled: true,
};

interface ProviderModalProps {
  providerTypes: ProviderType[];
  initial?: Provider;
  onClose: () => void;
  onSaved: (p: Provider) => void;
}

function ProviderModal({ providerTypes, initial, onClose, onSaved }: ProviderModalProps) {
  const isEdit = !!initial;
  const [form, setForm] = useState<ProviderFormState>(
    initial
      ? {
          name: initial.name,
          type: initial.type,
          baseUrl: initial.baseUrl,
          apiKey: "",
          priority: initial.priority,
          dailyQuota: initial.dailyQuota,
          rateLimit: initial.rateLimit,
          isEnabled: initial.isEnabled,
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof ProviderFormState>(k: K, v: ProviderFormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const onTypeChange = (type: string) => {
    const pt = providerTypes.find(t => t.type === type);
    set("type", type);
    if (pt && !isEdit) set("baseUrl", pt.defaultBaseUrl);
  };

  const submit = async () => {
    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!form.type) { setError("Provider type is required."); return; }
    if (!form.baseUrl.trim()) { setError("Base URL is required."); return; }
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim(),
        priority: form.priority,
        dailyQuota: form.dailyQuota,
        rateLimit: form.rateLimit,
        isEnabled: form.isEnabled,
      };
      if (!isEdit) {
        body.type = form.type;
        if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();
      }
      const saved = isEdit
        ? await apiFetch<Provider>(`/api/v1/admin/ai/providers/${initial!.id}`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await apiFetch<Provider>("/api/v1/admin/ai/providers", {
            method: "POST",
            headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      onSaved(saved);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to save provider.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            {isEdit ? "Edit Provider" : "Add Provider"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          )}

          <Field label="Name *">
            <input
              type="text"
              value={form.name}
              onChange={e => set("name", e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="My Provider"
            />
          </Field>

          {!isEdit && (
            <Field label="Type *">
              <select
                value={form.type}
                onChange={e => onTypeChange(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select type…</option>
                {providerTypes.map(pt => (
                  <option key={pt.type} value={pt.type}>{pt.name}</option>
                ))}
              </select>
            </Field>
          )}

          <Field label="Base URL *">
            <input
              type="url"
              value={form.baseUrl}
              onChange={e => set("baseUrl", e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="https://api.example.com/v1"
            />
          </Field>

          {!isEdit && (
            <Field label="API Key">
              <input
                type="password"
                value={form.apiKey}
                onChange={e => set("apiKey", e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Leave blank if not required"
                autoComplete="new-password"
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority (1–10)">
              <input
                type="number"
                min={1} max={10}
                value={form.priority}
                onChange={e => set("priority", Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </Field>
            <Field label="Daily Quota">
              <input
                type="number"
                min={0}
                value={form.dailyQuota}
                onChange={e => set("dailyQuota", Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </Field>
          </div>

          <Field label="Rate Limit (req/min)">
            <input
              type="number"
              min={0}
              value={form.rateLimit}
              onChange={e => set("rateLimit", Number(e.target.value))}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </Field>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Enabled</span>
            <Toggle checked={form.isEnabled} onChange={v => set("isEnabled", v)} />
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Provider"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rotate Key Modal ─────────────────────────────────────────────────────────

interface RotateKeyModalProps {
  provider: Provider;
  onClose: () => void;
  onRotated: () => void;
}

function RotateKeyModal({ provider, onClose, onRotated }: RotateKeyModalProps) {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!apiKey.trim()) { setError("API key is required."); return; }
    setSaving(true); setError("");
    try {
      await apiFetch(`/api/v1/admin/ai/providers/${provider.id}/rotate-key`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      onRotated();
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to rotate key.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-yellow-400" />
            Rotate API Key — {provider.name}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          )}
          <p className="text-sm text-gray-400">
            Enter the new API key. The old key will be replaced immediately.
          </p>
          <input
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
            placeholder="New API key"
            autoComplete="new-password"
          />
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="px-5 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {saving ? "Rotating…" : "Rotate Key"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Logs Panel ───────────────────────────────────────────────────────────────

function LogsPanel({ providerId }: { providerId: string }) {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true); setError("");
    apiFetch<SyncLog[]>(`/api/v1/admin/ai/providers/${providerId}/logs`, {
      headers: { Authorization: `Bearer ${tok()}` },
    })
      .then(data => setLogs(data.slice(0, 50)))
      .catch(() => setError("Failed to load logs."))
      .finally(() => setLoading(false));
  }, [providerId]);

  const statusColor = (s: string) =>
    s === "success" ? "text-green-400" : s === "partial" ? "text-yellow-400" : "text-red-400";

  if (loading) return <PanelSpinner />;
  if (error) return <PanelError msg={error} />;
  if (!logs.length) return <PanelEmpty msg="No sync logs yet." />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700">
            <th className="text-left py-2 pr-4">Type</th>
            <th className="text-left py-2 pr-4">Status</th>
            <th className="text-left py-2 pr-4">Duration</th>
            <th className="text-left py-2 pr-4">Records</th>
            <th className="text-left py-2 pr-4">Failed</th>
            <th className="text-left py-2">Started</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b border-gray-800 hover:bg-gray-800/40">
              <td className="py-2 pr-4 text-gray-300 capitalize">{log.syncType}</td>
              <td className={`py-2 pr-4 font-medium capitalize ${statusColor(log.status)}`}>{log.status}</td>
              <td className="py-2 pr-4 text-gray-400">{log.durationMs ? `${log.durationMs} ms` : "—"}</td>
              <td className="py-2 pr-4 text-gray-300">{log.recordsProcessed ?? "—"}</td>
              <td className="py-2 pr-4 text-red-400">{log.recordsFailed || "—"}</td>
              <td className="py-2 text-gray-500">{fmtDate(log.startedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Mappings Panel ───────────────────────────────────────────────────────────

interface MappingsPanelProps {
  provider: Provider;
}

function MappingsPanel({ provider }: MappingsPanelProps) {
  const [mappings, setMappings] = useState<LeagueMapping[]>([]);
  const [localLeagues, setLocalLeagues] = useState<LocalLeague[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState("");
  const [mapTarget, setMapTarget] = useState<DiscoveredLeague | null>(null);
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const [mapping, setMapping] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError("");
    Promise.all([
      apiFetch<LeagueMapping[]>(`/api/v1/admin/ai/providers/${provider.id}/mappings`, {
        headers: { Authorization: `Bearer ${tok()}` },
      }),
      apiFetch<LocalLeague[]>("/api/v1/admin/football/leagues", {
        headers: { Authorization: `Bearer ${tok()}` },
      }),
    ])
      .then(([m, l]) => { setMappings(m); setLocalLeagues(l); })
      .catch(() => setError("Failed to load mappings."))
      .finally(() => setLoading(false));
  }, [provider.id]);

  useEffect(() => { load(); }, [load]);

  const discover = async () => {
    setDiscovering(true); setError("");
    try {
      const data = await apiFetch<DiscoveredLeague[]>(
        `/api/v1/admin/ai/providers/${provider.id}/discover`,
        { headers: { Authorization: `Bearer ${tok()}` } }
      );
      setDiscovered(data);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Discovery failed.");
    } finally {
      setDiscovering(false);
    }
  };

  const addMapping = async () => {
    if (!mapTarget || !selectedLeagueId) return;
    setMapping(true);
    try {
      const created = await apiFetch<LeagueMapping>(
        `/api/v1/admin/ai/providers/${provider.id}/mappings`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            leagueId: selectedLeagueId,
            externalId: mapTarget.externalId,
            externalName: mapTarget.name,
          }),
        }
      );
      setMappings(prev => [...prev, created]);
      setMapTarget(null);
      setSelectedLeagueId("");
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to create mapping.");
    } finally {
      setMapping(false);
    }
  };

  const deleteMapping = async (id: string) => {
    setDeletingId(id);
    try {
      await apiFetch(`/api/v1/admin/ai/providers/mappings/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok()}` },
      });
      setMappings(prev => prev.filter(m => m.id !== id));
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to delete mapping.");
    } finally {
      setDeletingId(null);
    }
  };

  const mappedExternalIds = new Set(mappings.map(m => m.externalId));

  if (loading) return <PanelSpinner />;

  return (
    <div className="space-y-5">
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Existing mappings */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Active Mappings ({mappings.length})
        </h4>
        {mappings.length === 0 ? (
          <PanelEmpty msg="No league mappings yet. Discover leagues below to add one." />
        ) : (
          <div className="space-y-1">
            {mappings.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between bg-gray-800/60 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Link className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                  <span className="text-white">{m.leagueName}</span>
                  <span className="text-gray-500">↔</span>
                  <span className="text-gray-300">{m.externalName}</span>
                  <span className="text-gray-600 text-xs">({m.externalId})</span>
                </div>
                <button
                  onClick={() => deleteMapping(m.id)}
                  disabled={deletingId === m.id}
                  className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-40 ml-2"
                  title="Remove mapping"
                >
                  <Unlink className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Discover section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Discovered Leagues {discovered.length > 0 && `(${discovered.length})`}
          </h4>
          <button
            onClick={discover}
            disabled={discovering}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            {discovering ? "Discovering…" : "Discover Leagues"}
          </button>
        </div>

        {discovered.length > 0 && (
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {discovered.map(dl => {
              const alreadyMapped = mappedExternalIds.has(dl.externalId);
              return (
                <div
                  key={dl.externalId}
                  className="flex items-center justify-between bg-gray-800/40 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    {dl.logoUrl && (
                      <img src={dl.logoUrl} alt="" className="w-5 h-5 object-contain rounded" />
                    )}
                    <div>
                      <span className="text-sm text-white">{dl.name}</span>
                      <span className="text-xs text-gray-500 ml-2">{dl.country}</span>
                    </div>
                  </div>
                  {alreadyMapped ? (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> Mapped
                    </span>
                  ) : (
                    <button
                      onClick={() => { setMapTarget(dl); setSelectedLeagueId(""); }}
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Map
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Map dialog inline */}
      {mapTarget && (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-300">
            Map <span className="text-white font-medium">{mapTarget.name}</span> to local league:
          </p>
          <select
            value={selectedLeagueId}
            onChange={e => setSelectedLeagueId(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Select local league…</option>
            {localLeagues.map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.country})</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={addMapping}
              disabled={!selectedLeagueId || mapping}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {mapping ? "Saving…" : "Confirm Mapping"}
            </button>
            <button
              onClick={() => setMapTarget(null)}
              className="px-4 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small shared sub-components ─────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  );
}

function PanelSpinner() {
  return (
    <div className="flex justify-center py-6">
      <RefreshCw className="w-5 h-5 text-gray-500 animate-spin" />
    </div>
  );
}

function PanelError({ msg }: { msg: string }) {
  return (
    <div className="bg-red-900/30 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
      {msg}
    </div>
  );
}

function PanelEmpty({ msg }: { msg: string }) {
  return <p className="text-sm text-gray-500 py-2">{msg}</p>;
}

// ─── Provider Card ────────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: Provider;
  providerTypes: ProviderType[];
  onEdit: (p: Provider) => void;
  onDelete: (p: Provider) => void;
  onRotateKey: (p: Provider) => void;
  onUpdated: (p: Provider) => void;
}

function ProviderCard({
  provider, providerTypes, onEdit, onDelete, onRotateKey, onUpdated,
}: ProviderCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState("");
  const [toggling, setToggling] = useState(false);
  const [expanded, setExpanded] = useState<ExpandedPanel>(null);

  const typeName = providerTypes.find(t => t.type === provider.type)?.name ?? provider.type;

  const toggle = (panel: ExpandedPanel) =>
    setExpanded(prev => (prev === panel ? null : panel));

  const testConnection = async () => {
    setTesting(true); setTestResult(null); setTestError("");
    try {
      const result = await apiFetch<TestResult>(
        `/api/v1/admin/ai/providers/${provider.id}/test`,
        { method: "POST", headers: { Authorization: `Bearer ${tok()}` } }
      );
      setTestResult(result);
    } catch (e: unknown) {
      setTestError((e as Error).message ?? "Test failed.");
    } finally {
      setTesting(false);
    }
  };

  const toggleEnabled = async () => {
    setToggling(true);
    try {
      const updated = await apiFetch<Provider>(
        `/api/v1/admin/ai/providers/${provider.id}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ isEnabled: !provider.isEnabled }),
        }
      );
      onUpdated(updated);
    } catch {
      // silently fail — toggle snaps back via parent state
    } finally {
      setToggling(false);
    }
  };

  const quotaPct = provider.dailyQuota > 0
    ? Math.min(100, Math.round((provider.quotaUsed / provider.dailyQuota) * 100))
    : 0;

  const quotaColor = quotaPct >= 90 ? "bg-red-500" : quotaPct >= 70 ? "bg-yellow-500" : "bg-blue-500";

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
      provider.isEnabled ? "border-gray-700" : "border-gray-800 opacity-75"
    }`}>
      {/* Card header */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: name + badges */}
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5">
              <HealthDot status={provider.healthStatus} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-semibold text-white truncate">{provider.name}</h3>
                {provider.isDefault && (
                  <span className="px-2 py-0.5 bg-blue-900/60 text-blue-300 text-xs rounded-full border border-blue-700">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                  {typeName}
                </span>
                <span className="px-2 py-0.5 bg-gray-700 text-gray-300 text-xs rounded-full">
                  Priority {provider.priority}
                </span>
                <span className={`text-xs capitalize ${
                  provider.healthStatus === "healthy" ? "text-green-400" :
                  provider.healthStatus === "degraded" ? "text-yellow-400" :
                  provider.healthStatus === "unhealthy" ? "text-red-400" : "text-gray-500"
                }`}>
                  {provider.healthStatus}
                </span>
              </div>
            </div>
          </div>

          {/* Right: enable toggle */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-500">{provider.isEnabled ? "Enabled" : "Disabled"}</span>
            <div className={toggling ? "opacity-50 pointer-events-none" : ""}>
              <Toggle checked={provider.isEnabled} onChange={toggleEnabled} />
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat label="Avg Latency" value={fmtMs(provider.avgLatencyMs)} />
          <Stat label="Last Sync" value={fmtDate(provider.lastSyncAt)} />
          <Stat label="Last Checked" value={fmtDate(provider.lastCheckedAt)} />
          <Stat label="Quota Used">
            <div className="text-xs text-gray-300">
              {provider.quotaUsed} / {provider.dailyQuota}
            </div>
            <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${quotaColor}`} style={{ width: `${quotaPct}%` }} />
            </div>
          </Stat>
        </div>

        {/* Last error */}
        {provider.lastError && (
          <div className="mt-3 flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300 break-all">{provider.lastError}</p>
          </div>
        )}

        {/* Test result */}
        {testResult && (
          <div className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 border text-xs ${
            testResult.healthStatus === "healthy"
              ? "bg-green-900/30 border-green-800 text-green-300"
              : "bg-yellow-900/30 border-yellow-800 text-yellow-300"
          }`}>
            {testResult.healthStatus === "healthy"
              ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
            <span>
              Status: <strong>{testResult.healthStatus}</strong>
              {testResult.avgLatencyMs != null && ` · ${testResult.avgLatencyMs} ms`}
              {testResult.lastError && ` · ${testResult.lastError}`}
            </span>
          </div>
        )}
        {testError && (
          <div className="mt-3 flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-300">{testError}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mt-4">
          <ActionBtn
            icon={<Zap className="w-3.5 h-3.5" />}
            label={testing ? "Testing…" : "Test Connection"}
            onClick={testConnection}
            disabled={testing}
            color="indigo"
          />
          <ActionBtn
            icon={<RefreshCw className="w-3.5 h-3.5" />}
            label={expanded === "logs" ? "Hide Logs" : "View Logs"}
            onClick={() => toggle("logs")}
            color="gray"
            active={expanded === "logs"}
          />
          <ActionBtn
            icon={<Globe className="w-3.5 h-3.5" />}
            label={expanded === "mappings" ? "Hide Mappings" : "Manage Mappings"}
            onClick={() => toggle("mappings")}
            color="gray"
            active={expanded === "mappings"}
          />
          <ActionBtn
            icon={<Edit2 className="w-3.5 h-3.5" />}
            label="Edit"
            onClick={() => onEdit(provider)}
            color="gray"
          />
          <ActionBtn
            icon={<Key className="w-3.5 h-3.5" />}
            label="Rotate Key"
            onClick={() => onRotateKey(provider)}
            color="yellow"
          />
          <ActionBtn
            icon={<Trash2 className="w-3.5 h-3.5" />}
            label="Delete"
            onClick={() => onDelete(provider)}
            color="red"
          />
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            {expanded === "logs" ? (
              <>
                <RefreshCw className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-medium text-gray-300">Sync Logs</h4>
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 text-gray-400" />
                <h4 className="text-sm font-medium text-gray-300">League Mappings</h4>
              </>
            )}
          </div>
          {expanded === "logs" ? (
            <LogsPanel providerId={provider.id} />
          ) : (
            <MappingsPanel provider={provider} />
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label, value, children,
}: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      {children ?? <p className="text-xs text-gray-300 mt-0.5 truncate">{value}</p>}
    </div>
  );
}

interface ActionBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color: "indigo" | "gray" | "yellow" | "red";
  active?: boolean;
}

function ActionBtn({ icon, label, onClick, disabled, color, active }: ActionBtnProps) {
  const colors = {
    indigo: "bg-indigo-700 hover:bg-indigo-600 text-white",
    gray: active
      ? "bg-gray-600 hover:bg-gray-500 text-white"
      : "bg-gray-700 hover:bg-gray-600 text-gray-200",
    yellow: "bg-yellow-700 hover:bg-yellow-600 text-white",
    red: "bg-red-900/60 hover:bg-red-800 text-red-300 hover:text-white",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${colors[color]}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

interface DeleteModalProps {
  provider: Provider;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

function DeleteModal({ provider, onClose, onDeleted }: DeleteModalProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setDeleting(true); setError("");
    try {
      await apiFetch(`/api/v1/admin/ai/providers/${provider.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${tok()}` },
      });
      onDeleted(provider.id);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Failed to delete provider.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-sm mx-4">
        <div className="px-6 py-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-red-900/40 rounded-full">
              <Trash2 className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-base font-semibold text-white">Delete Provider</h2>
          </div>
          <p className="text-sm text-gray-400">
            Are you sure you want to delete <span className="text-white font-medium">{provider.name}</span>?
            This will remove all its mappings and cannot be undone.
          </p>
          {error && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-2 text-sm">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={deleting}
            className="px-5 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [providerTypes, setProviderTypes] = useState<ProviderType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Provider | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [rotateTarget, setRotateTarget] = useState<Provider | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError("");
    Promise.all([
      apiFetch<ProviderType[]>("/api/v1/admin/ai/provider-types", {
        headers: { Authorization: `Bearer ${tok()}` },
      }),
      apiFetch<Provider[]>("/api/v1/admin/ai/providers", {
        headers: { Authorization: `Bearer ${tok()}` },
      }),
    ])
      .then(([types, provs]) => { setProviderTypes(types); setProviders(provs); })
      .catch(() => setError("Failed to load providers."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSaved = (saved: Provider) => {
    setProviders(prev => {
      const idx = prev.findIndex(p => p.id === saved.id);
      return idx >= 0 ? prev.map(p => p.id === saved.id ? saved : p) : [...prev, saved];
    });
    setShowCreate(false);
    setEditTarget(null);
  };

  const onUpdated = (updated: Provider) =>
    setProviders(prev => prev.map(p => p.id === updated.id ? updated : p));

  const onDeleted = (id: string) => {
    setProviders(prev => prev.filter(p => p.id !== id));
    setDeleteTarget(null);
  };

  const onRotated = () => setRotateTarget(null);

  const sorted = [...providers].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Page header */}
      <div className="border-b border-gray-800 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" />
              Data Providers
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage external football data API integrations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-sm rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Provider
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-6 py-6 max-w-5xl">
        {loading && providers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <span className="text-sm">Loading providers…</span>
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-5 py-3 mb-6 flex items-center gap-3">
            <XCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
            <button onClick={load} className="ml-auto text-xs underline hover:text-white transition-colors">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && providers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-gray-500">
            <HelpCircle className="w-12 h-12" />
            <div className="text-center">
              <p className="text-base text-gray-400 font-medium">No providers yet</p>
              <p className="text-sm mt-1">Add your first data provider to start syncing football data.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Provider
            </button>
          </div>
        )}

        <div className="space-y-4">
          {sorted.map(p => (
            <ProviderCard
              key={p.id}
              provider={p}
              providerTypes={providerTypes}
              onEdit={setEditTarget}
              onDelete={setDeleteTarget}
              onRotateKey={setRotateTarget}
              onUpdated={onUpdated}
            />
          ))}
        </div>
      </div>

      {/* Modals */}
      {showCreate && (
        <ProviderModal
          providerTypes={providerTypes}
          onClose={() => setShowCreate(false)}
          onSaved={onSaved}
        />
      )}
      {editTarget && (
        <ProviderModal
          providerTypes={providerTypes}
          initial={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={onSaved}
        />
      )}
      {deleteTarget && (
        <DeleteModal
          provider={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={onDeleted}
        />
      )}
      {rotateTarget && (
        <RotateKeyModal
          provider={rotateTarget}
          onClose={() => setRotateTarget(null)}
          onRotated={onRotated}
        />
      )}
    </div>
  );
}

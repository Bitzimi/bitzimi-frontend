import { useState, useEffect, useCallback } from "react";
import { ToggleLeft, ToggleRight, RefreshCw, CheckCircle2, AlertTriangle, Loader2, Zap, Shield } from "lucide-react";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "API error"), { status: res.status });
  return json.data as T;
}

type AccessLevel = "all" | "vip" | "staff" | "admin" | "disabled";

interface FeatureFlag {
  name:        string;
  key:         string;
  enabled:     boolean;
  description: string | null;
  updatedAt:   string;
  updatedBy:   string | null;
}

interface AccessEntry {
  name:        string;
  key:         string;
  level:       AccessLevel;
  description: string | null;
  updatedAt:   string;
  updatedBy:   string | null;
}

interface FeaturesData {
  flags:        FeatureFlag[];
  accessLevels: AccessEntry[];
}

const LEVEL_LABELS: Record<AccessLevel, string> = {
  all:      "All Users",
  vip:      "VIP Only",
  staff:    "Staff Only",
  admin:    "Admin Only",
  disabled: "Disabled",
};

const LEVEL_COLORS: Record<AccessLevel, string> = {
  all:      "bg-green-500/20 text-green-300 border-green-500/30",
  vip:      "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  staff:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  admin:    "bg-purple-500/20 text-purple-300 border-purple-500/30",
  disabled: "bg-red-500/20 text-red-300 border-red-500/30",
};

const ACCESS_LEVELS: AccessLevel[] = ["all", "vip", "staff", "admin", "disabled"];

export default function AdminFeaturesPage() {
  const { hasPermission } = useAdminAccess();
  const canEdit = hasPermission("admin.config.edit");

  const [data, setData]           = useState<FeaturesData>({ flags: [], accessLevels: [] });
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<FeaturesData>("/api/v1/admin/features");
      setData(result);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleFlag = async (flag: FeatureFlag) => {
    if (!canEdit || saving) return;
    setSaving(flag.name);
    try {
      await apiFetch(`/api/v1/admin/features/flag/${flag.name}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !flag.enabled }),
      });
      showToast(`${flag.name} ${!flag.enabled ? "enabled" : "disabled"}`);
      await load();
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSaving(null);
    }
  };

  const setAccessLevel = async (entry: AccessEntry, level: AccessLevel) => {
    if (!canEdit || saving || entry.level === level) return;
    setSaving(entry.name);
    try {
      await apiFetch(`/api/v1/admin/features/access/${entry.name}`, {
        method: "PUT",
        body: JSON.stringify({ level }),
      });
      showToast(`${entry.name} access set to: ${LEVEL_LABELS[level]}`);
      await load();
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="h-7 w-7 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Feature Management</h1>
            <p className="text-sm text-gray-400">Control feature availability and access levels platform-wide. Changes take effect immediately.</p>
          </div>
        </div>
        <button onClick={load} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
          toast.ok ? "bg-green-500/20 border border-green-500/40 text-green-300" : "bg-red-500/20 border border-red-500/40 text-red-300"
        }`}>
          {toast.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div>
      ) : (
        <>
          {/* Access Level Control — VIP/Staff/Admin gates */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Feature Access Levels</h2>
              <span className="text-xs text-gray-500 ml-1">— who can access each feature</span>
            </div>
            <div className="text-xs text-gray-500 mb-4 bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-3">
              <strong className="text-gray-300">Access levels:</strong>{" "}
              <span className="text-green-400">All Users</span> — any authenticated user ·{" "}
              <span className="text-yellow-400">VIP Only</span> — VIP subscribers + admins ·{" "}
              <span className="text-blue-400">Staff Only</span> — admin roles only ·{" "}
              <span className="text-purple-400">Admin Only</span> — super_admin only ·{" "}
              <span className="text-red-400">Disabled</span> — feature off for everyone
            </div>
            <div className="space-y-2">
              {data.accessLevels.map(entry => (
                <div key={entry.name} className="bg-gray-800/40 border border-gray-700/50 rounded-xl px-5 py-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-white font-semibold">{entry.name}</p>
                      {entry.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{entry.description}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ACCESS_LEVELS.map(level => (
                        <button
                          key={level}
                          disabled={!canEdit || saving === entry.name}
                          onClick={() => setAccessLevel(entry, level)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors disabled:opacity-50 ${
                            entry.level === level
                              ? LEVEL_COLORS[level]
                              : "bg-transparent border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                          }`}
                        >
                          {LEVEL_LABELS[level]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {data.accessLevels.length === 0 && (
                <p className="text-sm text-gray-500 py-6 text-center">No feature access levels configured.</p>
              )}
            </div>
          </section>

          {/* Boolean Feature Flags */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ToggleRight className="h-5 w-5 text-purple-400" />
              <h2 className="text-lg font-semibold text-white">Feature Flags</h2>
              <span className="text-xs text-gray-500 ml-1">— enable or disable individual features</span>
            </div>
            <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Feature</th>
                    <th className="text-left px-5 py-3 hidden sm:table-cell">Description</th>
                    <th className="text-right px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {data.flags.map(flag => (
                    <tr key={flag.name} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className="font-mono text-xs text-purple-300">{flag.name}</span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="text-xs text-gray-500">{flag.description ?? "—"}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        {canEdit ? (
                          <button
                            onClick={() => toggleFlag(flag)}
                            disabled={saving === flag.name}
                            className="transition-opacity disabled:opacity-40"
                            title={flag.enabled ? "Disable" : "Enable"}
                          >
                            {flag.enabled
                              ? <ToggleRight className="h-6 w-6 text-green-400" />
                              : <ToggleLeft className="h-6 w-6 text-gray-500" />}
                          </button>
                        ) : (
                          <span className={`text-xs font-medium ${flag.enabled ? "text-green-400" : "text-gray-500"}`}>
                            {flag.enabled ? "On" : "Off"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.flags.length === 0 && (
                    <tr><td colSpan={3} className="py-10 text-center text-gray-500">No feature flags configured.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

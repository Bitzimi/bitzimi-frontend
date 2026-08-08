import { useState, useEffect, useMemo } from "react";
import { Settings, Search, Save, RefreshCw, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function configFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "API error"), { status: res.status });
  return json.data as T;
}

interface ConfigEntry {
  key: string;
  value: any;
  rawValue: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

// Group keys by their prefix segment
function getCategory(key: string): string {
  const parts = key.split(".");
  if (parts.length < 2) return "other";
  const prefix = parts[0];
  const LABELS: Record<string, string> = {
    maintenance:  "Maintenance",
    feature:      "Feature Flags",
    platform:     "Platform Settings",
    withdrawal:   "Withdrawal Settings",
    deposit:      "Deposit Settings",
    game:         "Game Configuration",
    referral:     "Referral & Commissions",
    affiliate:    "Affiliate Program",
    ambassador:   "Ambassador Program",
    vip:          "VIP & Streak",
    football:     "Football Points",
    promotions:   "Promotions",
    auction:      "Auction",
    text:         "Platform Text",
  };
  return LABELS[prefix] ?? "Other";
}

function formatValue(v: any): string {
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  return String(v ?? "");
}

function parseValue(raw: string): any {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  const num = Number(trimmed);
  if (!isNaN(num) && trimmed !== "") return num;
  try { return JSON.parse(trimmed); } catch { return trimmed; }
}

export default function AdminSettingsPage() {
  const { can } = useAdminAccess();

  const [entries, setEntries]   = useState<ConfigEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [search, setSearch]     = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Track edited values per key
  const [edits, setEdits]       = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<Set<string>>(new Set());
  const [saved, setSaved]       = useState<Set<string>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const canEdit = can("admin.config.edit");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await configFetch<ConfigEntry[]>("/api/v1/admin/config");
      setEntries(data);
      // Initialise edits with current raw values
      const initial: Record<string, string> = {};
      for (const e of data) initial[e.key] = formatValue(e.value);
      setEdits(initial);
    } catch (err: any) {
      setError(err.message ?? "Failed to load config");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(e =>
      e.key.toLowerCase().includes(q) ||
      (e.description ?? "").toLowerCase().includes(q) ||
      formatValue(e.value).toLowerCase().includes(q)
    );
  }, [entries, search]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, ConfigEntry[]>();
    for (const e of filtered) {
      const cat = getCategory(e.key);
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handleSave = async (key: string) => {
    if (!canEdit) return;
    const rawEdit = edits[key] ?? "";
    const parsed  = parseValue(rawEdit);

    setSaving(prev => new Set(prev).add(key));
    setSaveErrors(prev => { const n = { ...prev }; delete n[key]; return n; });

    try {
      await configFetch(`/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value: parsed }),
      });
      // Update local entry
      setEntries(prev => prev.map(e => e.key === key ? { ...e, value: parsed, rawValue: JSON.stringify(parsed) } : e));
      setSaved(prev => new Set(prev).add(key));
      setTimeout(() => setSaved(prev => { const n = new Set(prev); n.delete(key); return n; }), 2000);
    } catch (err: any) {
      setSaveErrors(prev => ({ ...prev, [key]: err.message ?? "Save failed" }));
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(key); return n; });
    }
  };

  const isDirty = (e: ConfigEntry) => edits[e.key] !== undefined && edits[e.key] !== formatValue(e.value);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <Settings className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Platform Settings</h1>
            <p className="text-xs text-zinc-500">System configuration — {entries.length} keys</p>
          </div>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-xs text-zinc-400 hover:text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search settings by key, description or value…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-white/[0.07] text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
        />
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="rounded-2xl bg-[#18181b] border border-red-500/20 p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-zinc-300 mb-3">{error}</p>
          <button onClick={load} className="text-xs text-indigo-400 hover:text-indigo-300">Retry</button>
        </div>
      )}

      {/* Config groups */}
      {!loading && !error && grouped.map(([category, items]) => {
        const open = !collapsed.has(category);
        return (
          <div key={category} className="rounded-2xl bg-[#18181b] border border-white/[0.06] overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{category}</span>
                <span className="text-xs text-zinc-500 bg-zinc-800/60 border border-white/[0.05] rounded-full px-2 py-0.5">{items.length}</span>
              </div>
              {open ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
            </button>

            {open && (
              <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                {items.map(entry => {
                  const dirty   = isDirty(entry);
                  const isSaving = saving.has(entry.key);
                  const isSaved  = saved.has(entry.key);
                  const errMsg   = saveErrors[entry.key];

                  return (
                    <div key={entry.key} className="px-5 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <code className="text-xs font-mono text-indigo-300">{entry.key}</code>
                            {dirty && <span className="text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-full px-1.5 py-px">unsaved</span>}
                          </div>
                          {entry.description && (
                            <p className="text-[11px] text-zinc-500 mb-2 leading-relaxed">{entry.description}</p>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              value={edits[entry.key] ?? formatValue(entry.value)}
                              onChange={ev => setEdits(prev => ({ ...prev, [entry.key]: ev.target.value }))}
                              disabled={!canEdit}
                              className="flex-1 text-xs font-mono bg-zinc-900 border border-white/[0.07] rounded-lg px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                            {canEdit && dirty && (
                              <button
                                onClick={() => handleSave(entry.key)}
                                disabled={isSaving}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors disabled:opacity-50 flex-shrink-0"
                              >
                                {isSaving ? (
                                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Save className="w-3 h-3" />
                                )}
                                Save
                              </button>
                            )}
                            {isSaved && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                            )}
                          </div>
                          {errMsg && <p className="text-[11px] text-red-400 mt-1">{errMsg}</p>}
                        </div>
                        <div className="text-right flex-shrink-0 text-[10px] text-zinc-600 leading-relaxed">
                          <div>Updated {new Date(entry.updatedAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {!loading && !error && grouped.length === 0 && (
        <div className="rounded-2xl bg-[#18181b] border border-white/[0.06] p-10 text-center">
          <p className="text-sm text-zinc-500">No settings match your search.</p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  Type, RefreshCw, Download, Upload, Zap, CheckCircle2, AlertTriangle,
  Search, ChevronDown, ChevronRight, Globe, Loader2, ThumbsUp, Clock,
} from "lucide-react";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
  });
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "API error"), { status: res.status });
  return json.data as T;
}

// ── Backend response shapes ────────────────────────────────────────────────────

interface LangSummary {
  languageCode:  string;
  languageName:  string;
  total:         number;
  translated:    number;
  missing:       number;
  percentage:    number;
}

interface MissingKey {
  key:          string;
  namespace:    string;
  defaultValue: string;
}

interface PendingTranslation {
  key:          string;
  namespace:    string;
  defaultValue: string;
  value:        string;
}

// ── Component ─────────────────────────────────────────────────────────────────

type ExpandedPanel = "missing" | "pending" | null;

export default function AdminTranslationsPage() {
  const { hasPermission } = useAdminAccess();
  const canEdit = hasPermission("admin.config.edit");

  const [summary, setSummary]           = useState<LangSummary[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selected, setSelected]         = useState<string | null>(null);
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>(null);
  const [missing, setMissing]           = useState<MissingKey[]>([]);
  const [pending, setPending]           = useState<PendingTranslation[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [autoRunning, setAutoRunning]   = useState(false);
  const [approveRunning, setApproveRunning] = useState(false);
  const [toast, setToast]               = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch]             = useState("");

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<LangSummary[]>("/api/v1/admin/translation/summary");
      setSummary(data);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  const openPanel = async (code: string, panel: ExpandedPanel) => {
    // Toggle off if same panel same lang
    if (selected === code && expandedPanel === panel) {
      setSelected(null);
      setExpandedPanel(null);
      setMissing([]);
      setPending([]);
      return;
    }
    setSelected(code);
    setExpandedPanel(panel);
    setPanelLoading(true);
    try {
      if (panel === "missing") {
        const data = await apiFetch<MissingKey[]>(`/api/v1/admin/translation/${code}/missing`);
        setMissing(data);
      } else if (panel === "pending") {
        const data = await apiFetch<PendingTranslation[]>(`/api/v1/admin/translation/${code}/pending`);
        setPending(data);
      }
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setPanelLoading(false);
    }
  };

  const autoTranslate = async (code: string) => {
    if (!canEdit || autoRunning) return;
    setAutoRunning(true);
    showToast(`Starting AI auto-translation for ${code}…`);
    try {
      const result = await apiFetch<{ translated: number; skipped: number }>(`/api/v1/admin/translation/${code}/auto`, {
        method: "POST",
        body: JSON.stringify({ missingOnly: true }),
      });
      showToast(`Translated ${result.translated} keys${result.skipped ? `, ${result.skipped} skipped` : ""}`, true);
      await loadSummary();
      // Refresh open panel
      if (selected === code && expandedPanel === "missing") {
        const data = await apiFetch<MissingKey[]>(`/api/v1/admin/translation/${code}/missing`);
        setMissing(data);
      }
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setAutoRunning(false);
    }
  };

  const approveAll = async (code: string) => {
    if (!canEdit || approveRunning) return;
    setApproveRunning(true);
    try {
      const result = await apiFetch<{ approved: number }>(`/api/v1/admin/translation/${code}/approve-all`, { method: "POST" });
      showToast(`Approved ${result.approved} translations for ${code}`);
      await loadSummary();
      if (selected === code && expandedPanel === "pending") {
        setPending([]);
      }
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setApproveRunning(false);
    }
  };

  const approveOne = async (code: string, key: string) => {
    if (!canEdit) return;
    try {
      await apiFetch(`/api/v1/admin/translation/${code}/${encodeURIComponent(key)}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ approved: true }),
      });
      setPending(prev => prev.filter(p => p.key !== key));
      showToast(`Approved: ${key}`);
      await loadSummary();
    } catch (e: any) {
      showToast(e.message, false);
    }
  };

  const exportLang = async (code: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/admin/translation/${code}/export`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const json = await res.json();
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `translations-${code}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported translations for ${code}`);
    } catch (e: any) {
      showToast(e.message, false);
    }
  };

  const importLang = async (code: string, file: File) => {
    if (!canEdit) return;
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      await apiFetch(`/api/v1/admin/translation/${code}/import`, {
        method: "POST",
        body: JSON.stringify({ bundle }),
      });
      showToast(`Imported translations for ${code}`);
      await loadSummary();
    } catch (e: any) {
      showToast(e.message, false);
    }
  };

  const filtered = summary.filter(l =>
    l.languageName.toLowerCase().includes(search.toLowerCase()) ||
    l.languageCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Type className="h-7 w-7 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Translations</h1>
            <p className="text-sm text-gray-400">Manage platform translations, run AI auto-translation, review pending approvals</p>
          </div>
        </div>
        <button onClick={loadSummary} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search languages…"
          className="w-full pl-9 pr-4 py-2.5 bg-gray-800/60 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60" />
      </div>

      {/* Language cards */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 text-purple-400 animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map(lang => {
            const isExpanded = selected === lang.languageCode;
            const pendingCount = isExpanded && expandedPanel === "pending" ? pending.length : 0;

            return (
              <div key={lang.languageCode} className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <button onClick={() => openPanel(lang.languageCode, "missing")} className="flex-1 flex items-center gap-4 text-left">
                    <Globe className="h-6 w-6 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{lang.languageName}</span>
                        <span className="font-mono text-xs text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">{lang.languageCode}</span>
                        {lang.missing > 0 && (
                          <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                            {lang.missing} missing
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 bg-gray-700 rounded-full h-1.5">
                          <div className="bg-purple-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${lang.percentage}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {lang.translated}/{lang.total} ({lang.percentage}%)
                        </span>
                      </div>
                    </div>
                    {isExpanded
                      ? <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      : <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                  </button>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Pending approvals button */}
                    <button
                      onClick={() => openPanel(lang.languageCode, "pending")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isExpanded && expandedPanel === "pending"
                          ? "bg-blue-600 text-white"
                          : "text-gray-400 hover:text-white hover:bg-gray-700"
                      }`}
                      title="Review pending approvals"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      Pending
                    </button>

                    {lang.missing > 0 && canEdit && (
                      <button onClick={() => autoTranslate(lang.languageCode)} disabled={autoRunning}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/80 hover:bg-violet-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
                        {autoRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                        AI Translate ({lang.missing})
                      </button>
                    )}
                    <button onClick={() => exportLang(lang.languageCode)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors" title="Export JSON">
                      <Download className="h-4 w-4" />
                    </button>
                    {canEdit && (
                      <label className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors cursor-pointer" title="Import JSON">
                        <Upload className="h-4 w-4" />
                        <input type="file" accept=".json" className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) importLang(lang.languageCode, f);
                            e.target.value = "";
                          }} />
                      </label>
                    )}
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="border-t border-gray-700/50 px-5 py-4">
                    {panelLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 text-purple-400 animate-spin" /></div>
                    ) : expandedPanel === "missing" ? (
                      missing.length === 0 ? (
                        <div className="flex items-center gap-2 text-green-400 text-sm">
                          <CheckCircle2 className="h-4 w-4" />
                          All keys are translated for this language
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-xs text-gray-400 mb-3">{missing.length} missing translation{missing.length !== 1 ? "s" : ""}</p>
                          <div className="max-h-48 overflow-y-auto space-y-1.5">
                            {missing.map(k => (
                              <div key={k.key} className="flex items-start gap-3 bg-gray-900/40 rounded-lg px-3 py-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-mono text-xs text-purple-300">{k.key}</p>
                                  <p className="text-xs text-gray-400 truncate">{k.defaultValue}</p>
                                </div>
                                <span className="text-xs text-gray-600 bg-gray-800 px-1.5 py-0.5 rounded">{k.namespace}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ) : expandedPanel === "pending" ? (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs text-gray-400">
                            {pending.length === 0
                              ? "No pending approvals"
                              : `${pending.length} auto-translated string${pending.length !== 1 ? "s" : ""} awaiting review`}
                          </p>
                          {pending.length > 0 && canEdit && (
                            <button
                              onClick={() => approveAll(lang.languageCode)}
                              disabled={approveRunning}
                              className="flex items-center gap-1.5 px-3 py-1 bg-green-600/80 hover:bg-green-600 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                            >
                              {approveRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <ThumbsUp className="h-3 w-3" />}
                              Approve All
                            </button>
                          )}
                        </div>
                        {pending.length === 0 ? (
                          <div className="flex items-center gap-2 text-green-400 text-sm">
                            <CheckCircle2 className="h-4 w-4" />
                            All auto-translations have been reviewed
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto space-y-2">
                            {pending.map(item => (
                              <div key={item.key} className="bg-gray-900/40 rounded-lg px-3 py-2.5 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-mono text-xs text-purple-300 truncate">{item.key}</p>
                                  {canEdit && (
                                    <button
                                      onClick={() => approveOne(lang.languageCode, item.key)}
                                      className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 bg-green-600/60 hover:bg-green-600 text-green-200 rounded text-xs transition-colors"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                      Approve
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>
                                    <p className="text-gray-500 mb-0.5">English</p>
                                    <p className="text-gray-300 truncate">{item.defaultValue}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 mb-0.5">Translated</p>
                                    <p className="text-blue-300 truncate">{item.value}</p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import {
  Globe, Plus, Save, Trash2, RefreshCw, CheckCircle2, AlertTriangle,
  ToggleLeft, ToggleRight, ArrowUp, ArrowDown, Star,
} from "lucide-react";
import { useAdminAccess } from "../../hooks/useAdminAccess";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";

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

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string | null;
  direction: "ltr" | "rtl";
  isDefault: boolean;
  isEnabled: boolean;
  sortOrder: number;
}

const EMPTY_FORM = { code: "", name: "", nativeName: "", flag: "", direction: "ltr" as "ltr" | "rtl", sortOrder: "999" };

export default function AdminLanguagesPage() {
  const { hasPermission } = useAdminAccess();
  const canEdit = hasPermission("admin.config.edit");

  const [languages, setLanguages]   = useState<Language[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [showAdd, setShowAdd]       = useState(false);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Language | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Language[]>("/api/v1/admin/language");
      setLanguages(data);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (lang: Language, field: "isEnabled" | "isDefault") => {
    if (!canEdit) return;
    setSaving(lang.code + field);
    try {
      await apiFetch(`/api/v1/admin/language/${lang.code}`, {
        method: "PUT",
        body: JSON.stringify({ [field]: !lang[field] }),
      });
      await load();
      showToast(field === "isDefault" ? `${lang.name} set as default` : `${lang.name} ${!lang.isEnabled ? "enabled" : "disabled"}`);
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSaving(null);
    }
  };

  const reorder = async (lang: Language, dir: -1 | 1) => {
    if (!canEdit) return;
    const newOrder = lang.sortOrder + dir;
    setSaving(lang.code + "order");
    try {
      await apiFetch(`/api/v1/admin/language/${lang.code}`, {
        method: "PUT",
        body: JSON.stringify({ sortOrder: newOrder }),
      });
      await load();
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSaving(null);
    }
  };

  const addLanguage = async () => {
    if (!canEdit) return;
    setSaving("new");
    try {
      await apiFetch("/api/v1/admin/language", {
        method: "POST",
        body: JSON.stringify({
          code: form.code.toLowerCase().trim(),
          name: form.name.trim(),
          nativeName: form.nativeName.trim(),
          flag: form.flag.trim() || null,
          direction: form.direction,
          sortOrder: Number(form.sortOrder),
        }),
      });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      await load();
      showToast("Language added");
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSaving(null);
    }
  };

  const deleteLang = async () => {
    if (!deleteTarget || !canEdit) return;
    setSaving(deleteTarget.code + "del");
    try {
      await apiFetch(`/api/v1/admin/language/${deleteTarget.code}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
      showToast("Language deleted");
    } catch (e: any) {
      showToast(e.message, false);
    } finally {
      setSaving(null);
    }
  };

  const sorted = [...languages].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Globe className="h-7 w-7 text-purple-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Languages</h1>
            <p className="text-sm text-gray-400">Manage platform languages and display order</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          {canEdit && (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
              <Plus className="h-4 w-4" /> Add Language
            </button>
          )}
        </div>
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

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-white">Add New Language</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">BCP-47 Code (e.g. "fr", "zh-CN")</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-mono" placeholder="fr" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">English Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" placeholder="French" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Native Name</label>
              <input value={form.nativeName} onChange={e => setForm(f => ({ ...f, nativeName: e.target.value }))}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" placeholder="Français" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Flag Emoji</label>
              <input value={form.flag} onChange={e => setForm(f => ({ ...f, flag: e.target.value }))}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" placeholder="🇫🇷" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Direction</label>
              <select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value as "ltr" | "rtl" }))}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="ltr">LTR (Left-to-Right)</option>
                <option value="rtl">RTL (Right-to-Left)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Sort Order</label>
              <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
                className="w-full bg-gray-900/50 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={addLanguage} disabled={!form.code || !form.name || saving === "new"}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm disabled:opacity-50">
              <Save className="h-4 w-4" /> {saving === "new" ? "Saving…" : "Add Language"}
            </button>
            <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }}
              className="px-4 py-2 text-gray-400 hover:text-white rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-800/40 border border-gray-700/50 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700/50 text-gray-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3">Language</th>
              <th className="text-left px-4 py-3">Code</th>
              <th className="text-left px-4 py-3">Direction</th>
              <th className="text-center px-4 py-3">Default</th>
              <th className="text-center px-4 py-3">Enabled</th>
              {canEdit && <th className="text-right px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {loading ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-500">Loading…</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan={6} className="py-12 text-center text-gray-500">No languages configured</td></tr>
            ) : sorted.map((lang, idx) => (
              <tr key={lang.code} className="hover:bg-gray-700/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{lang.flag || "🌐"}</span>
                    <div>
                      <p className="font-medium text-white">{lang.name}</p>
                      <p className="text-xs text-gray-500">{lang.nativeName}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-xs bg-gray-700/50 px-2 py-1 rounded text-purple-300">{lang.code}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${lang.direction === "rtl" ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"}`}>
                    {lang.direction.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {lang.isDefault ? (
                    <Star className="h-4 w-4 text-yellow-400 mx-auto" />
                  ) : canEdit ? (
                    <button onClick={() => toggle(lang, "isDefault")} disabled={!!saving}
                      className="text-xs text-gray-500 hover:text-yellow-400 transition-colors mx-auto block">
                      Set default
                    </button>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-center">
                  {canEdit ? (
                    <button onClick={() => toggle(lang, "isEnabled")} disabled={!!saving || lang.isDefault}
                      className="mx-auto block disabled:opacity-40">
                      {lang.isEnabled
                        ? <ToggleRight className="h-5 w-5 text-green-400" />
                        : <ToggleLeft className="h-5 w-5 text-gray-500" />}
                    </button>
                  ) : (
                    <span className={`text-xs ${lang.isEnabled ? "text-green-400" : "text-gray-500"}`}>
                      {lang.isEnabled ? "On" : "Off"}
                    </span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => reorder(lang, -1)} disabled={idx === 0 || !!saving}
                        className="p-1 text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => reorder(lang, 1)} disabled={idx === sorted.length - 1 || !!saving}
                        className="p-1 text-gray-500 hover:text-white disabled:opacity-30 transition-colors">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(lang)} disabled={lang.isDefault || lang.code === "en"}
                        className="p-1 text-gray-500 hover:text-red-400 disabled:opacity-30 transition-colors ml-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDialog
          title={`Delete ${deleteTarget.name}?`}
          description="This will permanently delete the language and all its translations. This cannot be undone."
          confirmLabel="Delete Language"
          onConfirm={deleteLang}
          onCancel={() => setDeleteTarget(null)}
          variant="destructive"
        />
      )}
    </div>
  );
}

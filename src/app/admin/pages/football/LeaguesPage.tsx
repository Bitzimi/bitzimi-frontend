/**
 * Admin Football — Leagues Page
 *
 * CRUD management of football leagues.
 */

import { useState, useEffect } from "react";
import { Globe, Plus, Pencil, Trash2, RefreshCw, X, Check } from "lucide-react";
import { toast } from "sonner";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  const json = (await res.json()) as { data?: T };
  if (!res.ok) throw new Error((json as { error?: { message?: string } }).error?.message ?? "Request failed");
  return json.data as T;
}

interface League { id: string; name: string; country: string; logoUrl: string | null; isActive: boolean; sortOrder: number }

const EMPTY = { name: "", country: "", logoUrl: "", sortOrder: 0 };

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState<typeof EMPTY | null>(null);
  const [editId, setEditId]   = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    apiFetch<League[]>("/api/v1/admin/football/leagues")
      .then(setLeagues)
      .catch(() => toast.error("Failed to load leagues"))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openCreate = () => { setForm(EMPTY); setEditId(null); };
  const openEdit   = (l: League) => { setForm({ name: l.name, country: l.country, logoUrl: l.logoUrl ?? "", sortOrder: l.sortOrder }); setEditId(l.id); };
  const closeForm  = () => { setForm(null); setEditId(null); };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const body = { ...form, logoUrl: form.logoUrl || undefined };
      if (editId) {
        const updated = await apiFetch<League>(`/api/v1/admin/football/leagues/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
        setLeagues(prev => prev.map(l => l.id === editId ? updated : l));
        toast.success("League updated");
      } else {
        const created = await apiFetch<League>("/api/v1/admin/football/leagues", { method: "POST", body: JSON.stringify(body) });
        setLeagues(prev => [...prev, created]);
        toast.success("League created");
      }
      closeForm();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this league? All associated matches/predictions may be affected.")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/admin/football/leagues/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      setLeagues(prev => prev.filter(l => l.id !== id));
      toast.success("League deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Leagues</h1>
            <p className="text-xs text-zinc-500">Manage football leagues</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm border border-green-500/30 transition-all">
            <Plus className="w-3.5 h-3.5" /> New League
          </button>
        </div>
      </div>

      {/* Form */}
      {form && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">{editId ? "Edit League" : "New League"}</h2>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="League name *"
              value={form.name}
              onChange={e => setForm(f => f ? { ...f, name: e.target.value } : f)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none col-span-2"
            />
            <input
              placeholder="Country *"
              value={form.country}
              onChange={e => setForm(f => f ? { ...f, country: e.target.value } : f)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
            <input
              placeholder="Sort order"
              type="number"
              value={form.sortOrder}
              onChange={e => setForm(f => f ? { ...f, sortOrder: Number(e.target.value) } : f)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || !form.name || !form.country}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm border border-green-500/30 disabled:opacity-40 transition-all"
            >
              <Check className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save"}
            </button>
            <button onClick={closeForm} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-sm transition-all">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>{["League", "Country", "Status", "Order", "Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-sm">Loading…</td></tr>
            )}
            {!loading && leagues.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-500 text-sm">No leagues yet. Create one to get started.</td></tr>
            )}
            {leagues.map(l => (
              <tr key={l.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-white">{l.name}</td>
                <td className="px-4 py-3 text-zinc-400">{l.country}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.isActive ? "bg-green-500/15 text-green-400" : "bg-zinc-500/15 text-zinc-500"}`}>
                    {l.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{l.sortOrder}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(l)} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 hover:text-white transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del(l.id)} disabled={deleting === l.id} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

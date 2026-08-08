/**
 * Admin Football — Matches Page
 *
 * CRUD management of football matches.
 */

import { useState, useEffect, useCallback } from "react";
import { Swords, Plus, Pencil, Trash2, RefreshCw, X, Check, ChevronDown } from "lucide-react";
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

interface League { id: string; name: string; country: string }
interface Match {
  id: string; homeTeam: string; awayTeam: string; kickoffAt: string;
  status: string; venue: string | null; homeScore: number | null; awayScore: number | null;
  league: League;
  predictions: { id: string; status: string; isVip: boolean }[];
}
interface MatchList { items: Match[]; nextCursor: string | null; hasMore: boolean }

const MATCH_STATUSES = ["upcoming", "live", "finished", "postponed", "cancelled"];
const EMPTY_FORM = { leagueId: "", homeTeam: "", awayTeam: "", kickoffAt: "", venue: "", status: "upcoming", homeScore: "", awayScore: "" };

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

const STATUS_COLOR: Record<string, string> = {
  upcoming:  "bg-blue-500/15 text-blue-400",
  live:      "bg-green-500/15 text-green-400 animate-pulse",
  finished:  "bg-zinc-500/15 text-zinc-400",
  postponed: "bg-amber-500/15 text-amber-400",
  cancelled: "bg-red-500/15 text-red-400",
};

export default function MatchesPage() {
  const [items, setItems]       = useState<Match[]>([]);
  const [cursor, setCursor]     = useState<string | null>(null);
  const [hasMore, setHasMore]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [leagues, setLeagues]   = useState<League[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [leagueFilter, setLeagueFilter] = useState("");
  const [form, setForm]         = useState<typeof EMPTY_FORM | null>(null);
  const [editId, setEditId]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<League[]>("/api/v1/admin/football/leagues").then(setLeagues).catch(() => {});
  }, []);

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "50" });
    if (statusFilter) p.set("status", statusFilter);
    if (leagueFilter) p.set("leagueId", leagueFilter);
    if (cur) p.set("cursor", cur);
    apiFetch<MatchList>(`/api/v1/admin/football/matches?${p}`)
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => toast.error("Failed to load matches"))
      .finally(() => setLoading(false));
  }, [statusFilter, leagueFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); };
  const openEdit   = (m: Match) => {
    const ko = m.kickoffAt ? new Date(m.kickoffAt).toISOString().slice(0, 16) : "";
    setForm({ leagueId: m.league.id, homeTeam: m.homeTeam, awayTeam: m.awayTeam, kickoffAt: ko, venue: m.venue ?? "", status: m.status, homeScore: m.homeScore?.toString() ?? "", awayScore: m.awayScore?.toString() ?? "" });
    setEditId(m.id);
  };
  const closeForm = () => { setForm(null); setEditId(null); };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        leagueId: form.leagueId, homeTeam: form.homeTeam, awayTeam: form.awayTeam,
        kickoffAt: new Date(form.kickoffAt).toISOString(), venue: form.venue || undefined,
        status: form.status,
        ...(form.homeScore !== "" ? { homeScore: Number(form.homeScore) } : {}),
        ...(form.awayScore !== "" ? { awayScore: Number(form.awayScore) } : {}),
      };
      if (editId) {
        const updated = await apiFetch<Match>(`/api/v1/admin/football/matches/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
        setItems(prev => prev.map(m => m.id === editId ? updated : m));
        toast.success("Match updated");
      } else {
        const created = await apiFetch<Match>("/api/v1/admin/football/matches", { method: "POST", body: JSON.stringify(body) });
        setItems(prev => [created, ...prev]);
        toast.success("Match created");
      }
      closeForm();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this match?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/admin/football/matches/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      setItems(prev => prev.filter(m => m.id !== id));
      toast.success("Match deleted");
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
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Swords className="w-4 h-4 text-orange-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Matches</h1>
            <p className="text-xs text-zinc-500">Manage football matches</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm border border-green-500/30 transition-all">
            <Plus className="w-3.5 h-3.5" /> New Match
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none">
            <option value="">All statuses</option>
            {MATCH_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>
        {leagues.length > 0 && (
          <div className="relative">
            <select value={leagueFilter} onChange={e => setLeagueFilter(e.target.value)} className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none">
              <option value="">All leagues</option>
              {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
          </div>
        )}
      </div>

      {/* Form */}
      {form && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">{editId ? "Edit Match" : "New Match"}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative col-span-2 sm:col-span-1">
              <select value={form.leagueId} onChange={e => setForm(f => f ? { ...f, leagueId: e.target.value } : f)} className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none">
                <option value="">Select league *</option>
                {leagues.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>
            <input placeholder="Kickoff date/time *" type="datetime-local" value={form.kickoffAt} onChange={e => setForm(f => f ? { ...f, kickoffAt: e.target.value } : f)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none" />
            <input placeholder="Home team *" value={form.homeTeam} onChange={e => setForm(f => f ? { ...f, homeTeam: e.target.value } : f)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
            <input placeholder="Away team *" value={form.awayTeam} onChange={e => setForm(f => f ? { ...f, awayTeam: e.target.value } : f)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
            <input placeholder="Venue (optional)" value={form.venue} onChange={e => setForm(f => f ? { ...f, venue: e.target.value } : f)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
            <div className="relative">
              <select value={form.status} onChange={e => setForm(f => f ? { ...f, status: e.target.value } : f)} className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none">
                {MATCH_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>
            <input placeholder="Home score" type="number" min="0" value={form.homeScore} onChange={e => setForm(f => f ? { ...f, homeScore: e.target.value } : f)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
            <input placeholder="Away score" type="number" min="0" value={form.awayScore} onChange={e => setForm(f => f ? { ...f, awayScore: e.target.value } : f)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !form.leagueId || !form.homeTeam || !form.awayTeam || !form.kickoffAt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm border border-green-500/30 disabled:opacity-40 transition-all">
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
            <tr>{["Match", "League", "Kickoff", "Score", "Status", "Tips", "Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500 text-sm">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500 text-sm">No matches found.</td></tr>
            )}
            {items.map(m => (
              <tr key={m.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="text-sm text-white font-medium">{m.homeTeam}</p>
                  <p className="text-[11px] text-zinc-500">vs {m.awayTeam}</p>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">{m.league.name}</td>
                <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{fmtDateTime(m.kickoffAt)}</td>
                <td className="px-4 py-3 text-sm text-white font-mono">
                  {m.homeScore !== null && m.awayScore !== null ? `${m.homeScore} - ${m.awayScore}` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_COLOR[m.status] ?? "bg-zinc-500/15 text-zinc-400"}`}>{m.status}</span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">{m.predictions.length}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 hover:text-white transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => del(m.id)} disabled={deleting === m.id} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <button onClick={() => load(cursor, true)} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-xs transition-all">
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

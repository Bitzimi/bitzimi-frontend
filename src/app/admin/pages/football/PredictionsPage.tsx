/**
 * Admin Football — Predictions Page
 *
 * Create, edit, publish, and delete match predictions.
 */

import { useState, useEffect, useCallback } from "react";
import { TrendingUp, Plus, Pencil, Trash2, RefreshCw, X, Check, Star, ChevronDown } from "lucide-react";
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

interface League { id: string; name: string }
interface Match  { id: string; homeTeam: string; awayTeam: string; kickoffAt: string; league: League }
interface Result { outcome: string }
interface Prediction {
  id: string; market: string; prediction: string; confidence: number;
  riskLevel: string; isVip: boolean; status: string; publishedAt: string | null;
  analysis: string | null; reasoning: string | null;
  match: Match; result: Result | null;
}
interface PredList { items: Prediction[]; nextCursor: string | null; hasMore: boolean }

const MARKETS = ["1X2", "over_under", "btts", "double_chance", "draw_no_bet", "handicap", "correct_score"];
const PRED_OPTIONS: Record<string, string[]> = {
  "1X2":           ["home", "draw", "away"],
  "over_under":    ["over", "under"],
  "btts":          ["yes", "no"],
  "double_chance": ["home_draw", "home_away", "draw_away"],
  "draw_no_bet":   ["home", "away"],
  "handicap":      ["home", "away"],
  "correct_score": [],
};

const STATUS_COLOR: Record<string, string> = {
  draft:     "bg-zinc-500/15 text-zinc-400",
  published: "bg-green-500/15 text-green-400",
  settled:   "bg-blue-500/15 text-blue-400",
};
const OUTCOME_COLOR: Record<string, string> = {
  win:  "bg-green-500/15 text-green-400",
  loss: "bg-red-500/15 text-red-400",
  void: "bg-zinc-500/15 text-zinc-400",
};

const EMPTY_FORM = { matchId: "", market: "1X2", prediction: "home", confidence: 75, riskLevel: "medium", isVip: false, analysis: "", reasoning: "" };

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { dateStyle: "short" }); }

export default function PredictionsPage() {
  const [items, setItems]       = useState<Prediction[]>([]);
  const [cursor, setCursor]     = useState<string | null>(null);
  const [hasMore, setHasMore]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const [matches, setMatches]   = useState<Match[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm]         = useState<typeof EMPTY_FORM | null>(null);
  const [editId, setEditId]     = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ items: Match[] }>("/api/v1/admin/football/matches?limit=100")
      .then(d => setMatches(d.items))
      .catch(() => {});
  }, []);

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "50" });
    if (statusFilter) p.set("status", statusFilter);
    if (cur) p.set("cursor", cur);
    apiFetch<PredList>(`/api/v1/admin/football/predictions?${p}`)
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => toast.error("Failed to load predictions"))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); };
  const openEdit   = (p: Prediction) => {
    setForm({ matchId: p.match.id, market: p.market, prediction: p.prediction, confidence: p.confidence, riskLevel: p.riskLevel, isVip: p.isVip, analysis: p.analysis ?? "", reasoning: p.reasoning ?? "" });
    setEditId(p.id);
  };
  const closeForm = () => { setForm(null); setEditId(null); };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const body = { ...form, analysis: form.analysis || undefined, reasoning: form.reasoning || undefined };
      if (editId) {
        const updated = await apiFetch<Prediction>(`/api/v1/admin/football/predictions/${editId}`, { method: "PATCH", body: JSON.stringify(body) });
        setItems(prev => prev.map(p => p.id === editId ? updated : p));
        toast.success("Prediction updated");
      } else {
        const created = await apiFetch<Prediction>("/api/v1/admin/football/predictions", { method: "POST", body: JSON.stringify(body) });
        setItems(prev => [created, ...prev]);
        toast.success("Prediction created");
      }
      closeForm();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string) => {
    setPublishing(id);
    try {
      const updated = await apiFetch<Prediction>(`/api/v1/admin/football/predictions/${id}/publish`, { method: "POST", body: JSON.stringify({}) });
      setItems(prev => prev.map(p => p.id === id ? updated : p));
      toast.success("Prediction published");
    } catch {
      toast.error("Failed to publish");
    } finally {
      setPublishing(null);
    }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this prediction?")) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/admin/football/predictions/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      setItems(prev => prev.filter(p => p.id !== id));
      toast.success("Prediction deleted");
    } catch {
      toast.error("Failed to delete");
    } finally {
      setDeleting(null);
    }
  };

  const currentOptions = form ? (PRED_OPTIONS[form.market] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Predictions</h1>
            <p className="text-xs text-zinc-500">Create and manage match predictions</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm border border-green-500/30 transition-all">
            <Plus className="w-3.5 h-3.5" /> New Prediction
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        {["", "draft", "published", "settled"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "bg-green-600/20 text-green-300 border border-green-500/30" : "bg-white/[0.04] text-zinc-400 border border-white/[0.06] hover:bg-white/[0.07]"}`}
          >
            {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Form */}
      {form && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 space-y-3">
          <h2 className="text-sm font-semibold text-white">{editId ? "Edit Prediction" : "New Prediction"}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative col-span-2">
              <select value={form.matchId} onChange={e => setForm(f => f ? { ...f, matchId: e.target.value } : f)} className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none">
                <option value="">Select match *</option>
                {matches.map(m => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam} — {m.league.name}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>
            <div className="relative">
              <select value={form.market} onChange={e => setForm(f => f ? { ...f, market: e.target.value, prediction: PRED_OPTIONS[e.target.value]?.[0] ?? "" } : f)} className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none">
                {MARKETS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>
            {currentOptions.length > 0 ? (
              <div className="relative">
                <select value={form.prediction} onChange={e => setForm(f => f ? { ...f, prediction: e.target.value } : f)} className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none">
                  {currentOptions.map(o => <option key={o} value={o} className="capitalize">{o.replace(/_/g, " ")}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
              </div>
            ) : (
              <input placeholder="Prediction value" value={form.prediction} onChange={e => setForm(f => f ? { ...f, prediction: e.target.value } : f)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none" />
            )}
            <div>
              <label className="text-[11px] text-zinc-500 block mb-1">Confidence: {form.confidence}%</label>
              <input type="range" min="1" max="100" value={form.confidence} onChange={e => setForm(f => f ? { ...f, confidence: Number(e.target.value) } : f)} className="w-full" />
            </div>
            <div className="relative">
              <select value={form.riskLevel} onChange={e => setForm(f => f ? { ...f, riskLevel: e.target.value } : f)} className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-8 text-sm text-white focus:outline-none">
                {["low", "medium", "high"].map(r => <option key={r} value={r} className="capitalize">{r}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>
            <label className="flex items-center gap-2 cursor-pointer col-span-2">
              <input type="checkbox" checked={form.isVip} onChange={e => setForm(f => f ? { ...f, isVip: e.target.checked } : f)} className="w-4 h-4 rounded" />
              <span className="text-sm text-zinc-300 flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400" />VIP-only prediction</span>
            </label>
            <input placeholder="Short reasoning (teaser)" value={form.reasoning} onChange={e => setForm(f => f ? { ...f, reasoning: e.target.value } : f)} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none col-span-2" />
            <textarea placeholder="Full analysis (markdown, VIP only)" value={form.analysis} onChange={e => setForm(f => f ? { ...f, analysis: e.target.value } : f)} rows={4} className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none col-span-2 resize-none" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={save} disabled={saving || !form.matchId || !form.prediction} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm border border-green-500/30 disabled:opacity-40 transition-all">
              <Check className="w-3.5 h-3.5" />{saving ? "Saving…" : "Save Draft"}
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
            <tr>{["Match", "Market", "Prediction", "Conf.", "VIP", "Status", "Result", "Actions"].map(h => (
              <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500 text-sm">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-zinc-500 text-sm">No predictions found.</td></tr>
            )}
            {items.map(p => (
              <tr key={p.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="text-sm text-white font-medium">{p.match.homeTeam} vs {p.match.awayTeam}</p>
                  <p className="text-[10px] text-zinc-500">{p.match.league.name} · {fmtDate(p.match.kickoffAt)}</p>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">{p.market}</td>
                <td className="px-4 py-3 text-xs text-white font-medium capitalize">{p.prediction.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-xs text-white">{p.confidence}%</td>
                <td className="px-4 py-3">{p.isVip && <Star className="w-3.5 h-3.5 text-yellow-400" />}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${STATUS_COLOR[p.status] ?? "bg-zinc-500/15 text-zinc-400"}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  {p.result && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${OUTCOME_COLOR[p.result.outcome] ?? ""}`}>{p.result.outcome}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {p.status === "draft" && (
                      <button onClick={() => publish(p.id)} disabled={publishing === p.id} className="px-2 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-medium transition-all">
                        {publishing === p.id ? "…" : "Publish"}
                      </button>
                    )}
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 hover:text-white transition-all">
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button onClick={() => del(p.id)} disabled={deleting === p.id} className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="px-4 py-3 border-t border-white/[0.06]">
            <button onClick={() => load(cursor, true)} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-xs transition-all">Load more</button>
          </div>
        )}
      </div>
    </div>
  );
}

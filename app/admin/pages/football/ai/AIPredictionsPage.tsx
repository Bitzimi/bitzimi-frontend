/**
 * AI Predictions Review — Phase 17.3
 *
 * Admin workflow for reviewing, editing, approving, publishing, and rejecting
 * AI-generated football predictions. All data comes from the backend.
 * No predictions are generated, scored, or calculated on this page.
 */

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Brain, RefreshCw, CheckCircle, XCircle, Send,
  Edit2, ChevronDown, ChevronUp, AlertCircle, Eye,
} from "lucide-react";

// ── API helpers ───────────────────────────────────────────────────────────────

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function tok() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization:  `Bearer ${tok()}`,
      "Content-Type": "application/json",
      ...(opts?.headers ?? {}),
    },
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? "Request failed");
  return json.data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "ai_review" | "draft" | "published" | "rejected";

interface AiPrediction {
  id: string;
  matchId: string;
  market: string;
  prediction: string;
  confidence: number;
  riskLevel: string;
  isVip: boolean;
  analysis: string | null;
  reasoning: string | null;
  status: string;
  aiGenerated: boolean;
  publishedAt: string | null;
  createdAt: string;
  match: {
    homeTeam: string;
    awayTeam: string;
    kickoffAt: string;
    status: string;
    league: { name: string; country: string };
  };
}

interface ListResult {
  items: AiPrediction[];
  nextCursor: string | null;
  hasMore: boolean;
  counts: { review: number; draft: number; published: number; rejected: number };
}

interface EditForm {
  market: string;
  prediction: string;
  confidence: number;
  riskLevel: string;
  isVip: boolean;
  reasoning: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RISK_CLR: Record<string, string> = {
  low:    "bg-green-500/15 text-green-400",
  medium: "bg-amber-500/15 text-amber-400",
  high:   "bg-red-500/15 text-red-400",
};

const STATUS_CLR: Record<string, string> = {
  ai_review: "bg-violet-500/15 text-violet-400",
  draft:     "bg-zinc-500/15 text-zinc-400",
  published: "bg-green-500/15 text-green-400",
  rejected:  "bg-red-500/15 text-red-400",
  settled:   "bg-blue-500/15 text-blue-400",
};

const MARKET_LABEL: Record<string, string> = {
  "1X2":           "1X2",
  "btts":          "BTTS",
  "over_under":    "O/U 2.5",
  "double_chance": "Double Chance",
};

const PRED_LABEL: Record<string, string> = {
  home:  "Home Win", draw: "Draw", away: "Away Win",
  yes:   "Yes", no: "No",
  over:  "Over 2.5", under: "Under 2.5",
  "1X":  "1X", "12": "12", "X2": "X2",
};

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Edit sub-form ─────────────────────────────────────────────────────────────

function EditPanel({
  pred,
  form,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  pred: AiPrediction;
  form: EditForm;
  onChange: (f: Partial<EditForm>) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const markets = ["1X2", "btts", "over_under", "double_chance"];
  const predictions: Record<string, string[]> = {
    "1X2":           ["home", "draw", "away"],
    "btts":          ["yes", "no"],
    "over_under":    ["over", "under"],
    "double_chance": ["1X", "12", "X2"],
  };
  const preds = predictions[form.market] ?? predictions["1X2"];

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Edit Prediction</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {/* Market */}
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Market</label>
          <select
            value={form.market}
            onChange={e => onChange({ market: e.target.value, prediction: predictions[e.target.value]?.[0] ?? "" })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/40"
          >
            {markets.map(m => (
              <option key={m} value={m}>{MARKET_LABEL[m] ?? m}</option>
            ))}
          </select>
        </div>
        {/* Prediction */}
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Selection</label>
          <select
            value={form.prediction}
            onChange={e => onChange({ prediction: e.target.value })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/40"
          >
            {preds.map(p => (
              <option key={p} value={p}>{PRED_LABEL[p] ?? p}</option>
            ))}
          </select>
        </div>
        {/* Confidence */}
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Confidence — {form.confidence}%</label>
          <input
            type="range" min={1} max={100}
            value={form.confidence}
            onChange={e => onChange({ confidence: parseInt(e.target.value) })}
            className="w-full accent-violet-500"
          />
        </div>
        {/* Risk */}
        <div>
          <label className="text-[10px] text-zinc-500 block mb-1">Risk Level</label>
          <select
            value={form.riskLevel}
            onChange={e => onChange({ riskLevel: e.target.value })}
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/40"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        {/* VIP */}
        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isVip}
              onChange={e => onChange({ isVip: e.target.checked })}
              className="accent-violet-500"
            />
            <span className="text-xs text-zinc-300">VIP exclusive</span>
          </label>
        </div>
      </div>
      {/* Reasoning */}
      <div>
        <label className="text-[10px] text-zinc-500 block mb-1">Reasoning (short, visible to users)</label>
        <textarea
          value={form.reasoning}
          onChange={e => onChange({ reasoning: e.target.value })}
          rows={2}
          placeholder="Short reasoning shown on the prediction card…"
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-violet-500/40 resize-none placeholder:text-zinc-600"
        />
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-xs transition-colors disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── Prediction card ───────────────────────────────────────────────────────────

function PredCard({
  pred,
  onApprove,
  onPublish,
  onReject,
  onRefresh,
  busy,
}: {
  pred: AiPrediction;
  onApprove: (id: string, edits: EditForm) => Promise<void>;
  onPublish:  (id: string, edits: EditForm) => Promise<void>;
  onReject:   (id: string) => Promise<void>;
  onRefresh:  () => void;
  busy: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    market:     pred.market,
    prediction: pred.prediction,
    confidence: pred.confidence,
    riskLevel:  pred.riskLevel,
    isVip:      pred.isVip,
    reasoning:  pred.reasoning ?? "",
  });
  const [saving, setSaving] = useState(false);

  const navigate = useNavigate();
  const isBusy = busy === pred.id;
  const canEdit = !["published", "settled"].includes(pred.status);
  const canAct  = !["published", "settled", "rejected"].includes(pred.status);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch(`/api/v1/admin/ai/predictions/${pred.id}`, {
        method: "PATCH",
        body:   JSON.stringify(editForm),
      });
      setEditing(false);
      onRefresh();
    } catch (e: unknown) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Match */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-white">
              {pred.match.homeTeam} vs {pred.match.awayTeam}
            </span>
            <span className="text-[10px] text-zinc-500">·</span>
            <span className="text-[10px] text-zinc-500">{pred.match.league.name}</span>
          </div>
          {/* Meta chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-violet-300">{MARKET_LABEL[pred.market] ?? pred.market}</span>
            <span className="text-[10px] text-zinc-500">→</span>
            <span className="text-xs font-bold text-white">{PRED_LABEL[pred.prediction] ?? pred.prediction}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${RISK_CLR[pred.riskLevel] ?? RISK_CLR.medium}`}>
              {pred.riskLevel}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium tabular-nums">
              {pred.confidence}%
            </span>
            {pred.isVip && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400 font-medium">VIP</span>
            )}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLR[pred.status] ?? ""}`}>
              {pred.status.replace("_", " ")}
            </span>
          </div>
          {/* Kickoff */}
          <p className="text-[10px] text-zinc-600 mt-1">{fmtDate(pred.match.kickoffAt)}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* View analysis */}
          <button
            onClick={() => navigate(`/admin/football/ai/analyses/${pred.matchId}`)}
            title="View AI analysis"
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {/* Expand reasoning/analysis */}
          {(pred.reasoning || pred.analysis) && (
            <button
              onClick={() => setExpanded(x => !x)}
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          {/* Edit */}
          {canEdit && (
            <button
              onClick={() => { setEditing(x => !x); setExpanded(false); }}
              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-zinc-500 hover:text-zinc-300 transition-all"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Status actions */}
          {canAct && (
            <>
              {pred.status === "ai_review" && (
                <button
                  onClick={() => onApprove(pred.id, editForm)}
                  disabled={isBusy}
                  title="Save as draft (approve)"
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-700/60 hover:bg-zinc-600/60 text-zinc-200 text-[11px] font-medium transition-all disabled:opacity-50"
                >
                  <CheckCircle className="w-3 h-3" />
                  Draft
                </button>
              )}
              <button
                onClick={() => onPublish(pred.id, editForm)}
                disabled={isBusy}
                title="Publish prediction to Football Hub"
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-[11px] font-medium transition-all disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                Publish
              </button>
              <button
                onClick={() => onReject(pred.id)}
                disabled={isBusy}
                title="Reject this prediction"
                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {isBusy && <RefreshCw className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
        </div>
      </div>

      {/* Reasoning preview */}
      {expanded && pred.reasoning && (
        <p className="mt-3 pt-3 border-t border-white/[0.05] text-xs text-zinc-400 italic">
          {pred.reasoning}
        </p>
      )}

      {/* Inline edit form */}
      {editing && (
        <EditPanel
          pred={pred}
          form={editForm}
          onChange={patch => setEditForm(f => ({ ...f, ...patch }))}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; countKey: keyof ListResult["counts"] }[] = [
  { key: "ai_review", label: "Pending Review", countKey: "review" },
  { key: "draft",     label: "Approved (Draft)", countKey: "draft" },
  { key: "published", label: "Published", countKey: "published" },
  { key: "rejected",  label: "Rejected", countKey: "rejected" },
];

export default function AIPredictionsPage() {
  const [tab,     setTab]    = useState<Tab>("ai_review");
  const [data,    setData]   = useState<ListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]  = useState("");
  const [busy,    setBusy]   = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError("");
    apiFetch<ListResult>(`/api/v1/admin/ai/predictions?status=${tab}`)
      .then(setData)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const handleAction = async (
    id: string,
    path: string,
    method: string,
    body?: object,
  ) => {
    setBusy(id);
    try {
      await apiFetch(`/api/v1/admin/ai/predictions/${id}/${path}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      load();
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const approve = (id: string, edits: EditForm) =>
    handleAction(id, "approve", "POST", edits);
  const publish  = (id: string, edits: EditForm) =>
    handleAction(id, "publish", "POST", edits);
  const reject   = (id: string) =>
    handleAction(id, "reject", "POST");

  const counts = data?.counts ?? { review: 0, draft: 0, published: 0, rejected: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <Brain className="w-4 h-4 text-violet-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-white">AI Prediction Review</h1>
          <p className="text-xs text-zinc-500">Review, edit, and publish AI-generated predictions</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1">
        {TABS.map(t => {
          const count = counts[t.countKey];
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                tab === t.key
                  ? "bg-violet-600/25 text-violet-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? "bg-violet-500/30 text-violet-300" : "bg-white/[0.06] text-zinc-400"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Empty / loading */}
      {loading && (
        <div className="text-center py-12 text-zinc-600 text-sm">Loading…</div>
      )}

      {!loading && data?.items.length === 0 && (
        <div className="text-center py-16 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <Brain className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">
            {tab === "ai_review"
              ? "No predictions pending review. Trigger analysis on a match and click Generate Prediction."
              : `No ${tab} predictions yet.`}
          </p>
        </div>
      )}

      {/* Prediction list */}
      {!loading && data && data.items.length > 0 && (
        <div className="space-y-3">
          {data.items.map(pred => (
            <PredCard
              key={pred.id}
              pred={pred}
              onApprove={approve}
              onPublish={publish}
              onReject={reject}
              onRefresh={load}
              busy={busy}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {data?.hasMore && (
        <div className="text-center">
          <button
            onClick={() => {
              if (!data.nextCursor) return;
              apiFetch<ListResult>(`/api/v1/admin/ai/predictions?status=${tab}&cursor=${data.nextCursor}`)
                .then(more => setData(prev => prev ? {
                  ...more,
                  items: [...prev.items, ...more.items],
                } : more))
                .catch(e => setError((e as Error).message));
            }}
            className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-xs transition-all"
          >
            Load more
          </button>
        </div>
      )}

      {/* Workflow hint for review tab */}
      {tab === "ai_review" && !loading && (
        <div className="px-4 py-3 rounded-xl bg-violet-500/5 border border-violet-500/15 text-xs text-zinc-400">
          <span className="font-medium text-violet-400">Review workflow:</span>{" "}
          Optionally edit the prediction, then click <strong className="text-zinc-300">Draft</strong> to
          save for later, or <strong className="text-zinc-300">Publish</strong> to make it live in the
          Football Hub immediately. Rejected predictions are removed from the active queue.
        </div>
      )}
    </div>
  );
}

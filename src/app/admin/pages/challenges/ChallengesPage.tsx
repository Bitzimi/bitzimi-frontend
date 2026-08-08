/**
 * Admin Monthly Challenge Management — Phase 20.4
 *
 * Tabs:
 *   1. Challenges   — list, create, activate, end + distribute
 *   2. Leaderboard  — all 3 program-level leaderboards for active challenge
 *   3. VIP Grants   — manual VIP grant form
 *   4. Config       — feature flag + VIP bonus day configuration
 *
 * APIs:
 *   GET    /api/v1/admin/challenges                  → list
 *   POST   /api/v1/admin/challenges                  → create
 *   PATCH  /api/v1/admin/challenges/:id/activate     → activate
 *   POST   /api/v1/admin/challenges/:id/end          → end + distribute
 *   POST   /api/v1/admin/challenges/vip-grant        → manual VIP grant
 *   GET    /api/v1/challenges/leaderboard            → all 3 boards (admin uses same endpoint)
 *   GET    /api/v1/admin/config                      → read config
 *   PUT    /api/v1/admin/config/:key                 → write config
 *
 * Permissions:
 *   View:   admin.challenges.view (falls back to admin.referrals.view)
 *   Manage: admin.challenges.manage
 *   Config: admin.config.edit
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Trophy, BarChart3, Settings, Users, RefreshCw, X, CheckCircle2,
  Plus, Play, Ban, DollarSign, Star, Shield, Award, Calendar,
  Clock, ChevronRight,
} from "lucide-react";
import { PageHeader }  from "../../components/ui/PageHeader";
import { StatCard }    from "../../components/ui/StatCard";
import { SectionCard } from "../../components/ui/SectionCard";
import { EmptyState }  from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(options?.headers ?? {}) },
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(json?.error?.message ?? "API error"), { status: res.status });
  return json.data as T;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Challenge {
  id:             string;
  title:          string;
  description:    string | null;
  period:         string;
  startAt:        string;
  endAt:          string;
  status:         string;
  referralPool:   number;
  referralTopN:   number;
  affiliatePool:  number;
  affiliateTopN:  number;
  ambassadorPool: number;
  ambassadorTopN: number;
  createdAt:      string;
  updatedAt:      string;
}

interface LeaderboardEntry { rank: number; userId: string; username: string; referrals: number }

interface LeaderboardData {
  enabled: boolean;
  challenge: {
    id: string; title: string; period: string; endAt: string;
    referralPool: number; affiliatePool: number; ambassadorPool: number; status: string;
  } | null;
  leaderboards: { referral?: LeaderboardEntry[]; affiliate?: LeaderboardEntry[]; ambassador?: LeaderboardEntry[] };
}

interface ConfigEntry { key: string; value: unknown; updatedAt: string }

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "challenges" | "leaderboard" | "vip-grants" | "config";

const TABS: Array<{ id: Tab; label: string; icon: typeof Trophy }> = [
  { id: "challenges",  label: "Challenges",  icon: Trophy    },
  { id: "leaderboard", label: "Leaderboard", icon: BarChart3 },
  { id: "vip-grants",  label: "VIP Grants",  icon: Award     },
  { id: "config",      label: "Config",      icon: Settings  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtUSD(v: number) { return `$${v.toFixed(2)}`; }

const STATUS_COLORS: Record<string, string> = {
  upcoming: "text-blue-400  bg-blue-500/10  border-blue-500/20",
  active:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  paused:   "text-amber-400 bg-amber-500/10  border-amber-500/20",
  ended:    "text-zinc-400  bg-zinc-800      border-zinc-700",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium capitalize ${STATUS_COLORS[status] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"}`}>
      {status}
    </span>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────

function ConfirmDialog({
  title, description, confirmLabel, confirmVariant = "danger", onConfirm, onCancel,
}: {
  title: string; description: string; confirmLabel: string;
  confirmVariant?: "danger" | "warning"; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-[#18181b] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-zinc-400 mb-5">{description}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              confirmVariant === "danger"
                ? "bg-red-500/15 border border-red-500/20 text-red-400 hover:text-red-300"
                : "bg-amber-500/15 border border-amber-500/20 text-amber-400 hover:text-amber-300"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Challenge Modal ─────────────────────────────────────────────────────

function CreateChallengeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    title:          "",
    description:    "",
    period:         "",
    startAt:        "",
    endAt:          "",
    referralPool:   "200",
    referralTopN:   "50",
    affiliatePool:  "350",
    affiliateTopN:  "10",
    ambassadorPool: "400",
    ambassadorTopN: "3",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.period || !form.startAt || !form.endAt) {
      toast.error("Title, period, start date, and end date are required");
      return;
    }
    setSaving(true);
    try {
      await adminFetch("/api/v1/admin/challenges", {
        method: "POST",
        body: JSON.stringify({
          title:          form.title,
          description:    form.description || undefined,
          period:         form.period,
          startAt:        form.startAt,
          endAt:          form.endAt,
          referralPool:   parseFloat(form.referralPool)  || 200,
          referralTopN:   parseInt(form.referralTopN)    || 50,
          affiliatePool:  parseFloat(form.affiliatePool) || 350,
          affiliateTopN:  parseInt(form.affiliateTopN)   || 10,
          ambassadorPool: parseFloat(form.ambassadorPool)|| 400,
          ambassadorTopN: parseInt(form.ambassadorTopN)  || 3,
        }),
      });
      toast.success("Challenge created");
      onCreated();
    } catch (e: any) { toast.error(e.message ?? "Create failed"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative z-10 bg-[#18181b] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-white">Create Challenge</h3>
          <button type="button" onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-4">
          <Field label="Title *">
            <input value={form.title} onChange={e => set("title", e.target.value)} placeholder="July 2025 Referral Challenge" required className="w-full h-9 bg-zinc-900 border border-white/[0.08] rounded-lg px-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
          </Field>
          <Field label="Period *" hint="e.g. 2025-07">
            <input value={form.period} onChange={e => set("period", e.target.value)} placeholder="2025-07" required className="w-full h-9 bg-zinc-900 border border-white/[0.08] rounded-lg px-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date *">
              <input type="datetime-local" value={form.startAt} onChange={e => set("startAt", e.target.value)} required className="w-full h-9 bg-zinc-900 border border-white/[0.08] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-zinc-600" />
            </Field>
            <Field label="End Date *">
              <input type="datetime-local" value={form.endAt} onChange={e => set("endAt", e.target.value)} required className="w-full h-9 bg-zinc-900 border border-white/[0.08] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-zinc-600" />
            </Field>
          </div>
          <Field label="Description">
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={2} placeholder="Challenge description…" className="w-full bg-zinc-900 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600" />
          </Field>

          <div className="border border-white/[0.06] rounded-xl p-4 space-y-3">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">Prize Pools</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Referral Pool ($)" hint="Default $200">
                <input type="number" min="0" step="0.01" value={form.referralPool} onChange={e => set("referralPool", e.target.value)} className="w-full h-8 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 text-sm text-white focus:outline-none focus:border-zinc-600" />
              </Field>
              <Field label="Affiliate Pool ($)" hint="Default $350">
                <input type="number" min="0" step="0.01" value={form.affiliatePool} onChange={e => set("affiliatePool", e.target.value)} className="w-full h-8 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 text-sm text-white focus:outline-none focus:border-zinc-600" />
              </Field>
              <Field label="Ambassador Pool ($)" hint="Default $400">
                <input type="number" min="0" step="0.01" value={form.ambassadorPool} onChange={e => set("ambassadorPool", e.target.value)} className="w-full h-8 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 text-sm text-white focus:outline-none focus:border-zinc-600" />
              </Field>
            </div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 mt-2">Max Winners</p>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Referral Top N" hint="Default 50">
                <input type="number" min="1" value={form.referralTopN} onChange={e => set("referralTopN", e.target.value)} className="w-full h-8 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 text-sm text-white focus:outline-none focus:border-zinc-600" />
              </Field>
              <Field label="Affiliate Top N" hint="Default 10">
                <input type="number" min="1" value={form.affiliateTopN} onChange={e => set("affiliateTopN", e.target.value)} className="w-full h-8 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 text-sm text-white focus:outline-none focus:border-zinc-600" />
              </Field>
              <Field label="Ambassador Top N" hint="Default 3">
                <input type="number" min="1" value={form.ambassadorTopN} onChange={e => set("ambassadorTopN", e.target.value)} className="w-full h-8 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 text-sm text-white focus:outline-none focus:border-zinc-600" />
              </Field>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-zinc-800 border border-white/[0.06] text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/20 text-sm text-indigo-300 hover:text-indigo-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Challenge
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Challenges Tab ────────────────────────────────────────────────────────────

function ChallengesTab({ canManage }: { canManage: boolean }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [creating,   setCreating]   = useState(false);
  const [confirm,    setConfirm]    = useState<{ id: string; action: "activate" | "end" } | null>(null);
  const [acting,     setActing]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setChallenges(await adminFetch<Challenge[]>("/api/v1/admin/challenges")); }
    catch { toast.error("Failed to load challenges"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async () => {
    if (!confirm) return;
    setActing(true);
    try {
      if (confirm.action === "activate") {
        await adminFetch(`/api/v1/admin/challenges/${confirm.id}/activate`, { method: "PATCH" });
        toast.success("Challenge activated");
      } else {
        const result = await adminFetch<{ referralWinners: number; affiliateWinners: number; ambassadorWinners: number; totalDistributed: number }>(
          `/api/v1/admin/challenges/${confirm.id}/end`, { method: "POST" }
        );
        toast.success(`Challenge ended — $${result.totalDistributed.toFixed(2)} distributed to ${result.referralWinners + result.affiliateWinners + result.ambassadorWinners} winners`);
      }
      setConfirm(null);
      load();
    } catch (e: any) { toast.error(e.message ?? "Action failed"); }
    finally { setActing(false); }
  };

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/20 text-sm text-indigo-300 hover:text-indigo-200 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Challenge
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">{[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-[#18181b]" />)}</div>
      ) : challenges.length === 0 ? (
        <EmptyState icon={Trophy} title="No challenges" description="Create your first monthly challenge." />
      ) : (
        <div className="space-y-3">
          {challenges.map(c => (
            <div key={c.id} className="bg-[#18181b] border border-white/[0.06] rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="text-sm font-semibold text-white truncate">{c.title}</p>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="text-xs text-zinc-500">{c.period} · {fmtDate(c.startAt)} → {fmtDate(c.endAt)}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: "Referral",   pool: c.referralPool,   topN: c.referralTopN,   color: "text-zinc-300" },
                      { label: "Affiliate",  pool: c.affiliatePool,  topN: c.affiliateTopN,  color: "text-purple-400" },
                      { label: "Ambassador", pool: c.ambassadorPool, topN: c.ambassadorTopN, color: "text-yellow-400" },
                    ].map(lv => (
                      <div key={lv.label} className="bg-zinc-900/60 rounded-lg p-2 text-center">
                        <p className={`text-xs font-semibold ${lv.color}`}>{lv.label}</p>
                        <p className="text-sm font-bold text-white mt-0.5">{fmtUSD(lv.pool)}</p>
                        <p className="text-[10px] text-zinc-600">top {lv.topN}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {canManage && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    {c.status === "upcoming" && (
                      <button
                        onClick={() => setConfirm({ id: c.id, action: "activate" })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <Play className="w-3.5 h-3.5" /> Activate
                      </button>
                    )}
                    {c.status === "active" && (
                      <button
                        onClick={() => setConfirm({ id: c.id, action: "end" })}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Ban className="w-3.5 h-3.5" /> End & Distribute
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {creating && <CreateChallengeModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />}

      {confirm && (
        <ConfirmDialog
          title={confirm.action === "activate" ? "Activate Challenge" : "End & Distribute Challenge"}
          description={
            confirm.action === "activate"
              ? "This will make the challenge visible and active for users. Cannot be undone."
              : "This will end the challenge, distribute all prize pools equally among top winners, and grant VIP time to the overall top 3. This action is irreversible."
          }
          confirmLabel={confirm.action === "activate" ? "Activate" : "End & Distribute"}
          confirmVariant={confirm.action === "end" ? "danger" : "warning"}
          onConfirm={handleAction}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Leaderboard Tab ───────────────────────────────────────────────────────────

type LbKey = "referral" | "affiliate" | "ambassador";

const LB_TABS = [
  { key: "referral"   as LbKey, label: "Referral",   icon: Star,   color: "text-zinc-300"   },
  { key: "affiliate"  as LbKey, label: "Affiliate",  icon: Shield, color: "text-purple-400" },
  { key: "ambassador" as LbKey, label: "Ambassador", icon: Award,  color: "text-yellow-400" },
];

const MEDAL = ["🥇", "🥈", "🥉"];

function LeaderboardTab() {
  const [data,    setData]    = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lbTab,   setLbTab]   = useState<LbKey>("referral");

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await adminFetch<LeaderboardData>("/api/v1/admin/challenges/leaderboard")); }
    catch { toast.error("Failed to load leaderboard"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="h-64 rounded-2xl bg-[#18181b] animate-pulse" />;

  if (!data?.enabled) return (
    <EmptyState icon={Trophy} title="Feature Disabled" description="Enable Monthly Challenge in Config to manage leaderboards." />
  );

  if (!data.challenge) return (
    <EmptyState icon={Calendar} title="No Active Challenge" description="Activate a challenge to see leaderboard data." />
  );

  const board = data.leaderboards[lbTab] ?? [];

  return (
    <div className="space-y-4">
      <SectionCard title={`Active: ${data.challenge.title}`} description={`Ends ${fmtDate(data.challenge.endAt)}`}>
        <div className="flex gap-2 flex-wrap mt-2">
          {[
            { label: "Referral Pool",   val: fmtUSD(data.challenge.referralPool)   },
            { label: "Affiliate Pool",  val: fmtUSD(data.challenge.affiliatePool)  },
            { label: "Ambassador Pool", val: fmtUSD(data.challenge.ambassadorPool) },
          ].map(p => (
            <span key={p.label} className="text-xs px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
              {p.label}: {p.val}
            </span>
          ))}
        </div>
      </SectionCard>

      {/* Level tabs */}
      <div className="flex gap-1 p-1 bg-zinc-900/60 border border-white/[0.06] rounded-xl w-fit">
        {LB_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setLbTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              lbTab === t.key ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <t.icon className={`w-3.5 h-3.5 ${lbTab === t.key ? t.color : ""}`} />
            {t.label}
          </button>
        ))}
      </div>

      {board.length === 0 ? (
        <EmptyState icon={Trophy} title="No entries" description="No entries in this leaderboard yet." />
      ) : (
        <div className="bg-[#18181b] border border-white/[0.06] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {["Rank", "Username", "User ID", "Referrals"].map(h => (
                  <th key={h} className="text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {board.map(entry => (
                <tr key={entry.userId} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-sm font-bold text-zinc-300">
                    {entry.rank <= 3 ? MEDAL[entry.rank - 1] : `#${entry.rank}`}
                  </td>
                  <td className="px-4 py-3 text-white font-medium">@{entry.username}</td>
                  <td className="px-4 py-3 text-zinc-600 text-xs font-mono">{entry.userId.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-zinc-300">{entry.referrals}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── VIP Grants Tab ────────────────────────────────────────────────────────────

function VipGrantsTab({ canManage }: { canManage: boolean }) {
  const [userId,   setUserId]   = useState("");
  const [days,     setDays]     = useState("30");
  const [reason,   setReason]   = useState("");
  const [saving,   setSaving]   = useState(false);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = parseInt(days);
    if (!userId.trim() || !d || d < 1) { toast.error("User ID and valid duration are required"); return; }
    setSaving(true);
    try {
      await adminFetch("/api/v1/admin/challenges/vip-grant", {
        method: "POST",
        body: JSON.stringify({ userId: userId.trim(), durationDays: d, reason: reason.trim() || undefined }),
      });
      toast.success(`VIP granted: ${d} days`);
      setUserId(""); setDays("30"); setReason("");
    } catch (e: any) { toast.error(e.message ?? "Grant failed"); }
    finally { setSaving(false); }
  };

  if (!canManage) {
    return <EmptyState icon={Award} title="Permission Required" description="VIP grant management requires admin.challenges.manage permission." />;
  }

  return (
    <div className="max-w-lg">
      <SectionCard title="Manual VIP Grant" description="Grant VIP time to any user. Does not trigger commission or payment events.">
        <form onSubmit={handleGrant} className="space-y-4 mt-4">
          <Field label="User ID *">
            <input
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="Paste user UUID from Users page"
              required
              className="w-full h-9 bg-zinc-900 border border-white/[0.08] rounded-lg px-3 text-sm text-white placeholder-zinc-600 font-mono focus:outline-none focus:border-zinc-600"
            />
          </Field>
          <Field label="Duration (days) *">
            <input
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={e => setDays(e.target.value)}
              className="w-full h-9 bg-zinc-900 border border-white/[0.08] rounded-lg px-3 text-sm text-white focus:outline-none focus:border-zinc-600"
            />
          </Field>
          <Field label="Reason">
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Monthly Challenge — Overall Rank 1 winner"
              className="w-full bg-zinc-900 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600"
            />
          </Field>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-sm text-amber-400 hover:text-amber-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
            Grant VIP
          </button>
        </form>
      </SectionCard>

      <p className="text-xs text-zinc-600 mt-3">
        VIP grants extend existing subscriptions without creating a new payment record or triggering commissions.
        Grant history is tracked in the VipGrant database table and the transaction ledger.
      </p>
    </div>
  );
}

// ── Config Tab ─────────────────────────────────────────────────────────────────

interface ConfigField { key: string; label: string; hint: string; type: "boolean" | "number" }

const CHALLENGE_CONFIG_FIELDS: ConfigField[] = [
  { key: "feature.monthly_challenge", label: "Monthly Challenge Enabled", hint: "Toggle visibility for all users", type: "boolean" },
];

const VIP_BONUS_FIELDS: ConfigField[] = [
  { key: "challenge.vip_grant.rank1_days", label: "1st Place VIP Days", hint: "Default: 30 days", type: "number" },
  { key: "challenge.vip_grant.rank2_days", label: "2nd Place VIP Days", hint: "Default: 20 days", type: "number" },
  { key: "challenge.vip_grant.rank3_days", label: "3rd Place VIP Days", hint: "Default: 10 days", type: "number" },
];

function ConfigTab({ canEdit }: { canEdit: boolean }) {
  const [configs,  setConfigs]  = useState<ConfigEntry[]>([]);
  const [editing,  setEditing]  = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState<Record<string, boolean>>({});
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await adminFetch<ConfigEntry[]>("/api/v1/admin/config");
      setConfigs(all);
    } catch { toast.error("Failed to load config"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getVal = (key: string, defaultVal: unknown): unknown => {
    const c = configs.find(x => x.key === key);
    return c ? c.value : defaultVal;
  };

  const saveKey = async (key: string, value: unknown) => {
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await adminFetch(`/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      toast.success(`Saved: ${key}`);
      load();
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(s => ({ ...s, [key]: false })); }
  };

  const toggleBool = (key: string, currentVal: unknown) => {
    if (!canEdit) return;
    saveKey(key, !Boolean(currentVal));
  };

  if (loading) return <div className="h-64 rounded-2xl bg-[#18181b] animate-pulse" />;

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionCard title="Feature Flags">
        {CHALLENGE_CONFIG_FIELDS.filter(f => f.type === "boolean").map(f => {
          const val = getVal(f.key, false);
          return (
            <div key={f.key} className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
              <div>
                <p className="text-sm font-medium text-white">{f.label}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{f.hint}</p>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                <span className={`text-xs font-medium ${val ? "text-emerald-400" : "text-zinc-500"}`}>{val ? "On" : "Off"}</span>
                <button
                  onClick={() => toggleBool(f.key, val)}
                  disabled={!canEdit || saving[f.key]}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${val ? "bg-emerald-500" : "bg-zinc-700"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${val ? "translate-x-5" : ""}`} />
                </button>
              </div>
            </div>
          );
        })}
      </SectionCard>

      <SectionCard title="VIP Bonus Configuration" description="Days of VIP awarded to overall top 3 referrers when a challenge ends.">
        <div className="space-y-3 mt-3">
          {VIP_BONUS_FIELDS.map(f => {
            const val = getVal(f.key, f.key.includes("rank1") ? 30 : f.key.includes("rank2") ? 20 : 10);
            const editVal = editing[f.key] ?? String(val ?? "");
            return (
              <div key={f.key} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm text-white">{f.label}</p>
                  <p className="text-xs text-zinc-500">{f.hint}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    value={editVal}
                    onChange={e => setEditing(ed => ({ ...ed, [f.key]: e.target.value }))}
                    disabled={!canEdit}
                    className="w-20 h-8 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 text-sm text-white text-center focus:outline-none focus:border-zinc-600 disabled:opacity-50"
                  />
                  {canEdit && (
                    <button
                      onClick={() => saveKey(f.key, parseInt(editVal) || val)}
                      disabled={saving[f.key] || editVal === String(val)}
                      className="h-8 px-3 rounded-lg bg-indigo-500/20 border border-indigo-500/20 text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-40 transition-colors"
                    >
                      {saving[f.key] ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Save"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {!canEdit && <p className="text-xs text-zinc-600">Config editing requires admin.config.edit permission.</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ChallengesPage() {
  const { can } = useAdminAccess();
  const [tab, setTab] = useState<Tab>("challenges");

  const canView   = can("admin.challenges.view") || can("admin.referrals.view");
  const canManage = can("admin.challenges.manage") || can("admin.referrals.manage" as any);
  const canConfig = can("admin.config.edit");

  if (!canView) {
    return (
      <div className="p-6">
        <EmptyState icon={Trophy} title="Access Denied" description="You do not have permission to view Challenge Management." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Monthly Challenge"
        description="Create, configure, and distribute monthly referral challenge rewards"
        badge={{ label: "Phase 20", variant: "default" }}
      />

      <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20" : "text-zinc-500 hover:text-white"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "challenges"  && <ChallengesTab canManage={canManage} />}
      {tab === "leaderboard" && <LeaderboardTab />}
      {tab === "vip-grants"  && <VipGrantsTab canManage={canManage} />}
      {tab === "config"      && <ConfigTab canEdit={canConfig} />}
    </div>
  );
}

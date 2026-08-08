/**
 * Ambassador Program — Phase 20.3
 *
 * User-facing page at /ambassador.
 * Displays program level, application status, and activity score.
 * Any user (referral OR affiliate) can apply — no upgrade required.
 *
 * APIs used:
 *   GET  /api/v1/ambassadors/me          → programLevel, ambassadorCode, application
 *   GET  /api/v1/ambassadors/me/score    → 6-dimension activity score + composite
 *   POST /api/v1/ambassadors/apply       → { username, bio, socialLinks }
 */
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router";
import { useSettings } from "../contexts/SettingsContext";
import { useFeature } from "../contexts/FeatureContext";
import { FeaturedPromotionCard } from "../components/FeaturedPromotionCard";
import {
  Award, Shield, Star, ChevronLeft, RefreshCw, Lock, CheckCircle2,
  XCircle, Clock, BarChart2, X, Plus,
} from "lucide-react";
import { toast } from "sonner";
import { ResponsiveLayout } from "../components/ResponsiveLayout";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = await res.json() as { data?: T; error?: { message: string; code?: string } };
  if (!res.ok) {
    throw Object.assign(new Error(json.error?.message ?? "Request failed"), { code: json.error?.code });
  }
  return json.data as T;
}

async function apiPost<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json() as { data?: T; error?: { message: string; code?: string } };
  if (!res.ok) {
    throw Object.assign(new Error(json.error?.message ?? "Request failed"), { code: json.error?.code });
  }
  return json.data as T;
}

interface AmbassadorStatus {
  programLevel:   string;
  ambassadorCode: string | null;
  application: {
    id:              string;
    status:          string;
    username:        string;
    rejectionReason: string | null;
    createdAt:       string;
  } | null;
}

interface ActivityScore {
  gameScore:      number;
  depositScore:   number;
  vipScore:       number;
  taskScore:      number;
  footballScore:  number;
  otherScore:     number;
  compositeScore: number;
  updatedAt?:     string;
}

// ── Level display config ──────────────────────────────────────────────────────

const LEVEL_CONFIG = {
  referral:   { label: "Referral",   color: "text-zinc-300",   pill: "bg-zinc-800 border-zinc-700",         icon: Star,   desc: "Standard referral member"   },
  affiliate:  { label: "Affiliate",  color: "text-purple-400", pill: "bg-purple-500/10 border-purple-500/30", icon: Shield, desc: "Approved affiliate partner"  },
  ambassador: { label: "Ambassador", color: "text-yellow-400", pill: "bg-yellow-500/10 border-yellow-500/30", icon: Award,  desc: "Official brand ambassador"   },
};

function level(l: string) {
  return LEVEL_CONFIG[l as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.referral;
}

// ── Activity score dimensions ─────────────────────────────────────────────────

const DIMENSIONS = [
  { key: "gameScore"    as const, label: "Game Activity",     weight: "25%", bar: "bg-green-500"   },
  { key: "depositScore" as const, label: "Deposits",          weight: "20%", bar: "bg-blue-500"    },
  { key: "vipScore"     as const, label: "VIP Subscriptions", weight: "20%", bar: "bg-yellow-500"  },
  { key: "taskScore"    as const, label: "Task Completions",  weight: "15%", bar: "bg-purple-500"  },
  { key: "footballScore"as const, label: "Football AI Visits",weight: "5%",  bar: "bg-emerald-500" },
  { key: "otherScore"   as const, label: "Other Activity",    weight: "15%", bar: "bg-orange-500"  },
];

// ── Application form ──────────────────────────────────────────────────────────

function ApplicationForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [username,    setUsername]    = useState("");
  const [bio,         setBio]         = useState("");
  const [linkInput,   setLinkInput]   = useState("");
  const [links,       setLinks]       = useState<string[]>([]);
  const [submitting,  setSubmitting]  = useState(false);

  const addLink = () => {
    const v = linkInput.trim();
    if (v && !links.includes(v) && links.length < 5) {
      setLinks(l => [...l, v]);
      setLinkInput("");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = username.trim();
    if (u.length < 3) { toast.error("Username must be at least 3 characters"); return; }
    setSubmitting(true);
    try {
      await apiPost("/api/v1/ambassadors/apply", {
        username: u,
        bio: bio.trim() || undefined,
        socialLinks: links,
      });
      toast.success("Application submitted! We will review it within 3–5 business days.");
      onSuccess();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code === "FEATURE_DISABLED") {
        toast.error("The Ambassador Program is not yet open. Check back soon!");
      } else if (e.code === "USERNAME_TAKEN") {
        toast.error("That username is already taken — try a different one.");
      } else if (e.code === "ALREADY_APPLIED") {
        toast.info("Application already submitted.");
        onSuccess();
      } else {
        toast.error(e.message ?? "Submission failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Username */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Ambassador Username <span className="text-red-400">*</span>
        </label>
        <div className="flex">
          <span className="h-10 px-3 flex items-center bg-zinc-800 border border-r-0 border-zinc-700 rounded-l-lg text-zinc-500 text-sm select-none">@</span>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
            placeholder="yourname"
            minLength={3}
            maxLength={30}
            required
            className="flex-1 h-10 bg-zinc-800 border border-zinc-700 rounded-r-lg px-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/60 transition-colors"
          />
        </div>
        <p className="text-[10px] text-zinc-600 mt-1">Letters, numbers, and underscores · min 3 characters</p>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">Bio / About You</label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Tell us about yourself, your audience, and why you want to become an ambassador…"
          rows={3}
          maxLength={500}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/60 transition-colors resize-none"
        />
      </div>

      {/* Social links */}
      <div>
        <label className="block text-xs font-medium text-zinc-400 mb-1.5">
          Social Links <span className="text-zinc-600">(optional · up to 5)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={linkInput}
            onChange={e => setLinkInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            placeholder="https://twitter.com/yourhandle"
            className="flex-1 h-9 bg-zinc-800 border border-zinc-700 rounded-lg px-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/60 transition-colors"
          />
          <button
            type="button"
            onClick={addLink}
            disabled={!linkInput.trim() || links.length >= 5}
            className="h-9 px-3 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-white transition-all"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {links.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {links.map(link => (
              <span key={link} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-300">
                {link.length > 36 ? link.slice(0, 36) + "…" : link}
                <button type="button" onClick={() => setLinks(l => l.filter(x => x !== link))} className="text-zinc-500 hover:text-red-400 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm font-medium transition-all"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
        >
          {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Submitting…</> : <><Award className="w-4 h-4" /> Submit</>}
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AmbassadorProgram() {
  const navigate = useNavigate();
  const { t } = useSettings();
  const { hasFlag } = useFeature();
  const [status,     setStatus]     = useState<AmbassadorStatus | null>(null);
  const [score,      setScore]      = useState<ActivityScore | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [featureOff, setFeatureOff] = useState(!hasFlag("ambassador_program"));
  const [showForm,   setShowForm]   = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sc] = await Promise.all([
        apiGet<AmbassadorStatus>("/api/v1/ambassadors/me"),
        apiGet<ActivityScore>("/api/v1/ambassadors/me/score"),
      ]);
      setStatus(s);
      setScore(sc);
      setFeatureOff(false);
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; status?: number };
      if (e.code === "FEATURE_DISABLED" || e.message?.includes("not yet open")) {
        setFeatureOff(true);
      } else if (e.status !== 401) {
        toast.error("Failed to load ambassador data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleApplySuccess = async () => {
    setShowForm(false);
    await fetchAll();
  };

  const lvl = status ? level(status.programLevel) : level("referral");
  const LvlIcon = lvl.icon;

  return (
    <ResponsiveLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all -ml-2 flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{t("ambassador.title","Ambassador Program")}</h1>
            <p className="text-sm text-zinc-500">{t("ambassador.subtitle","Grow with BitZimi and earn more")}</p>
          </div>
        </div>

        <FeaturedPromotionCard location="ambassador" />

        {/* ── Loading ────────────────────────────────────────────────────────── */}
        {loading && (
          <div className="space-y-3 animate-pulse">
            <div className="h-28 rounded-2xl bg-zinc-800/60" />
            <div className="h-44 rounded-2xl bg-zinc-800/60" />
            <div className="h-52 rounded-2xl bg-zinc-800/60" />
          </div>
        )}

        {/* ── Feature disabled ───────────────────────────────────────────────── */}
        {!loading && featureOff && (
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-zinc-600" />
            </div>
            <p className="text-base font-semibold text-white mb-2">Coming Soon</p>
            <p className="text-sm text-zinc-500 max-w-xs mx-auto">
              The Ambassador Program is not yet open for applications. We will announce when it launches!
            </p>
          </div>
        )}

        {/* ── Main content ───────────────────────────────────────────────────── */}
        {!loading && !featureOff && status && (
          <>
            {/* Program level */}
            <div className={`rounded-2xl border p-5 ${lvl.pill}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Program Level</p>
                  <div className={`inline-flex items-center gap-2 text-lg font-bold ${lvl.color}`}>
                    <LvlIcon className="w-5 h-5" />
                    {lvl.label}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{lvl.desc}</p>
                </div>
                {status.programLevel === "ambassador" && status.ambassadorCode && (
                  <div className="text-right">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Your Code</p>
                    <p className="text-base font-bold text-yellow-400">@{status.ambassadorCode}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ambassador active — extra note */}
            {status.programLevel === "ambassador" && (
              <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                  <p className="text-sm font-semibold text-yellow-400">Active Ambassador</p>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  You are earning ambassador-tier commissions on your referrals. Your ambassador wallet
                  receives higher commission rates automatically. Share your code{" "}
                  <span className="text-yellow-400 font-semibold">@{status.ambassadorCode}</span> to grow your network.
                </p>
              </div>
            )}

            {/* Application section — only for non-ambassador users */}
            {status.programLevel !== "ambassador" && (
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-4">Ambassador Application</p>

                {/* Not applied + form hidden */}
                {!status.application && !showForm && (
                  <div>
                    <p className="text-sm text-zinc-400 mb-4">
                      Apply to become a BitZimi Ambassador. Both Referral and Affiliate members are welcome to apply.
                    </p>
                    <ul className="space-y-2 mb-5">
                      {[
                        "Higher commission rates on all referrals",
                        "Dedicated ambassador wallet",
                        "Exclusive ambassador profile badge",
                        "Priority partner support",
                      ].map(b => (
                        <li key={b} className="flex items-center gap-2 text-sm text-zinc-300">
                          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setShowForm(true)}
                      className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-[0.98] text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                    >
                      <Award className="w-4 h-4" /> Apply Now
                    </button>
                  </div>
                )}

                {/* Application form */}
                {!status.application && showForm && (
                  <ApplicationForm onSuccess={handleApplySuccess} onCancel={() => setShowForm(false)} />
                )}

                {/* Pending */}
                {status.application?.status === "pending" && (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-yellow-400">Application Under Review</p>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Submitted as <span className="text-zinc-300">@{status.application.username}</span> on{" "}
                        {new Date(status.application.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-zinc-600 mt-2">
                        Reviews typically take 3–5 business days. You will be notified of the outcome.
                      </p>
                    </div>
                  </div>
                )}

                {/* Rejected */}
                {status.application?.status === "rejected" && (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <XCircle className="w-4 h-4 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-400">Application Not Approved</p>
                      {status.application.rejectionReason && (
                        <p className="text-xs text-zinc-400 mt-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 leading-relaxed">
                          {status.application.rejectionReason}
                        </p>
                      )}
                      <p className="text-xs text-zinc-600 mt-2">
                        Contact support if you believe this decision was made in error.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Activity Score */}
            {score && (
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-purple-400" />
                    <p className="text-sm font-semibold text-white">Activity Score</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-purple-400 tabular-nums">{score.compositeScore.toFixed(2)}</span>
                    <p className="text-[10px] text-zinc-500">composite</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-600 mb-5">
                  Weighted score used to evaluate ambassador applications. Higher is better.
                </p>

                <div className="space-y-3.5">
                  {DIMENSIONS.map(d => {
                    const val = score[d.key];
                    const maxForBar = Math.max(val, 0.01);
                    const pct = Math.min((val / Math.max(maxForBar, 100)) * 100, 100);
                    return (
                      <div key={d.key} className="flex items-center gap-3">
                        <div className="w-32 flex-shrink-0">
                          <p className="text-xs text-zinc-400 leading-tight">{d.label}</p>
                          <p className="text-[10px] text-zinc-600">{d.weight}</p>
                        </div>
                        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${d.bar} transition-all duration-700`}
                            style={{ width: `${Math.max(pct, val > 0 ? 3 : 0)}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400 tabular-nums w-12 text-right">{val.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>

                {score.updatedAt && (
                  <p className="text-[10px] text-zinc-700 mt-4">
                    Updated {new Date(score.updatedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </ResponsiveLayout>
  );
}

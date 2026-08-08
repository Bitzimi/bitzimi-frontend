/**
 * AI Publish Configuration — Publishing Rules
 *
 * Control how AI-generated predictions are automatically published to users.
 * Includes master toggle, publish mode, quality gates, admin approval, and match queuing.
 */

import { useEffect, useState } from "react";
import {
  RefreshCw,
  Save,
  Send,
  Clock,
  ShieldCheck,
  Star,
  Zap,
  ListChecks,
  Info,
} from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...opts?.headers,
    },
  });
  const json = (await res.json()) as { data?: T; error?: { message: string } };
  if (!res.ok) throw new Error((json as { error?: { message: string } }).error?.message ?? "Request failed");
  return json.data as T;
}

interface PublishConfig {
  id: string;
  autoPublish: boolean;
  autoPublishMode: "manual" | "immediate" | "hours_before";
  hoursBeforeKickoff: number;
  minConfidenceToPublish: number;
  publishVipOnly: boolean;
  requireAdminApproval: boolean;
  autoQueueNewMatches: boolean;
  queueHoursAhead: number;
  updatedAt: string;
  updatedBy: string | null;
}

// ── Small reusable components ─────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  color = "violet",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: "violet" | "green" | "amber";
}) {
  const bg = checked
    ? color === "green"
      ? "bg-green-600"
      : color === "amber"
      ? "bg-amber-500"
      : "bg-violet-600"
    : "bg-zinc-700";
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${bg}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
        <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          <p className="text-[11px] text-zinc-500">{subtitle}</p>
        </div>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function RowLabel({
  label,
  description,
}: {
  label: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-sm text-white">{label}</p>
      {description && <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
  color,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: "violet" | "green" | "amber";
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <RowLabel label={label} description={description} />
      <Toggle checked={checked} onChange={onChange} color={color} />
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PublishConfigPage() {
  const [config, setConfig] = useState<PublishConfig | null>(null);
  const [form, setForm] = useState<Partial<PublishConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    apiFetch<PublishConfig>("/api/v1/admin/ai/publish-config")
      .then((cfg) => {
        setConfig(cfg);
        setForm(cfg);
      })
      .catch(() => setError("Failed to load publishing configuration."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const patch = <K extends keyof PublishConfig>(key: K, value: PublishConfig[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess("");
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: Partial<PublishConfig> = {};
      const keys = Object.keys(form) as (keyof PublishConfig)[];
      for (const k of keys) {
        if (form[k] !== config?.[k]) {
          (payload as Record<string, unknown>)[k] = form[k];
        }
      }
      if (Object.keys(payload).length === 0) {
        setSuccess("No changes to save.");
        return;
      }
      const updated = await apiFetch<PublishConfig>("/api/v1/admin/ai/publish-config", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setConfig(updated);
      setForm(updated);
      setSuccess("Configuration saved successfully.");
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const autoPublishEnabled = form.autoPublish ?? false;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Send className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Publishing Configuration</h1>
            <p className="text-xs text-zinc-500">Control how AI predictions are published to users</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && (
        <div className="text-center py-12 text-zinc-500 text-sm">Loading configuration…</div>
      )}

      {!loading && (
        <>
          {/* ── Feedback ── */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {error}
            </div>
          )}
          {success && (
            <div className="px-4 py-3 rounded-xl bg-green-500/10 border border-green-500/20 text-xs text-green-400">
              {success}
            </div>
          )}

          {/* ── Info banner ── */}
          <div className="flex gap-3 px-4 py-3 rounded-xl bg-blue-500/[0.07] border border-blue-500/20">
            <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-blue-300 leading-relaxed">
              With <span className="font-semibold">Manual Review</span>, predictions enter a
              "Pending Review" queue and are never auto-published. Auto-publish only acts on{" "}
              <span className="font-semibold">approved / draft</span> predictions when{" "}
              <span className="font-semibold">Require Admin Approval</span> is on — or on all
              AI-reviewed predictions when it is off.
            </p>
          </div>

          {/* ── Master toggle ── */}
          <div
            className={`flex items-center justify-between gap-4 rounded-xl px-5 py-4 border transition-colors ${
              autoPublishEnabled
                ? "bg-green-500/[0.08] border-green-500/25"
                : "bg-white/[0.03] border-white/[0.06]"
            }`}
          >
            <div>
              <p
                className={`text-sm font-semibold ${
                  autoPublishEnabled ? "text-green-300" : "text-white"
                }`}
              >
                Auto-Publish
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {autoPublishEnabled
                  ? "Predictions are being published automatically based on rules below"
                  : "All predictions require manual action before reaching users"}
              </p>
            </div>
            <Toggle
              checked={autoPublishEnabled}
              onChange={(v) => patch("autoPublish", v)}
              color="green"
            />
          </div>

          {/* ── Conditional config sections ── */}
          {autoPublishEnabled && (
            <>
              {/* Section: Publish Mode */}
              <SectionCard
                icon={<Clock className="w-3.5 h-3.5 text-violet-400" />}
                title="Publish Mode"
                subtitle="When should predictions be published after analysis completes?"
              >
                <div className="space-y-2">
                  {(
                    [
                      {
                        value: "manual",
                        label: "Manual Review",
                        desc: "Predictions go to a pending queue; admin publishes them",
                      },
                      {
                        value: "immediate",
                        label: "Immediate",
                        desc: "Publish as soon as AI analysis meets the quality gate",
                      },
                      {
                        value: "hours_before",
                        label: "Hours Before Kickoff",
                        desc: "Schedule publish N hours before the match starts",
                      },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        form.autoPublishMode === opt.value
                          ? "bg-violet-500/10 border-violet-500/30"
                          : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="publishMode"
                        value={opt.value}
                        checked={form.autoPublishMode === opt.value}
                        onChange={() => patch("autoPublishMode", opt.value)}
                        className="mt-0.5 accent-violet-500"
                      />
                      <div>
                        <p className="text-sm text-white">{opt.label}</p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>

                {form.autoPublishMode === "hours_before" && (
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs text-zinc-400 whitespace-nowrap">Hours before kickoff</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={form.hoursBeforeKickoff ?? 24}
                      onChange={(e) =>
                        patch(
                          "hoursBeforeKickoff",
                          Math.min(72, Math.max(1, parseInt(e.target.value) || 1))
                        )
                      }
                      className="w-24 bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                    <span className="text-xs text-zinc-500">hours (1 – 72)</span>
                  </div>
                )}
              </SectionCard>

              {/* Section: Quality Gate */}
              <SectionCard
                icon={<Star className="w-3.5 h-3.5 text-violet-400" />}
                title="Quality Gate"
                subtitle="Minimum standards a prediction must meet to be auto-published"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-zinc-400">
                      Minimum Confidence to Publish
                    </label>
                    <span className="text-sm font-mono text-violet-400 font-semibold">
                      {form.minConfidenceToPublish ?? 70}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={form.minConfidenceToPublish ?? 70}
                    onChange={(e) => patch("minConfidenceToPublish", parseInt(e.target.value))}
                    className="w-full accent-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>1% — publish anything</span>
                    <span>100% — almost nothing</span>
                  </div>
                </div>

                <ToggleRow
                  label="VIP Predictions Only"
                  description="When enabled, only predictions flagged as VIP are eligible for auto-publish"
                  checked={form.publishVipOnly ?? false}
                  onChange={(v) => patch("publishVipOnly", v)}
                  color="amber"
                />
              </SectionCard>

              {/* Section: Admin Approval */}
              <SectionCard
                icon={<ShieldCheck className="w-3.5 h-3.5 text-violet-400" />}
                title="Admin Approval"
                subtitle="Require a human to approve predictions before they can be auto-published"
              >
                <ToggleRow
                  label="Require Admin Approval"
                  checked={form.requireAdminApproval ?? false}
                  onChange={(v) => patch("requireAdminApproval", v)}
                />
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {form.requireAdminApproval
                    ? "Auto-publish will only act on predictions already moved to the 'draft' status by an admin. Raw AI-reviewed predictions will remain in the queue until approved."
                    : "Auto-publish will act on all predictions that reach 'ai_review' status and meet the quality gate — no human step required."}
                </p>
              </SectionCard>

              {/* Section: Match Queuing */}
              <SectionCard
                icon={<ListChecks className="w-3.5 h-3.5 text-violet-400" />}
                title="Match Queuing"
                subtitle="Automatically enqueue upcoming fixtures for AI analysis"
              >
                <ToggleRow
                  label="Auto-Queue New Matches"
                  description="When a match is synced from a data provider, automatically add it to the AI analysis queue"
                  checked={form.autoQueueNewMatches ?? false}
                  onChange={(v) => patch("autoQueueNewMatches", v)}
                />

                {form.autoQueueNewMatches && (
                  <div className="flex items-center gap-3 pt-1">
                    <label className="text-xs text-zinc-400 whitespace-nowrap">Queue fixtures up to</label>
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={form.queueHoursAhead ?? 48}
                      onChange={(e) =>
                        patch(
                          "queueHoursAhead",
                          Math.min(168, Math.max(1, parseInt(e.target.value) || 1))
                        )
                      }
                      className="w-24 bg-black/20 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500/50"
                    />
                    <span className="text-xs text-zinc-500">hours ahead (1 – 168)</span>
                  </div>
                )}
              </SectionCard>
            </>
          )}

          {/* ── Save ── */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {!autoPublishEnabled && (
              <p className="text-xs text-zinc-600 flex items-center gap-1.5">
                <Zap className="w-3 h-3" />
                Enable Auto-Publish to configure publishing rules
              </p>
            )}
          </div>

          {/* ── Metadata ── */}
          {config?.updatedAt && (
            <p className="text-[10px] text-zinc-600">
              Last updated: {new Date(config.updatedAt).toLocaleString("en-GB")}
              {config.updatedBy ? ` by ${config.updatedBy}` : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}

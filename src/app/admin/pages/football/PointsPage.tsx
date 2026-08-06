/**
 * Admin Football Daily Points Management — Phase 20.4
 *
 * Tabs:
 *   1. Overview  — current config summary + feature status
 *   2. Config    — edit all football.* SystemConfig keys
 *
 * Config keys managed:
 *   feature.football_daily_points  (boolean) — enable/disable feature
 *   football.points_per_day        (number)  — VIP daily points (default 25)
 *   football.points_verified       (number)  — Verified daily points (default 15)
 *   football.points_normal         (number)  — Normal daily points (default 10)
 *   football.points_per_conversion (number)  — pts required to convert (default 1000)
 *   football.usd_per_conversion    (number)  — USD value per conversion (default 2.00)
 *
 * Permissions:
 *   View:   admin.football.view
 *   Manage: admin.football.manage
 *   Config: admin.config.edit
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Zap, BarChart3, Settings, RefreshCw, CheckCircle2, Lock,
  TrendingUp, Coins,
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

interface ConfigEntry { key: string; value: unknown; updatedAt: string }

type Tab = "overview" | "config";
const TABS: Array<{ id: Tab; label: string; icon: typeof Zap }> = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "config",   label: "Config",   icon: Settings  },
];

// ── Config field definitions ──────────────────────────────────────────────────

interface FieldDef {
  key:        string;
  label:      string;
  hint:       string;
  type:       "boolean" | "number";
  defaultVal: unknown;
  min?:       number;
  step?:      number;
}

const FEATURE_FIELDS: FieldDef[] = [
  {
    key:        "feature.football_daily_points",
    label:      "Football Daily Points Enabled",
    hint:       "When disabled, users cannot claim or see the daily points section",
    type:       "boolean",
    defaultVal: false,
  },
];

const POINTS_FIELDS: FieldDef[] = [
  {
    key:        "football.points_per_day",
    label:      "VIP Daily Points",
    hint:       "Points awarded to VIP subscribers per daily claim",
    type:       "number",
    defaultVal: 25,
    min:        1,
  },
  {
    key:        "football.points_verified",
    label:      "Verified (KYC) Daily Points",
    hint:       "Points awarded to KYC-verified users per daily claim",
    type:       "number",
    defaultVal: 15,
    min:        1,
  },
  {
    key:        "football.points_normal",
    label:      "Normal User Daily Points",
    hint:       "Points awarded to standard users per daily claim",
    type:       "number",
    defaultVal: 10,
    min:        1,
  },
];

const CONVERSION_FIELDS: FieldDef[] = [
  {
    key:        "football.points_per_conversion",
    label:      "Points per Conversion",
    hint:       "How many points are required for one conversion",
    type:       "number",
    defaultVal: 1000,
    min:        1,
  },
  {
    key:        "football.usd_per_conversion",
    label:      "USD per Conversion ($)",
    hint:       "Dollar value credited to game wallet per conversion",
    type:       "number",
    defaultVal: 2.00,
    min:        0.01,
    step:       0.01,
  },
];

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [configs, setConfigs] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setConfigs(await adminFetch<ConfigEntry[]>("/api/v1/admin/config")); }
    catch { toast.error("Failed to load config"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const get = (key: string, def: unknown) => configs.find(c => c.key === key)?.value ?? def;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-[#18181b] border border-white/[0.06]" />)}
        </div>
      </div>
    );
  }

  const enabled         = Boolean(get("feature.football_daily_points", false));
  const vipPts          = Number(get("football.points_per_day",        25));
  const verifiedPts     = Number(get("football.points_verified",       15));
  const normalPts       = Number(get("football.points_normal",         10));
  const convThreshold   = Number(get("football.points_per_conversion", 1000));
  const convUsd         = Number(get("football.usd_per_conversion",    2.00));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Feature Status"
          value={enabled ? "Enabled" : "Disabled"}
          icon={enabled ? CheckCircle2 : Lock}
          iconColor={enabled ? "text-emerald-400" : "text-zinc-500"}
          iconBg={enabled ? "bg-emerald-500/10" : "bg-zinc-800"}
        />
        <StatCard title="VIP Points/Day"      value={vipPts}        icon={Zap}       iconColor="text-yellow-400"  iconBg="bg-yellow-500/10"  />
        <StatCard title="Conversion Threshold" value={`${convThreshold} pts`} icon={Coins} iconColor="text-purple-400" iconBg="bg-purple-500/10" />
        <StatCard title="USD per Conversion"  value={`$${convUsd.toFixed(2)}`} icon={TrendingUp} iconColor="text-indigo-400" iconBg="bg-indigo-500/10" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="Daily Points by Tier" description="Points awarded per tier per daily claim.">
          <div className="space-y-3 mt-3">
            {[
              { label: "VIP",      pts: vipPts,      color: "text-yellow-400", barW: "100%" },
              { label: "Verified", pts: verifiedPts, color: "text-blue-400",   barW: `${(verifiedPts / vipPts * 100).toFixed(0)}%` },
              { label: "Normal",   pts: normalPts,   color: "text-zinc-400",   barW: `${(normalPts / vipPts * 100).toFixed(0)}%` },
            ].map(t => (
              <div key={t.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={t.color}>{t.label}</span>
                  <span className="text-zinc-300 font-medium">{t.pts} pts/day</span>
                </div>
                <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div className={`h-full rounded-full bg-current ${t.color} transition-all`} style={{ width: t.barW }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Conversion Rate" description="How points convert to game wallet credits.">
          <div className="space-y-3 mt-3">
            <div className="bg-zinc-900/60 rounded-xl p-4 border border-white/[0.04]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Points required</span>
                <span className="text-sm font-semibold text-white">{convThreshold.toLocaleString()} pts</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-zinc-400">Game wallet credit</span>
                <span className="text-sm font-semibold text-emerald-400">${convUsd.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.05]">
                <span className="text-xs text-zinc-500">Effective rate</span>
                <span className="text-xs text-zinc-400">${(convUsd / convThreshold * 1000).toFixed(4)} per 1,000 pts</span>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ── Config Tab ─────────────────────────────────────────────────────────────────

function ConfigTab({ canEdit }: { canEdit: boolean }) {
  const [configs,  setConfigs]  = useState<ConfigEntry[]>([]);
  const [editing,  setEditing]  = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState<Record<string, boolean>>({});
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setConfigs(await adminFetch<ConfigEntry[]>("/api/v1/admin/config")); }
    catch { toast.error("Failed to load config"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getVal = (key: string, def: unknown) => configs.find(c => c.key === key)?.value ?? def;

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

  const toggleBool = (key: string) => {
    if (!canEdit) return;
    const current = Boolean(getVal(key, false));
    saveKey(key, !current);
  };

  if (loading) return <div className="h-64 rounded-2xl bg-[#18181b] animate-pulse" />;

  const renderBoolField = (f: FieldDef) => {
    const val = Boolean(getVal(f.key, f.defaultVal));
    return (
      <div key={f.key} className="flex items-center justify-between py-3 border-b border-white/[0.05] last:border-0">
        <div>
          <p className="text-sm font-medium text-white">{f.label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{f.hint}</p>
        </div>
        <div className="flex items-center gap-3 ml-4 flex-shrink-0">
          <span className={`text-xs font-medium ${val ? "text-emerald-400" : "text-zinc-500"}`}>{val ? "On" : "Off"}</span>
          <button
            onClick={() => toggleBool(f.key)}
            disabled={!canEdit || saving[f.key]}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${val ? "bg-emerald-500" : "bg-zinc-700"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${val ? "translate-x-5" : ""}`} />
          </button>
        </div>
      </div>
    );
  };

  const renderNumberField = (f: FieldDef) => {
    const val    = Number(getVal(f.key, f.defaultVal));
    const editVal = editing[f.key] ?? String(val);
    return (
      <div key={f.key} className="flex items-start gap-4 py-3 border-b border-white/[0.05] last:border-0">
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{f.label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{f.hint}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="number"
            min={f.min ?? 0}
            step={f.step ?? 1}
            value={editVal}
            onChange={e => setEditing(ed => ({ ...ed, [f.key]: e.target.value }))}
            disabled={!canEdit}
            className="w-24 h-8 bg-zinc-900 border border-white/[0.08] rounded-lg px-2 text-sm text-white text-right focus:outline-none focus:border-zinc-600 disabled:opacity-50"
          />
          {canEdit && (
            <button
              onClick={() => saveKey(f.key, f.step ? parseFloat(editVal) : parseInt(editVal))}
              disabled={saving[f.key] || editVal === String(val)}
              className="h-8 px-3 rounded-lg bg-indigo-500/20 border border-indigo-500/20 text-xs text-indigo-300 hover:text-indigo-200 disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {saving[f.key] ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Save"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <SectionCard title="Feature Flags">
        {FEATURE_FIELDS.map(f => renderBoolField(f))}
      </SectionCard>

      <SectionCard title="Daily Points by Tier" description="These values determine how many points each user tier earns per daily claim.">
        {POINTS_FIELDS.map(f => renderNumberField(f))}
      </SectionCard>

      <SectionCard title="Conversion Settings" description="Define how points convert into game wallet credits.">
        {CONVERSION_FIELDS.map(f => renderNumberField(f))}
      </SectionCard>

      {!canEdit && <p className="text-xs text-zinc-600">Config editing requires admin.config.edit permission.</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PointsPage() {
  const { can } = useAdminAccess();
  const [tab, setTab] = useState<Tab>("overview");

  const canView   = can("admin.football.view");
  const canConfig = can("admin.config.edit");

  if (!canView) {
    return (
      <div className="p-6">
        <EmptyState icon={Zap} title="Access Denied" description="You do not have permission to view Football Points Management." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Football Daily Points"
        description="Configure daily point rewards, conversion rates, and feature availability"
        badge={{ label: "Phase 20", variant: "default" }}
      />

      <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-1 w-fit">
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

      {tab === "overview" && <OverviewTab />}
      {tab === "config"   && <ConfigTab canEdit={canConfig} />}
    </div>
  );
}

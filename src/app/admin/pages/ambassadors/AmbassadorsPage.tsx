/**
 * Admin Ambassador Management — Phase 20.4
 *
 * Tabs:
 *   1. Overview     — summary stats (pending, approved, rejected, total)
 *   2. Applications — paginated list, filter by status, search, approve/reject
 *   3. Config       — feature flag toggle for ambassador_program
 *
 * APIs used:
 *   GET  /api/v1/admin/ambassadors?status=...   → list applications
 *   POST /api/v1/admin/ambassadors/:id/review   → approve | reject
 *   GET  /api/v1/admin/config                   → read feature flag
 *   PUT  /api/v1/admin/config/:key              → write feature flag
 *
 * Permissions:
 *   View:   admin.ambassadors.view
 *   Manage: admin.ambassadors.manage
 *   Config: admin.config.edit
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Award, BarChart3, FileText, Settings, Search, RefreshCw,
  X, CheckCircle2, XCircle, Clock, ChevronRight, ExternalLink,
  Users, Star, Shield,
} from "lucide-react";
import { PageHeader }    from "../../components/ui/PageHeader";
import { StatCard }      from "../../components/ui/StatCard";
import { SectionCard }   from "../../components/ui/SectionCard";
import { StatusBadge }   from "../../components/ui/StatusBadge";
import { EmptyState }    from "../../components/ui/EmptyState";
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

interface AmbassadorApp {
  id:              string;
  status:          string;
  username:        string;
  bio:             string | null;
  rejectionReason: string | null;
  reviewedAt:      string | null;
  createdAt:       string;
  user: { id: string; email: string; username: string | null };
}

interface ConfigEntry { key: string; value: unknown; updatedAt: string }

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = "overview" | "applications" | "config";
const TABS: Array<{ id: Tab; label: string; icon: typeof Award }> = [
  { id: "overview",      label: "Overview",      icon: BarChart3  },
  { id: "applications",  label: "Applications",  icon: FileText   },
  { id: "config",        label: "Config",        icon: Settings   },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  pending:  "text-amber-400  bg-amber-500/10  border-amber-500/20",
  approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  rejected: "text-red-400    bg-red-500/10    border-red-500/20",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium capitalize ${STATUS_COLORS[status] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"}`}>
      {status === "pending"  && <Clock       className="w-3 h-3" />}
      {status === "approved" && <CheckCircle2 className="w-3 h-3" />}
      {status === "rejected" && <XCircle     className="w-3 h-3" />}
      {status}
    </span>
  );
}

function ProgramLevelPill({ level }: { level: string }) {
  const MAP: Record<string, { label: string; icon: typeof Star; cls: string }> = {
    referral:   { label: "Referral",   icon: Star,   cls: "text-zinc-300 bg-zinc-800 border-zinc-700" },
    affiliate:  { label: "Affiliate",  icon: Shield, cls: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
    ambassador: { label: "Ambassador", icon: Award,  cls: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" },
  };
  const m = MAP[level] ?? MAP.referral;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${m.cls}`}>
      <m.icon className="w-3 h-3" />{m.label}
    </span>
  );
}

// ── Reject Dialog ─────────────────────────────────────────────────────────────

function RejectDialog({ onConfirm, onCancel }: { onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 bg-[#18181b] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-base font-semibold text-white">Reject Application</h3>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-sm text-zinc-400 mb-4">Provide a reason — it will be shown to the applicant.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Insufficient audience, unverified social accounts, etc."
          rows={3}
          className="w-full bg-zinc-900 border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600"
        />
        <div className="flex gap-2 mt-4">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-xl bg-zinc-800 border border-white/[0.06] text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
          <button
            onClick={() => onConfirm(reason.trim())}
            className="flex-1 px-4 py-2 rounded-xl bg-red-500/15 border border-red-500/20 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Application Drawer ────────────────────────────────────────────────────────

function AppDrawer({
  app, canManage, onClose, onUpdated,
}: {
  app: AmbassadorApp; canManage: boolean; onClose: () => void; onUpdated: () => void;
}) {
  const [acting,  setActing]  = useState(false);
  const [showReject, setShowReject] = useState(false);

  const approve = async () => {
    setActing(true);
    try {
      await adminFetch(`/api/v1/admin/ambassadors/${app.id}/review`, {
        method: "POST",
        body: JSON.stringify({ action: "approve" }),
      });
      toast.success(`@${app.username} approved as Ambassador`);
      onUpdated();
    } catch (e: any) { toast.error(e.message ?? "Approve failed"); }
    finally { setActing(false); }
  };

  const reject = async (reason: string) => {
    setActing(true);
    try {
      await adminFetch(`/api/v1/admin/ambassadors/${app.id}/review`, {
        method: "POST",
        body: JSON.stringify({ action: "reject", rejectionReason: reason || undefined }),
      });
      toast.success("Application rejected");
      setShowReject(false);
      onUpdated();
    } catch (e: any) { toast.error(e.message ?? "Reject failed"); }
    finally { setActing(false); }
  };

  // Social links stored as JSON string in backend
  let socialLinks: string[] = [];
  try { socialLinks = JSON.parse((app as any).socialLinks ?? "[]") as string[]; } catch { /* ignore */ }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-start justify-end">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <aside className="relative z-10 h-full w-full max-w-md bg-[#111115] border-l border-white/[0.06] flex flex-col shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Award className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">@{app.username}</p>
                <p className="text-xs text-zinc-500">{app.user.email}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill status={app.status} />
              <span className="text-xs text-zinc-600">Submitted {fmtDate(app.createdAt)}</span>
            </div>

            {app.bio && (
              <SectionCard title="Bio">
                <p className="text-sm text-zinc-300 leading-relaxed">{app.bio}</p>
              </SectionCard>
            )}

            {socialLinks.length > 0 && (
              <SectionCard title="Social Links">
                <div className="space-y-2">
                  {socialLinks.map(link => (
                    <a key={link} href={link} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors break-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                      {link}
                    </a>
                  ))}
                </div>
              </SectionCard>
            )}

            {app.status === "rejected" && app.rejectionReason && (
              <SectionCard title="Rejection Reason">
                <p className="text-sm text-red-400 leading-relaxed">{app.rejectionReason}</p>
              </SectionCard>
            )}

            {app.reviewedAt && (
              <p className="text-xs text-zinc-600">Reviewed on {fmtDate(app.reviewedAt)}</p>
            )}
          </div>

          {/* Footer */}
          {canManage && app.status === "pending" && (
            <div className="flex gap-2 px-5 py-4 border-t border-white/[0.06] flex-shrink-0">
              <button
                onClick={() => setShowReject(true)}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl bg-red-500/15 border border-red-500/20 text-sm text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={approve}
                disabled={acting}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/20 text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {acting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approve
              </button>
            </div>
          )}
        </aside>
      </div>

      {showReject && (
        <RejectDialog
          onConfirm={reject}
          onCancel={() => setShowReject(false)}
        />
      )}
    </>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const [apps, setApps] = useState<AmbassadorApp[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setApps(await adminFetch<AmbassadorApp[]>("/api/v1/admin/ambassadors")); }
    catch { toast.error("Failed to load ambassadors"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = {
    total:    apps.length,
    pending:  apps.filter(a => a.status === "pending").length,
    approved: apps.filter(a => a.status === "approved").length,
    rejected: apps.filter(a => a.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-[#18181b] border border-white/[0.06]" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Applications" value={counts.total}    icon={Users}       iconColor="text-indigo-400"  iconBg="bg-indigo-500/10" />
        <StatCard title="Pending Review"     value={counts.pending}  icon={Clock}       iconColor="text-amber-400"   iconBg="bg-amber-500/10" />
        <StatCard title="Approved"           value={counts.approved} icon={CheckCircle2} iconColor="text-emerald-400" iconBg="bg-emerald-500/10" />
        <StatCard title="Rejected"           value={counts.rejected} icon={XCircle}     iconColor="text-red-400"     iconBg="bg-red-500/10" />
      </div>

      <SectionCard title="Recent Applications">
        {apps.length === 0 ? (
          <EmptyState icon={Award} title="No applications yet" description="Ambassador applications will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["Username", "Email", "Status", "Submitted"].map(h => (
                    <th key={h} className="text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {apps.slice(0, 10).map(app => (
                  <tr key={app.id} className="hover:bg-white/[0.02]">
                    <td className="py-3 pr-4 text-white font-medium">@{app.username}</td>
                    <td className="py-3 pr-4 text-zinc-400">{app.user.email}</td>
                    <td className="py-3 pr-4"><StatusPill status={app.status} /></td>
                    <td className="py-3 pr-4 text-zinc-500 text-xs">{fmtDate(app.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ── Applications Tab ──────────────────────────────────────────────────────────

function ApplicationsTab({ canManage }: { canManage: boolean }) {
  const [apps,       setApps]       = useState<AmbassadorApp[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected,   setSelected]   = useState<AmbassadorApp | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const qs = status && status !== "all" ? `?status=${status}` : "";
      const data = await adminFetch<AmbassadorApp[]>(`/api/v1/admin/ambassadors${qs}`);
      setApps(data);
    } catch { toast.error("Failed to load applications"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(statusFilter); }, [load, statusFilter]);

  const handleUpdated = () => { setSelected(null); load(statusFilter); };

  const filtered = search.trim()
    ? apps.filter(a =>
        a.username.toLowerCase().includes(search.toLowerCase()) ||
        a.user.email.toLowerCase().includes(search.toLowerCase())
      )
    : apps;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (searchTimer.current) clearTimeout(searchTimer.current);
            }}
            placeholder="Search by username or email…"
            className="w-full pl-9 pr-3 h-9 bg-[#18181b] border border-white/[0.08] rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-white/[0.15]"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", "pending", "approved", "rejected"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20" : "text-zinc-500 hover:text-white border border-transparent"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => load(statusFilter)} disabled={loading} className="p-2 text-zinc-500 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-[#18181b]" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Award} title="No applications" description={search ? "No results match your search." : `No ${statusFilter !== "all" ? statusFilter : ""} applications.`} />
      ) : (
        <div className="bg-[#18181b] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  {["Username", "Email", "Status", "Submitted", ""].map((h, i) => (
                    <th key={i} className="text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filtered.map(app => (
                  <tr
                    key={app.id}
                    onClick={() => setSelected(app)}
                    className="hover:bg-white/[0.02] cursor-pointer group"
                  >
                    <td className="px-4 py-3 text-white font-medium">@{app.username}</td>
                    <td className="px-4 py-3 text-zinc-400 text-xs">{app.user.email}</td>
                    <td className="px-4 py-3"><StatusPill status={app.status} /></td>
                    <td className="px-4 py-3 text-zinc-500 text-xs">{fmtDate(app.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 ml-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <AppDrawer
          app={selected}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}

// ── Config Tab ─────────────────────────────────────────────────────────────────

function ConfigTab({ canEdit }: { canEdit: boolean }) {
  const [enabled,  setEnabled]  = useState<boolean | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [loading,  setLoading]  = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const configs = await adminFetch<ConfigEntry[]>("/api/v1/admin/config");
      const flag = configs.find(c => c.key === "feature.ambassador_program");
      setEnabled(flag ? Boolean(flag.value) : false);
    } catch { toast.error("Failed to load config"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (newVal: boolean) => {
    setSaving(true);
    try {
      await adminFetch("/api/v1/admin/config/feature.ambassador_program", {
        method: "PUT",
        body: JSON.stringify({ value: newVal }),
      });
      setEnabled(newVal);
      toast.success(`Ambassador Program ${newVal ? "enabled" : "disabled"}`);
    } catch (e: any) { toast.error(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="h-32 rounded-2xl bg-[#18181b] animate-pulse" />;

  return (
    <SectionCard title="Feature Flags" description="Controls visibility of the Ambassador Program for all users.">
      <div className="flex items-center justify-between py-3 border-b border-white/[0.05]">
        <div>
          <p className="text-sm font-medium text-white">Ambassador Program</p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {enabled ? "Applications are open — users can apply and manage their status." : "Hidden from users — no applications can be submitted."}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className={`text-xs font-medium ${enabled ? "text-emerald-400" : "text-zinc-500"}`}>
            {enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            onClick={() => canEdit && !saving && save(!enabled)}
            disabled={!canEdit || saving}
            className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${enabled ? "bg-emerald-500" : "bg-zinc-700"} ${!canEdit ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>
      {!canEdit && <p className="text-xs text-zinc-600 mt-3">Config editing requires admin.config.edit permission.</p>}
    </SectionCard>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AmbassadorsPage() {
  const { can } = useAdminAccess();
  const [tab, setTab] = useState<Tab>("overview");

  const canView   = can("admin.ambassadors.view");
  const canManage = can("admin.ambassadors.manage");
  const canConfig = can("admin.config.edit");

  if (!canView) {
    return (
      <div className="p-6">
        <EmptyState icon={Award} title="Access Denied" description="You do not have permission to view Ambassador Management." />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Ambassador Program"
        description="Manage ambassador applications, approvals, and program configuration"
        badge={{ label: "Phase 20", variant: "default" }}
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/[0.06] rounded-2xl p-1 w-fit flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview"      && <OverviewTab />}
      {tab === "applications"  && <ApplicationsTab canManage={canManage} />}
      {tab === "config"        && <ConfigTab canEdit={canConfig} />}
    </div>
  );
}

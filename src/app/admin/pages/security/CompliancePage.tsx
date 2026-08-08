/**
 * Compliance Page — Phase 15
 *
 * Audit export, retention summary, and compliance statistics.
 * All data comes from the backend. No frontend-generated truth.
 */

import { useState, useEffect } from "react";
import { FileText, Download, RefreshCw, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface ComplianceSummary {
  period:         { from: string; to: string };
  audit:          { totalEntries: number; securityEvents: number };
  authentication: { totalLogins: number; successLogins: number; failedLogins: number; failRate: number };
  fraud:          { totalAlerts: number; openAlerts: number; resolvedAlerts: number };
  ipControls:     { blockedIps: number };
  generatedAt:    string;
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
      <p className="text-[11px] text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-white tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}


export default function CompliancePage() {
  const [data, setData]       = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo]     = useState("");

  const load = () => {
    setLoading(true);
    apiFetch<ComplianceSummary>("/api/v1/admin/security/compliance/summary")
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const p = new URLSearchParams();
      if (exportFrom) p.set("from", exportFrom);
      if (exportTo)   p.set("to",   exportTo);
      const token = getToken();
      const res = await fetch(`${API_BASE}/api/v1/admin/security/audit-logs/export?${p}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `audit-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Audit log exported");
    } catch {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Compliance</h1>
            <p className="text-xs text-zinc-500">Audit export, retention summary, and platform compliance overview</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data && (
        <div className="text-center py-10 text-zinc-500 text-sm">Loading compliance data…</div>
      )}

      {data && (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Audit Logs"   value={data.audit.totalEntries}          sub={`${data.audit.securityEvents} security events`} />
            <StatCard label="Total Logins"        value={data.authentication.totalLogins}  sub={`${data.authentication.failRate}% failure rate`} />
            <StatCard label="Fraud Alerts"         value={data.fraud.totalAlerts}           sub={`${data.fraud.openAlerts} open`} />
            <StatCard label="Blocked IPs"          value={data.ipControls.blockedIps}       />
          </div>

          {/* Authentication breakdown */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-sm font-medium text-white mb-3">Authentication Summary</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Logins",    count: data.authentication.totalLogins },
                { label: "Successful",      count: data.authentication.successLogins },
                { label: "Failed",          count: data.authentication.failedLogins },
              ].map(({ label, count }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-semibold text-white tabular-nums">{count.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Fraud breakdown */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-sm font-medium text-white mb-3">Fraud Alerts</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Total Alerts",   count: data.fraud.totalAlerts },
                { label: "Open",           count: data.fraud.openAlerts },
                { label: "Resolved",       count: data.fraud.resolvedAlerts },
              ].map(({ label, count }) => (
                <div key={label} className="text-center">
                  <p className="text-2xl font-semibold text-white tabular-nums">{count.toLocaleString()}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Period info */}
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" />
            <span>Period: {data.period.from} → {data.period.to.slice(0, 10)}</span>
            <span className="ml-auto">Generated: {new Date(data.generatedAt).toLocaleString("en-GB")}</span>
          </div>
        </>
      )}

      {/* CSV Export */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <p className="text-sm font-medium text-white mb-1">Export Audit Log</p>
        <p className="text-xs text-zinc-500 mb-4">Download all audit records as CSV. Up to 10,000 rows per export.</p>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">From (optional)</label>
            <input
              type="datetime-local"
              value={exportFrom}
              onChange={e => setExportFrom(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1">To (optional)</label>
            <input
              type="datetime-local"
              value={exportTo}
              onChange={e => setExportTo(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? "Exporting…" : "Download CSV"}
          </button>
        </div>
      </div>
    </div>
  );
}

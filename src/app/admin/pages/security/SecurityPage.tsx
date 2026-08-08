/**
 * Security Hub Page — Phase 15
 *
 * Central hub for all security and audit features.
 * Links to: Audit Log, Security Events, Login History, Sessions,
 * IP Controls, Fraud Alerts, Compliance.
 */

import { useState, useEffect } from "react";
import { NavLink } from "react-router";
import {
  Shield, ScrollText, AlertTriangle, LogIn,
  Monitor, Globe, AlertOctagon, FileCheck,
  ChevronRight, RefreshCw,
} from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";

function getToken() {
  return localStorage.getItem("bitzimi_access_token") ?? "";
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface ComplianceSummary {
  audit:           { totalEntries: number; securityEvents: number };
  authentication:  { totalLogins: number; successLogins: number; failedLogins: number; failRate: number };
  fraud:           { totalAlerts: number; openAlerts: number; resolvedAlerts: number };
  ipControls:      { blockedIps: number };
}

const CARDS = [
  {
    id: "audit-logs",
    label: "Audit Log",
    description: "Complete record of all admin actions with actor, target, and timestamp.",
    path: "/admin/security/audit-logs",
    icon: ScrollText,
    color: "text-indigo-400",
    bg:    "bg-indigo-500/10",
  },
  {
    id: "events",
    label: "Security Events",
    description: "Suspicious activity, permission violations, and security alerts.",
    path: "/admin/security/events",
    icon: AlertTriangle,
    color: "text-amber-400",
    bg:    "bg-amber-500/10",
  },
  {
    id: "login-history",
    label: "Login History",
    description: "Successful and failed login attempts with device and location data.",
    path: "/admin/security/login-history",
    icon: LogIn,
    color: "text-green-400",
    bg:    "bg-green-500/10",
  },
  {
    id: "sessions",
    label: "Session Management",
    description: "Active sessions, device tracking, and remote revocation.",
    path: "/admin/security/sessions",
    icon: Monitor,
    color: "text-blue-400",
    bg:    "bg-blue-500/10",
  },
  {
    id: "ip-controls",
    label: "IP Controls",
    description: "Allow list, block list, and temporary bans by IP address.",
    path: "/admin/security/ip-controls",
    icon: Globe,
    color: "text-purple-400",
    bg:    "bg-purple-500/10",
  },
  {
    id: "fraud-alerts",
    label: "Fraud Monitoring",
    description: "Pattern-based fraud detection: rapid activity, multi-accounts, suspicious withdrawals.",
    path: "/admin/security/fraud-alerts",
    icon: AlertOctagon,
    color: "text-red-400",
    bg:    "bg-red-500/10",
  },
  {
    id: "compliance",
    label: "Compliance",
    description: "Export audit logs and security data for compliance investigations.",
    path: "/admin/security/compliance",
    icon: FileCheck,
    color: "text-teal-400",
    bg:    "bg-teal-500/10",
  },
];

export default function SecurityPage() {
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiFetch<ComplianceSummary>("/api/v1/admin/security/compliance/summary")
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Security & Audit</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Monitor, audit, and protect the platform</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 hover:text-white text-sm transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats overview */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Audit Entries",   value: summary.audit.totalEntries,             color: "text-indigo-400" },
            { label: "Security Events", value: summary.audit.securityEvents,            color: "text-amber-400" },
            { label: "Open Alerts",     value: summary.fraud.openAlerts,               color: "text-red-400" },
            { label: "Blocked IPs",     value: summary.ipControls.blockedIps,          color: "text-purple-400" },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Login stats */}
      {summary && (
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
          <p className="text-sm font-medium text-white mb-3">Authentication Overview</p>
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <p className="text-xs text-zinc-500">Total Logins</p>
              <p className="text-xl font-semibold text-white">{summary.authentication.totalLogins.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Successful</p>
              <p className="text-xl font-semibold text-green-400">{summary.authentication.successLogins.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Failed</p>
              <p className="text-xl font-semibold text-red-400">{summary.authentication.failedLogins.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Failure Rate</p>
              <p className={`text-xl font-semibold ${summary.authentication.failRate > 20 ? "text-red-400" : "text-zinc-300"}`}>
                {summary.authentication.failRate}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CARDS.map(card => {
          const Icon = card.icon;
          return (
            <NavLink
              key={card.id}
              to={card.path}
              className="group bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 hover:bg-white/[0.05] hover:border-white/[0.1] transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <Icon className={`w-4.5 h-4.5 ${card.color}`} />
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
              </div>
              <p className="text-sm font-medium text-white mb-1">{card.label}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{card.description}</p>
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

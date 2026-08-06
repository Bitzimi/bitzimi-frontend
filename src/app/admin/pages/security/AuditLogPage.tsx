/**
 * Audit Log Page — Phase 15
 *
 * Full searchable/filterable audit log with pagination and CSV export.
 * Reads from /api/v1/admin/security/audit-logs (requires admin.audit.view).
 */

import { useState, useEffect, useCallback } from "react";
import {
  ScrollText, Search, Download, ChevronDown,
  ChevronLeft, ChevronRight, RefreshCw, Filter,
} from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface AuditEntry {
  id:            string;
  actorId:       string | null;
  actorEmail:    string | null;
  actorUsername: string | null;
  actorRole:     string | null;
  action:        string;
  targetType:    string | null;
  targetId:      string | null;
  ipAddress:     string | null;
  userAgent:     string | null;
  metadata:      unknown;
  previousValue: unknown;
  newValue:      unknown;
  httpStatus:    number | null;
  createdAt:     string;
}

interface AuditLogResult {
  items:      AuditEntry[];
  nextCursor: string | null;
  hasMore:    boolean;
}

const STATUS_COLOR: Record<number, string> = {
  200: "text-green-400",
  201: "text-green-400",
  204: "text-green-400",
  400: "text-amber-400",
  401: "text-orange-400",
  403: "text-red-400",
  404: "text-zinc-400",
  500: "text-red-500",
};

function statusColor(s: number | null) {
  if (!s) return "text-zinc-500";
  return STATUS_COLOR[s] ?? (s >= 500 ? "text-red-500" : s >= 400 ? "text-amber-400" : "text-green-400");
}

function methodColor(action: string) {
  if (action.startsWith("POST"))   return "text-blue-400";
  if (action.startsWith("PATCH"))  return "text-amber-400";
  if (action.startsWith("PUT"))    return "text-amber-400";
  if (action.startsWith("DELETE")) return "text-red-400";
  return "text-zinc-400";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" });
}

export default function AuditLogPage() {
  const [items, setItems]         = useState<AuditEntry[]>([]);
  const [cursor, setCursor]       = useState<string | null>(null);
  const [hasMore, setHasMore]     = useState(false);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<string | null>(null);

  // Filters
  const [search, setSearch]     = useState("");
  const [targetType, setTarget] = useState("");
  const [from, setFrom]         = useState("");
  const [to, setTo]             = useState("");

  const buildUrl = useCallback((cur?: string | null) => {
    const p = new URLSearchParams({ limit: "50" });
    if (search)     p.set("action", search);
    if (targetType) p.set("targetType", targetType);
    if (from)       p.set("from", from);
    if (to)         p.set("to", to);
    if (cur)        p.set("cursor", cur);
    return `/api/v1/admin/security/audit-logs?${p}`;
  }, [search, targetType, from, to]);

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    apiFetch<AuditLogResult>(buildUrl(cur))
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [buildUrl]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to)   p.set("to", to);
      const data = await apiFetch<{ rows: unknown[]; total: number }>(`/api/v1/admin/security/audit-logs/export?${p}`);
      const csv = [
        "ID,Timestamp,Actor,Role,Action,Target,IP,Status",
        ...(data.rows as { id: string; timestamp: string; actor: string; role: string; action: string; target: string; ip: string; status: number }[]).map(r =>
          `"${r.id}","${r.timestamp}","${r.actor}","${r.role}","${r.action}","${r.target ?? ""}","${r.ip ?? ""}","${r.status ?? ""}"`
        ),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const TARGET_TYPES = ["user", "kyc_submission", "task", "task_proof", "withdrawal", "deposit", "notification", "system_config", "game"];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
            <ScrollText className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Audit Log</h1>
            <p className="text-xs text-zinc-500">All admin mutations — who, what, when, where</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-400">Filters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load()}
              placeholder="Action contains..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
            />
          </div>
          <div className="relative">
            <select
              value={targetType}
              onChange={e => { setTarget(e.target.value); }}
              className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            >
              <option value="">All targets</option>
              {TARGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
          </div>
          <input
            type="datetime-local"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
          />
          <input
            type="datetime-local"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500/50"
          />
        </div>
        <button
          onClick={() => load()}
          className="mt-3 px-4 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-sm transition-all"
        >
          Apply Filters
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr className="text-left">
              {["Timestamp", "Actor", "Action", "Target", "IP", "Status", ""].map(h => (
                <th key={h} className="px-4 py-3 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500 text-sm">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500 text-sm">No audit log entries found.</td></tr>
            )}
            {items.map(row => (
              <>
                <tr
                  key={row.id}
                  className="hover:bg-white/[0.02] cursor-pointer"
                  onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                >
                  <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-white truncate max-w-[120px]">{row.actorUsername ?? row.actorEmail ?? "system"}</p>
                    <p className="text-[10px] text-zinc-500 capitalize">{row.actorRole ?? ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-mono ${methodColor(row.action)}`}>
                      {row.action.length > 50 ? row.action.slice(0, 50) + "…" : row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {row.targetType ? <><span className="text-zinc-300">{row.targetType}</span>{row.targetId ? <span className="text-zinc-600">:{row.targetId.slice(0, 8)}</span> : null}</> : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500 font-mono">{row.ipAddress ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${statusColor(row.httpStatus)}`}>{row.httpStatus ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ChevronDown className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${expanded === row.id ? "rotate-180" : ""}`} />
                  </td>
                </tr>
                {expanded === row.id && (
                  <tr key={`${row.id}-detail`} className="bg-white/[0.02]">
                    <td colSpan={7} className="px-4 py-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <p className="text-zinc-500 mb-1 font-medium">User Agent</p>
                          <p className="text-zinc-400 break-all">{row.userAgent ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-zinc-500 mb-1 font-medium">Request Body</p>
                          <pre className="text-zinc-400 bg-black/20 rounded p-2 text-[10px] overflow-auto max-h-24">
                            {row.metadata ? JSON.stringify(row.metadata, null, 2) : "—"}
                          </pre>
                        </div>
                        <div>
                          <p className="text-zinc-500 mb-1 font-medium">Before / After</p>
                          <pre className="text-zinc-400 bg-black/20 rounded p-2 text-[10px] overflow-auto max-h-24">
                            {row.previousValue || row.newValue
                              ? JSON.stringify({ before: row.previousValue, after: row.newValue }, null, 2)
                              : "—"}
                          </pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
          <p className="text-xs text-zinc-500">{items.length} entries loaded</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setItems([]); setCursor(null); load(null); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-xs transition-all"
            >
              <ChevronLeft className="w-3 h-3" /> Reset
            </button>
            {hasMore && (
              <button
                onClick={() => load(cursor, true)}
                disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-xs transition-all"
              >
                Load more <ChevronRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Login History Page — Phase 15
 *
 * Complete login history: success + failure, with device, browser, OS, IP.
 */

import { useState, useEffect, useCallback } from "react";
import { LogIn, CheckCircle, XCircle, RefreshCw, ChevronDown, Search } from "lucide-react";

const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? "";
function getToken() { return localStorage.getItem("bitzimi_access_token") ?? ""; }
async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${getToken()}` } });
  const json = (await res.json()) as { data?: T };
  return json.data as T;
}

interface LoginEntry {
  id:            string;
  userId:        string | null;
  email:         string;
  success:       boolean;
  ipAddress:     string | null;
  userAgent:     string | null;
  deviceType:    string | null;
  browser:       string | null;
  os:            string | null;
  failureReason: string | null;
  sessionId:     string | null;
  createdAt:     string;
}

interface Result {
  items:      LoginEntry[];
  nextCursor: string | null;
  hasMore:    boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" });
}

const DEVICE_ICON: Record<string, string> = {
  desktop: "🖥",
  mobile:  "📱",
  tablet:  "📟",
  bot:     "🤖",
  unknown: "❓",
};

export default function LoginHistoryPage() {
  const [items, setItems]     = useState<LoginEntry[]>([]);
  const [cursor, setCursor]   = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail]     = useState("");
  const [success, setSuccess] = useState<string>("");

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "50" });
    if (email)   p.set("email", email);
    if (success) p.set("success", success);
    if (cur)     p.set("cursor", cur);
    apiFetch<Result>(`/api/v1/admin/security/login-history?${p}`)
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [email, success]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
            <LogIn className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Login History</h1>
            <p className="text-xs text-zinc-500">All authentication events with device and network data</p>
          </div>
        </div>
        <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load()}
            placeholder="Filter by email…"
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 w-60"
          />
        </div>
        <div className="relative">
          <select
            value={success}
            onChange={e => setSuccess(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none"
          >
            <option value="">All outcomes</option>
            <option value="true">Success only</option>
            <option value="false">Failures only</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>
        <button
          onClick={() => load()}
          className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-sm transition-all"
        >
          Search
        </button>
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              {["", "Timestamp", "Email", "Device", "Browser / OS", "IP Address", "Result"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500 text-sm">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-zinc-500 text-sm">No login history found.</td></tr>
            )}
            {items.map(row => (
              <tr key={row.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-center">
                  {row.success
                    ? <CheckCircle className="w-4 h-4 text-green-400 inline" />
                    : <XCircle className="w-4 h-4 text-red-400 inline" />
                  }
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="text-sm text-white truncate max-w-[180px]">{row.email}</p>
                  {row.userId && <p className="text-[10px] text-zinc-600 font-mono">{row.userId.slice(0, 8)}…</p>}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span title={row.deviceType ?? ""}>{DEVICE_ICON[row.deviceType ?? "unknown"] ?? "❓"}</span>
                  <span className="ml-1.5 text-zinc-400 text-xs">{row.deviceType ?? "—"}</span>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">
                  <p>{row.browser ?? "—"}</p>
                  <p className="text-zinc-600">{row.os ?? ""}</p>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{row.ipAddress ?? "—"}</td>
                <td className="px-4 py-3">
                  {row.success
                    ? <span className="text-xs text-green-400 font-medium">Success</span>
                    : <span className="text-xs text-red-400 font-medium">{row.failureReason ?? "Failed"}</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
          <p className="text-xs text-zinc-500">{items.length} records loaded</p>
          {hasMore && (
            <button
              onClick={() => load(cursor, true)}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-xs transition-all"
            >
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

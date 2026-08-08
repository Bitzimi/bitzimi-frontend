/**
 * Sessions Page — Phase 15
 *
 * View and revoke active and historical user sessions.
 * Backend-controlled — no localStorage involvement.
 */

import { useState, useEffect, useCallback } from "react";
import { Monitor, XCircle, RefreshCw, ChevronDown, CheckCircle } from "lucide-react";
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

interface Session {
  id:         string;
  userId:     string;
  userEmail:  string;
  username:   string | null;
  role:       string;
  deviceId:   string;
  ipAddress:  string | null;
  userAgent:  string | null;
  isActive:   boolean;
  createdAt:  string;
  expiresAt:  string;
  revokedAt:  string | null;
  revokedBy:  string | null;
  lastSeenAt: string | null;
}

interface Result {
  items:      Session[];
  nextCursor: string | null;
  hasMore:    boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" });
}

export default function SessionsPage() {
  const [items, setItems]     = useState<Session[]>([]);
  const [cursor, setCursor]   = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [active, setActive]   = useState<string>("");
  const [userId, setUserId]   = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "50" });
    if (active) p.set("active", active);
    if (userId) p.set("userId", userId);
    if (cur)    p.set("cursor", cur);
    apiFetch<Result>(`/api/v1/admin/security/sessions?${p}`)
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [active, userId]);

  useEffect(() => { load(); }, [load]);

  const revoke = async (id: string) => {
    setRevoking(id);
    try {
      await apiFetch(`/api/v1/admin/security/sessions/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      setItems(prev => prev.map(s => s.id === id ? { ...s, isActive: false, revokedAt: new Date().toISOString() } : s));
      toast.success("Session revoked");
    } catch {
      toast.error("Failed to revoke session");
    } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async (uid: string) => {
    if (!confirm("Revoke ALL sessions for this user? They will be logged out everywhere.")) return;
    try {
      await apiFetch(`/api/v1/admin/security/sessions/user/${uid}`, { method: "DELETE", body: JSON.stringify({}) });
      setItems(prev => prev.map(s => s.userId === uid ? { ...s, isActive: false, revokedAt: new Date().toISOString() } : s));
      toast.success("All sessions revoked");
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Monitor className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">Session Management</h1>
            <p className="text-xs text-zinc-500">Active sessions, device tracking, and remote revocation</p>
          </div>
        </div>
        <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={active}
            onChange={e => setActive(e.target.value)}
            className="appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 pr-8 text-sm text-white focus:outline-none"
          >
            <option value="">All sessions</option>
            <option value="true">Active only</option>
            <option value="false">Expired / Revoked</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              {["Status", "User", "IP", "Started", "Expires", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">No sessions found.</td></tr>
            )}
            {items.map(row => (
              <tr key={row.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  {row.isActive
                    ? <span className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle className="w-3.5 h-3.5" />Active</span>
                    : <span className="flex items-center gap-1.5 text-xs text-zinc-500"><XCircle className="w-3.5 h-3.5" />{row.revokedAt ? "Revoked" : "Expired"}</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-white">{row.username ?? row.userEmail}</p>
                  <p className="text-[10px] text-zinc-500">{row.userEmail} · <span className="capitalize">{row.role}</span></p>
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{row.ipAddress ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatDate(row.expiresAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {row.isActive && (
                      <>
                        <button
                          onClick={() => revoke(row.id)}
                          disabled={revoking === row.id}
                          className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-all"
                        >
                          {revoking === row.id ? "…" : "Revoke"}
                        </button>
                        <button
                          onClick={() => revokeAll(row.userId)}
                          className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs transition-all"
                        >
                          Revoke All
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
          <p className="text-xs text-zinc-500">{items.length} sessions loaded</p>
          {hasMore && (
            <button onClick={() => load(cursor, true)} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 text-xs transition-all">
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

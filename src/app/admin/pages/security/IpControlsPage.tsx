/**
 * IP Controls Page — Phase 15
 *
 * Allow list, block list, and temporary ban management by IP address.
 */

import { useState, useEffect, useCallback } from "react";
import { Globe, Plus, Trash2, RefreshCw, ChevronDown } from "lucide-react";
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

interface IpBlock {
  id:        string;
  ipAddress: string;
  type:      string;
  reason:    string | null;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
}

interface Result {
  items:      IpBlock[];
  nextCursor: string | null;
  hasMore:    boolean;
}

const TYPE_COLOR: Record<string, string> = {
  allow:      "bg-green-500/15 text-green-300",
  block:      "bg-red-500/15 text-red-300",
  temp_block: "bg-amber-500/15 text-amber-300",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium" });
}

export default function IpControlsPage() {
  const [items, setItems]     = useState<IpBlock[]>([]);
  const [cursor, setCursor]   = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setType] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  // Add form
  const [showForm, setShowForm] = useState(false);
  const [formIp, setFormIp]   = useState("");
  const [formType, setFormType] = useState("block");
  const [formReason, setFormReason] = useState("");
  const [formExpiry, setFormExpiry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback((cur?: string | null, append?: boolean) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: "50" });
    if (typeFilter) p.set("type", typeFilter);
    if (cur)        p.set("cursor", cur);
    apiFetch<Result>(`/api/v1/admin/security/ip-blocks?${p}`)
      .then(d => {
        setItems(prev => append ? [...prev, ...d.items] : d.items);
        setCursor(d.nextCursor);
        setHasMore(d.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [typeFilter]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formIp.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch("/api/v1/admin/security/ip-blocks", {
        method: "POST",
        body: JSON.stringify({
          ipAddress: formIp.trim(),
          type:      formType,
          reason:    formReason || undefined,
          expiresAt: formExpiry || undefined,
        }),
      });
      toast.success(`IP ${formIp} ${formType === "allow" ? "allowed" : "blocked"}`);
      setFormIp(""); setFormReason(""); setFormExpiry(""); setShowForm(false);
      load();
    } catch {
      toast.error("Failed to add IP rule");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, ip: string) => {
    if (!confirm(`Remove rule for ${ip}?`)) return;
    setDeleting(id);
    try {
      await apiFetch(`/api/v1/admin/security/ip-blocks/${id}`, { method: "DELETE", body: JSON.stringify({}) });
      setItems(prev => prev.filter(r => r.id !== id));
      toast.success("IP rule removed");
    } catch {
      toast.error("Failed to remove rule");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Globe className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-white">IP Controls</h1>
            <p className="text-xs text-zinc-500">Allow list, block list, and temporary bans</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load()} disabled={loading} className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] text-zinc-400 transition-all">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-sm transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-white mb-2">Add IP Rule</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input
              required
              value={formIp}
              onChange={e => setFormIp(e.target.value)}
              placeholder="IP address (e.g. 1.2.3.4)"
              className="col-span-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
            />
            <div className="relative">
              <select
                value={formType}
                onChange={e => setFormType(e.target.value)}
                className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
              >
                <option value="block">Block</option>
                <option value="allow">Allow</option>
                <option value="temp_block">Temp Block</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
            </div>
            <input
              type="datetime-local"
              value={formExpiry}
              onChange={e => setFormExpiry(e.target.value)}
              placeholder="Expires (optional)"
              className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none"
            />
          </div>
          <input
            value={formReason}
            onChange={e => setFormReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50"
          />
          <div className="flex items-center gap-2">
            <button type="submit" disabled={submitting} className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all">
              {submitting ? "Adding…" : "Add Rule"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-zinc-400 text-sm transition-all">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {[{ val: "", label: "All" }, { val: "block", label: "Blocked" }, { val: "allow", label: "Allowed" }, { val: "temp_block", label: "Temp Block" }].map(t => (
          <button
            key={t.val}
            onClick={() => setType(t.val)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              typeFilter === t.val
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                : "bg-white/[0.04] text-zinc-400 border border-white/[0.06]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-white/[0.06]">
            <tr>
              {["IP Address", "Type", "Reason", "Expires", "Created", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">Loading…</td></tr>
            )}
            {!loading && items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500 text-sm">No IP rules configured.</td></tr>
            )}
            {items.map(row => (
              <tr key={row.id} className={`hover:bg-white/[0.02] ${row.isExpired ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 text-sm font-mono text-white">{row.ipAddress}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${TYPE_COLOR[row.type] ?? "bg-zinc-500/15 text-zinc-300"}`}>
                    {row.type.replace("_", " ").toUpperCase()}
                  </span>
                  {row.isExpired && <span className="ml-2 text-[10px] text-zinc-500">(expired)</span>}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-400">{row.reason ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-zinc-400">{row.expiresAt ? formatDate(row.expiresAt) : "Never"}</td>
                <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDelete(row.id, row.ipAddress)}
                    disabled={deleting === row.id}
                    className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
          <p className="text-xs text-zinc-500">{items.length} rules loaded</p>
          {hasMore && (
            <button onClick={() => load(cursor, true)} disabled={loading} className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-zinc-400 text-xs">
              Load more
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

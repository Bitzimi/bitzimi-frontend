/**
 * Admin — Auction Marketplace (Phase 22)
 *
 * Tabs:
 *   1. Auctions     — list + create/edit/delete + status transitions
 *   2. Statistics   — revenue, pool, bid counts
 *   3. Collection   — winner claim management
 *   4. Feature Flags — enable/disable 4 auction flags
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Gavel, Plus, BarChart2, Trophy, Settings, Loader2,
  Play, Pause, Square, Ban, Pencil, Trash2, Upload, ImageIcon,
  DollarSign, Users, Clock, TrendingUp, CheckCircle, XCircle,
} from "lucide-react";
import { PageHeader }    from "../../components/ui/PageHeader";
import { StatCard }      from "../../components/ui/StatCard";
import { SectionCard }   from "../../components/ui/SectionCard";
import { EmptyState }    from "../../components/ui/EmptyState";
import { useAdminAccess } from "../../hooks/useAdminAccess";

const API = import.meta.env.VITE_API_URL ?? "";

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("bitzimi_access_token") ?? "";
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuctionAdmin {
  id: string;
  title: string;
  description: string | null;
  rewardType: string;
  rewardName: string | null;
  rewardValue: number;
  rewardImageUrl: string | null;
  bidAmount: number;
  durationMinutes: number;
  extensionWindowSeconds: number;
  extensionDurationSeconds: number;
  startsAt: string;
  endsAt: string | null;
  status: string;
  visibility: string;
  currentLeaderMasked: string | null;
  currentPool: number;
  bidCount: number;
  participantCount: number;
  extensionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AuctionStats {
  total: number;
  live: number;
  upcoming: number;
  ended: number;
  cancelled: number;
  draft: number;
  totalPool: number;
  totalBids: number;
  bidsLast24h: number;
}

interface CollectionItem {
  id: string;
  userId: string;
  auctionId: string;
  status: string;
  claimedAt: string | null;
  expiresAt: string | null;
  deliveryNotes: string | null;
  createdAt: string;
  updatedAt: string;
  auction: { title: string; rewardName: string | null; rewardValue: number };
}

interface FeatureFlag {
  key: string;
  value: boolean;
  description: string;
}

// ─── Image Upload Hook ────────────────────────────────────────────────────────

function useImageUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function processFile(file: File) {
    if (file.size > 750 * 1024) { alert("Image must be under 750KB."); return; }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) processFile(file);
  };

  return { fileRef, preview, setPreview, dragging, setDragging, onDrop, processFile };
}

// ─── REWARD_TYPES ─────────────────────────────────────────────────────────────

const REWARD_TYPES = [
  { value: "cash_reward",      label: "Cash Reward" },
  { value: "vip_subscription", label: "VIP Subscription" },
  { value: "gift_card",        label: "Gift Card" },
  { value: "software",         label: "Software License" },
  { value: "future_item",      label: "Future Item" },
];

const STATUS_COLORS: Record<string, string> = {
  draft:    "text-zinc-400 bg-zinc-800",
  upcoming: "text-blue-400 bg-blue-500/10",
  live:     "text-emerald-400 bg-emerald-500/10",
  paused:   "text-yellow-400 bg-yellow-500/10",
  ended:    "text-zinc-500 bg-zinc-800",
  cancelled:"text-red-400 bg-red-500/10",
};

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateAuctionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const img = useImageUpload();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    rewardType: "cash_reward",
    rewardName: "",
    rewardValue: "",
    bidAmount: "",
    durationMinutes: "60",
    extensionWindowSeconds: "60",
    extensionDurationSeconds: "600",
    startsAt: "",
    visibility: "private",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title || !form.startsAt || !form.rewardValue || !form.bidAmount) {
      setError("Title, start time, reward value, and bid amount are required.");
      return;
    }
    setSaving(true);
    try {
      await adminFetch("/api/v1/admin/auctions", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          rewardType: form.rewardType,
          rewardName: form.rewardName || undefined,
          rewardValue: parseFloat(form.rewardValue),
          rewardImageUrl: img.preview ?? undefined,
          bidAmount: parseFloat(form.bidAmount),
          durationMinutes: parseInt(form.durationMinutes),
          extensionWindowSeconds: parseInt(form.extensionWindowSeconds),
          extensionDurationSeconds: parseInt(form.extensionDurationSeconds),
          startsAt: form.startsAt,
          visibility: form.visibility,
        }),
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Create Auction</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Title *</label>
              <input value={form.title} onChange={e => set("title", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="Auction title" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 resize-none"
                placeholder="Optional description" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Reward Type *</label>
              <select value={form.rewardType} onChange={e => set("rewardType", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                {REWARD_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Reward Name</label>
              <input value={form.rewardName} onChange={e => set("rewardName", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="e.g. iPhone 15 Pro" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Reward Value ($) *</label>
              <input type="number" min="0" step="0.01" value={form.rewardValue} onChange={e => set("rewardValue", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="999.00" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Bid Amount ($) *</label>
              <input type="number" min="0.01" step="0.01" value={form.bidAmount} onChange={e => set("bidAmount", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50"
                placeholder="1.00" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Duration (minutes)</label>
              <input type="number" min="1" value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Extension Window (seconds)</label>
              <input type="number" min="10" value={form.extensionWindowSeconds} onChange={e => set("extensionWindowSeconds", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Extension Duration (seconds)</label>
              <input type="number" min="60" value={form.extensionDurationSeconds} onChange={e => set("extensionDurationSeconds", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Starts At *</label>
              <input type="datetime-local" value={form.startsAt} onChange={e => set("startsAt", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Visibility</label>
              <select value={form.visibility} onChange={e => set("visibility", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                <option value="private">Private (admin only)</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          {/* Image upload */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Reward Image (max 750KB)</label>
            <input ref={img.fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) img.processFile(f); }} />
            {img.preview ? (
              <div className="relative">
                <img src={img.preview} alt="" className="w-full h-36 object-cover rounded-xl" />
                <button type="button" onClick={() => img.setPreview(null)}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-600">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div
                onDrop={img.onDrop}
                onDragOver={(e) => { e.preventDefault(); img.setDragging(true); }}
                onDragLeave={() => img.setDragging(false)}
                onClick={() => img.fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
                  img.dragging ? "border-amber-500 bg-amber-500/5" : "border-white/[0.08] hover:border-amber-500/40"
                }`}
              >
                <Upload className="w-6 h-6 text-zinc-600" />
                <span className="text-xs text-zinc-500">Drop image or click to upload</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : "Create Auction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

function EditAuctionModal({ auction, onClose, onSaved }: { auction: AuctionAdmin; onClose: () => void; onSaved: () => void }) {
  const img = useImageUpload();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: auction.title,
    description: auction.description ?? "",
    rewardType: auction.rewardType,
    rewardName: auction.rewardName ?? "",
    rewardValue: auction.rewardValue.toString(),
    bidAmount: auction.bidAmount.toString(),
    durationMinutes: auction.durationMinutes.toString(),
    extensionWindowSeconds: auction.extensionWindowSeconds.toString(),
    extensionDurationSeconds: auction.extensionDurationSeconds.toString(),
    startsAt: auction.startsAt.slice(0, 16),
    visibility: auction.visibility,
  });

  useEffect(() => {
    if (auction.rewardImageUrl) img.setPreview(auction.rewardImageUrl);
  }, []);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await adminFetch(`/api/v1/admin/auctions/${auction.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          rewardType: form.rewardType,
          rewardName: form.rewardName || undefined,
          rewardValue: parseFloat(form.rewardValue),
          rewardImageUrl: img.preview,
          bidAmount: parseFloat(form.bidAmount),
          durationMinutes: parseInt(form.durationMinutes),
          extensionWindowSeconds: parseInt(form.extensionWindowSeconds),
          extensionDurationSeconds: parseInt(form.extensionDurationSeconds),
          startsAt: form.startsAt,
          visibility: form.visibility,
        }),
      });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Edit Auction</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Title</label>
              <input value={form.title} onChange={e => set("title", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-zinc-400 mb-1">Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50 resize-none" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Reward Type</label>
              <select value={form.rewardType} onChange={e => set("rewardType", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                {REWARD_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Reward Name</label>
              <input value={form.rewardName} onChange={e => set("rewardName", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Reward Value ($)</label>
              <input type="number" min="0" step="0.01" value={form.rewardValue} onChange={e => set("rewardValue", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Bid Amount ($)</label>
              <input type="number" min="0.01" step="0.01" value={form.bidAmount} onChange={e => set("bidAmount", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Duration (minutes)</label>
              <input type="number" min="1" value={form.durationMinutes} onChange={e => set("durationMinutes", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Extension Window (s)</label>
              <input type="number" min="10" value={form.extensionWindowSeconds} onChange={e => set("extensionWindowSeconds", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Extension Duration (s)</label>
              <input type="number" min="60" value={form.extensionDurationSeconds} onChange={e => set("extensionDurationSeconds", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Starts At</label>
              <input type="datetime-local" value={form.startsAt} onChange={e => set("startsAt", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Visibility</label>
              <select value={form.visibility} onChange={e => set("visibility", e.target.value)}
                className="w-full bg-zinc-800 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>

          {/* Image */}
          <div>
            <label className="block text-xs text-zinc-400 mb-2">Reward Image (max 750KB)</label>
            <input ref={img.fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) img.processFile(f); }} />
            {img.preview ? (
              <div className="relative">
                <img src={img.preview} alt="" className="w-full h-36 object-cover rounded-xl" />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button type="button" onClick={() => img.fileRef.current?.click()}
                    className="bg-black/60 text-white rounded-full p-1.5 hover:bg-amber-600">
                    <ImageIcon className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => img.setPreview(null)}
                    className="bg-black/60 text-white rounded-full p-1.5 hover:bg-red-600">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDrop={img.onDrop}
                onDragOver={(e) => { e.preventDefault(); img.setDragging(true); }}
                onDragLeave={() => img.setDragging(false)}
                onClick={() => img.fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
                  img.dragging ? "border-amber-500 bg-amber-500/5" : "border-white/[0.08] hover:border-amber-500/40"
                }`}
              >
                <Upload className="w-6 h-6 text-zinc-600" />
                <span className="text-xs text-zinc-500">Drop image or click to upload</span>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-zinc-400 hover:text-white text-sm transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "auctions"    as const, label: "Auctions",      icon: Gavel,     perm: "admin.auction.view" },
  { id: "statistics" as const, label: "Statistics",    icon: BarChart2, perm: "admin.auction.statistics" },
  { id: "collection" as const, label: "Collection",    icon: Trophy,    perm: "admin.auction.view" },
  { id: "flags"      as const, label: "Feature Flags", icon: Settings,  perm: "admin.auction.settings" },
];

const AUCTION_FLAGS = [
  "feature.auction_marketplace",
  "feature.auction_live",
  "feature.auction_bidding",
  "feature.auction_claim",
];

export default function AuctionsPage() {
  const { can: hasPermission } = useAdminAccess();
  const [activeTab, setActiveTab] = useState<"auctions" | "statistics" | "collection" | "flags">("auctions");

  const canManage = hasPermission("admin.auction.manage");

  // ── Auctions tab state ─────────────────────────────────────────────────────
  const [auctions, setAuctions] = useState<AuctionAdmin[]>([]);
  const [auctionsLoading, setAuctionsLoading] = useState(true);
  const [auctionFilter, setAuctionFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingAuction, setEditingAuction] = useState<AuctionAdmin | null>(null);

  // ── Statistics tab state ───────────────────────────────────────────────────
  const [stats, setStats] = useState<AuctionStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Collection tab state ───────────────────────────────────────────────────
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionFilter, setCollectionFilter] = useState("all");

  // ── Feature flags tab state ────────────────────────────────────────────────
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadAuctions = useCallback(async () => {
    setAuctionsLoading(true);
    try {
      const params = auctionFilter !== "all" ? `?status=${auctionFilter}` : "";
      const data = await adminFetch<{ auctions: AuctionAdmin[] }>(`/api/v1/admin/auctions${params}`);
      setAuctions(data.auctions ?? []);
    } catch { /* ignore */ } finally { setAuctionsLoading(false); }
  }, [auctionFilter]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await adminFetch<{ stats: AuctionStats }>("/api/v1/admin/auctions/statistics");
      setStats(data.stats);
    } catch { /* ignore */ } finally { setStatsLoading(false); }
  }, []);

  const loadCollection = useCallback(async () => {
    setCollectionLoading(true);
    try {
      const params = collectionFilter !== "all" ? `?status=${collectionFilter}` : "";
      const data = await adminFetch<{ items: CollectionItem[] }>(`/api/v1/admin/auctions/collection${params}`);
      setCollection(data.items ?? []);
    } catch { /* ignore */ } finally { setCollectionLoading(false); }
  }, [collectionFilter]);

  const loadFlags = useCallback(async () => {
    setFlagsLoading(true);
    try {
      const allConfig = await adminFetch<Array<{ key: string; value: any; description: string }>>("/api/v1/admin/config");
      const auctionFlags = (allConfig as any[]).filter((c: any) => AUCTION_FLAGS.includes(c.key));
      setFlags(auctionFlags.map(c => ({ key: c.key, value: !!c.value, description: c.description ?? "" })));
    } catch { /* ignore */ } finally { setFlagsLoading(false); }
  }, []);

  useEffect(() => { if (activeTab === "auctions") loadAuctions(); }, [activeTab, loadAuctions]);
  useEffect(() => { if (activeTab === "statistics") loadStats(); }, [activeTab, loadStats]);
  useEffect(() => { if (activeTab === "collection") loadCollection(); }, [activeTab, loadCollection]);
  useEffect(() => { if (activeTab === "flags") loadFlags(); }, [activeTab, loadFlags]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const doAction = async (id: string, action: string) => {
    try {
      await adminFetch(`/api/v1/admin/auctions/${id}/${action}`, { method: "POST" });
      loadAuctions();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const deleteAuction = async (id: string, title: string) => {
    if (!confirm(`Delete auction "${title}"? This cannot be undone.`)) return;
    try {
      await adminFetch(`/api/v1/admin/auctions/${id}`, { method: "DELETE" });
      loadAuctions();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const toggleFlag = async (key: string, currentValue: boolean) => {
    try {
      await adminFetch(`/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value: !currentValue }),
      });
      loadFlags();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const updateCollectionItem = async (id: string, status: string, deliveryNotes?: string) => {
    try {
      await adminFetch(`/api/v1/admin/auctions/collection/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, deliveryNotes }),
      });
      loadCollection();
    } catch (e: any) {
      alert(e.message);
    }
  };

  // ── Visible tabs ───────────────────────────────────────────────────────────
  const visibleTabs = TABS.filter(t => hasPermission(t.perm as any));

  const AUCTION_FILTERS = ["all", "draft", "upcoming", "live", "paused", "ended", "cancelled"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Auction Marketplace"
        description="Manage auctions, bids, prizes, and platform feature flags."
        action={canManage ? { label: "New Auction", onClick: () => setShowCreate(true) } : undefined}
      />

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-zinc-900 border border-white/[0.06] rounded-xl w-fit">
        {visibleTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-amber-600/20 text-amber-400 border border-amber-500/30"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Auctions Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "auctions" && (
        <SectionCard title="All Auctions" description="Create, edit, and manage auction status transitions.">
          {/* Filters */}
          <div className="flex gap-2 flex-wrap mb-4">
            {AUCTION_FILTERS.map(f => (
              <button key={f} onClick={() => setAuctionFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  auctionFilter === f
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {auctionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : auctions.length === 0 ? (
            <EmptyState icon={Gavel} title="No auctions found"
              description={canManage ? "Create your first auction to get started." : "No auctions match the current filter."} />
          ) : (
            <div className="space-y-3">
              {auctions.map(auction => (
                <div key={auction.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  {/* Image thumbnail */}
                  {auction.rewardImageUrl && (
                    <img src={auction.rewardImageUrl} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-white truncate">{auction.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_COLORS[auction.status] ?? ""}`}>
                        {auction.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 flex items-center gap-3">
                      <span>${auction.bidAmount}/bid</span>
                      <span>Pool: ${auction.currentPool.toFixed(2)}</span>
                      <span>{auction.bidCount} bids</span>
                      <span className="capitalize">{auction.visibility}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {auction.status === "draft" && (
                        <button onClick={() => doAction(auction.id, "activate")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/20 transition-all">
                          <Play className="w-3 h-3" /> Activate
                        </button>
                      )}
                      {auction.status === "upcoming" && (
                        <button onClick={() => doAction(auction.id, "launch")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20 transition-all">
                          <Play className="w-3 h-3" /> Launch
                        </button>
                      )}
                      {auction.status === "live" && (
                        <button onClick={() => doAction(auction.id, "pause")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 border border-yellow-500/20 transition-all">
                          <Pause className="w-3 h-3" /> Pause
                        </button>
                      )}
                      {auction.status === "paused" && (
                        <button onClick={() => doAction(auction.id, "resume")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/20 transition-all">
                          <Play className="w-3 h-3" /> Resume
                        </button>
                      )}
                      {["live", "paused"].includes(auction.status) && (
                        <button onClick={() => doAction(auction.id, "end")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-600/20 text-zinc-400 hover:bg-zinc-600/30 border border-zinc-500/20 transition-all">
                          <Square className="w-3 h-3" /> End
                        </button>
                      )}
                      {!["ended", "cancelled"].includes(auction.status) && (
                        <button onClick={() => doAction(auction.id, "cancel")}
                          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20 transition-all">
                          <Ban className="w-3 h-3" />
                        </button>
                      )}
                      {["draft", "upcoming"].includes(auction.status) && (
                        <button onClick={() => setEditingAuction(auction)}
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {["draft", "cancelled"].includes(auction.status) && (
                        <button onClick={() => deleteAuction(auction.id, auction.title)}
                          className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Statistics Tab ───────────────────────────────────────────────────── */}
      {activeTab === "statistics" && (
        <>
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total Auctions" value={stats.total} icon={Gavel} />
                <StatCard title="Live Now"        value={stats.live}     icon={TrendingUp} />
                <StatCard title="Upcoming"        value={stats.upcoming} icon={Clock} />
                <StatCard title="Ended"           value={stats.ended}    icon={CheckCircle} />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatCard title="Total Pool"     value={`$${stats.totalPool.toFixed(2)}`}  icon={DollarSign} />
                <StatCard title="Total Bids"     value={stats.totalBids}                    icon={Gavel} />
                <StatCard title="Bids (24h)"     value={stats.bidsLast24h}                  icon={TrendingUp} />
              </div>
              <SectionCard title="Status Breakdown">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Draft",     count: stats.draft,     color: "text-zinc-400" },
                    { label: "Upcoming",  count: stats.upcoming,  color: "text-blue-400" },
                    { label: "Live",      count: stats.live,      color: "text-emerald-400" },
                    { label: "Paused",    count: 0,               color: "text-yellow-400" },
                    { label: "Ended",     count: stats.ended,     color: "text-zinc-500" },
                    { label: "Cancelled", count: stats.cancelled,  color: "text-red-400" },
                  ].map(row => (
                    <div key={row.label} className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-3 text-center">
                      <p className={`text-2xl font-bold ${row.color}`}>{row.count}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{row.label}</p>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          ) : (
            <EmptyState icon={BarChart2} title="No statistics available" />
          )}
        </>
      )}

      {/* ── Collection Tab ───────────────────────────────────────────────────── */}
      {activeTab === "collection" && (
        <SectionCard title="Winner Collection" description="Manage prize delivery and claim status for auction winners.">
          <div className="flex gap-2 flex-wrap mb-4">
            {["all", "pending_claim", "claimed", "delivered", "expired"].map(f => (
              <button key={f} onClick={() => setCollectionFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  collectionFilter === f
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-zinc-800 text-zinc-400 hover:text-white border border-transparent"
                }`}
              >
                {f.replace("_", " ")}
              </button>
            ))}
          </div>

          {collectionLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : collection.length === 0 ? (
            <EmptyState icon={Trophy} title="No collection items" />
          ) : (
            <div className="space-y-3">
              {collection.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{item.auction.title}</p>
                    <p className="text-xs text-zinc-500">User: <span className="font-mono">{item.userId.slice(0, 8)}…</span></p>
                    <p className="text-xs text-zinc-500">Status: <span className="text-amber-400">{item.status.replace("_", " ")}</span></p>
                    {item.deliveryNotes && <p className="text-xs text-zinc-600 italic mt-0.5">{item.deliveryNotes}</p>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-400">${item.auction.rewardValue.toFixed(2)}</p>
                    {canManage && (
                      <div className="flex gap-1.5 mt-2">
                        {item.status === "pending_claim" && (
                          <button onClick={() => updateCollectionItem(item.id, "delivered")}
                            className="px-2 py-1 rounded-lg text-[10px] bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/20">
                            Mark Delivered
                          </button>
                        )}
                        {item.status === "pending_claim" && (
                          <button onClick={() => updateCollectionItem(item.id, "expired")}
                            className="px-2 py-1 rounded-lg text-[10px] bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-500/20">
                            Expire
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Feature Flags Tab ────────────────────────────────────────────────── */}
      {activeTab === "flags" && (
        <SectionCard title="Auction Feature Flags" description="Enable or disable auction marketplace features platform-wide.">
          {flagsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
            </div>
          ) : flags.length === 0 ? (
            <EmptyState icon={Settings} title="No flags found" />
          ) : (
            <div className="space-y-3">
              {flags.map(flag => (
                <div key={flag.key} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <div className="flex-1 min-w-0 mr-4">
                    <p className="text-sm font-semibold text-white font-mono">{flag.key}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{flag.description}</p>
                  </div>
                  <button
                    onClick={() => hasPermission("admin.auction.settings") && toggleFlag(flag.key, flag.value)}
                    disabled={!hasPermission("admin.auction.settings")}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      flag.value ? "bg-amber-600" : "bg-zinc-700"
                    } ${!hasPermission("admin.auction.settings") ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      flag.value ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateAuctionModal onClose={() => setShowCreate(false)} onCreated={loadAuctions} />
      )}
      {editingAuction && (
        <EditAuctionModal
          auction={editingAuction}
          onClose={() => setEditingAuction(null)}
          onSaved={loadAuctions}
        />
      )}
    </div>
  );
}

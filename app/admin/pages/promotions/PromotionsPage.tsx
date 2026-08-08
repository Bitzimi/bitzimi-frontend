/**
 * Admin Promotions Management — Phase 21
 *
 * Tabs:
 *   1. Promotions      — create/edit/activate/pause/expire/cancel platform promotions
 *   2. Featured Queue  — approve/reject featured task requests
 *   3. Pricing         — edit 1-4 day featured placement pricing
 *   4. Revenue         — super_admin only — gross/net featured revenue
 *   5. Feature Flags   — enable/disable the 3 Phase 21 feature flags
 *
 * Permissions:
 *   View:            admin.promotions.view
 *   Manage:          admin.promotions.manage
 *   Approve/Reject:  admin.promotions.featured.approve
 *   Revenue:         admin.promotions.revenue
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  Megaphone, Star, DollarSign, Settings, RefreshCw,
  CheckCircle2, XCircle, Clock, Plus, Edit, Play, Pause,
  X, BarChart3, MapPin, AlertCircle, Upload, ImageIcon, Trash2,
} from "lucide-react";
import { PageHeader }    from "../../components/ui/PageHeader";
import { StatCard }      from "../../components/ui/StatCard";
import { SectionCard }   from "../../components/ui/SectionCard";
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
  return (json.data ?? json) as T;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Promotion {
  id: string;
  type: "platform" | "featured_task";
  title: string;
  description: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  badgeLabel: string | null;
  accentColor: string | null;
  status: string;
  priority: number;
  createdAt: string;
  placements: { location: string }[];
}

interface FeaturedReqAdmin {
  id: string;
  status: string;
  durationDays: number;
  amount: number;
  rejectionReason: string | null;
  createdAt: string;
  task: { id: string; title: string; status: string } | null;
  user: { id: string; email: string; profile: { username: string | null } | null };
  promotion: { placements: { location: string }[] };
}

interface PricingItem {
  id: string;
  durationDays: number;
  price: number;
  isActive: boolean;
}

interface RevenueData {
  totalGross: number;
  totalRefunds: number;
  netRevenue: number;
  entries: Array<{
    id: string;
    amount: number;
    durationDays: number;
    refunded: boolean;
    createdAt: string;
    userId: string;
  }>;
}

interface FeatureFlag {
  key: string;
  value: boolean;
  description: string;
}

const LOCATION_LABELS: Record<string, string> = {
  wallet: "Wallet",
  marketplace: "Tasks",
  referral: "Referrals",
  affiliate: "Affiliate",
  ambassador: "Ambassador",
};

const PROMOTION_STATUS_COLORS: Record<string, string> = {
  draft:      "text-gray-400 bg-gray-500/10 border-gray-500/20",
  active:     "text-green-400 bg-green-500/10 border-green-500/20",
  scheduled:  "text-blue-400 bg-blue-500/10 border-blue-500/20",
  paused:     "text-orange-400 bg-orange-500/10 border-orange-500/20",
  expired:    "text-gray-500 bg-gray-600/10 border-gray-600/20",
  cancelled:  "text-red-400 bg-red-500/10 border-red-500/20",
};

const FEATURED_STATUS_COLORS: Record<string, string> = {
  pending_marketplace: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  pending_featured:    "text-blue-400 bg-blue-500/10 border-blue-500/20",
  approved:            "text-green-400 bg-green-500/10 border-green-500/20",
  rejected:            "text-red-400 bg-red-500/10 border-red-500/20",
  expired:             "text-gray-400 bg-gray-500/10 border-gray-500/20",
  refunded:            "text-orange-400 bg-orange-500/10 border-orange-500/20",
};

// ── Image Upload Hook ──────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 750 * 1024; // 750 KB → ~1 MB as base64 (under 1 MB body limit)

function useImageUpload(initial: string | null = null) {
  const [imageUrl, setImageUrl] = useState<string | null>(initial);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("File must be an image"); return; }
    if (file.size > MAX_IMAGE_BYTES) { toast.error("Image must be under 750 KB"); return; }
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  return { imageUrl, setImageUrl, dragOver, setDragOver, fileRef, onDrop, onFileChange };
}

// ── Banner Upload UI ───────────────────────────────────────────────────────────

function BannerUploadField({
  imageUrl, dragOver, setDragOver, fileRef, onDrop, onFileChange, onRemove,
}: {
  imageUrl: string | null;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">
        Banner Image <span className="text-zinc-600 normal-case font-normal">(optional · max 750 KB)</span>
      </label>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
      {imageUrl ? (
        <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-black/20">
          <img src={imageUrl} alt="Banner preview" className="w-full h-28 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white border border-white/20 transition-all"
            >
              <Upload className="h-3 w-3" />
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold text-red-400 border border-red-500/30 transition-all"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-2 h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragOver
              ? "border-indigo-500/60 bg-indigo-500/10"
              : "border-white/[0.08] hover:border-indigo-500/40 hover:bg-white/[0.02]"
          }`}
        >
          <ImageIcon className="h-6 w-6 text-zinc-600" />
          <p className="text-xs text-zinc-500">
            <span className="text-indigo-400 font-semibold">Click to upload</span> or drag &amp; drop
          </p>
          <p className="text-[10px] text-zinc-600">PNG, JPG, WebP · max 750 KB</p>
        </div>
      )}
    </div>
  );
}

// ── Create Promotion Modal ─────────────────────────────────────────────────────

interface CreatePromotionModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreatePromotionModal({ onClose, onCreated }: CreatePromotionModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Learn More");
  const [ctaUrl, setCtaUrl] = useState("");
  const [badgeLabel, setBadgeLabel] = useState("");
  const [accentColor, setAccentColor] = useState("#6366f1");
  const [locations, setLocations] = useState<string[]>(["wallet"]);
  const [saving, setSaving] = useState(false);
  const imgUpload = useImageUpload(null);

  const toggleLocation = (loc: string) => {
    setLocations(prev => prev.includes(loc) ? prev.filter(l => l !== loc) : [...prev, loc]);
  };

  const submit = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (locations.length === 0) { toast.error("Select at least one location"); return; }
    setSaving(true);
    try {
      // Single POST with locations + imageUrl included — backend handles placements atomically
      await adminFetch<Promotion>("/api/v1/admin/promotions", {
        method: "POST",
        body: JSON.stringify({
          title:       title.trim(),
          description: description.trim() || undefined,
          ctaLabel:    ctaLabel.trim()    || undefined,
          ctaUrl:      ctaUrl.trim()      || undefined,
          badgeLabel:  badgeLabel.trim()  || undefined,
          accentColor,
          imageUrl:    imgUpload.imageUrl  ?? undefined,
          locations,
        }),
      });
      toast.success("Promotion created");
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create promotion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#18181b] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg my-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-indigo-400" />
            New Platform Promotion
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Banner image upload */}
          <BannerUploadField
            imageUrl={imgUpload.imageUrl}
            dragOver={imgUpload.dragOver}
            setDragOver={imgUpload.setDragOver}
            fileRef={imgUpload.fileRef}
            onDrop={imgUpload.onDrop}
            onFileChange={imgUpload.onFileChange}
            onRemove={() => imgUpload.setImageUrl(null)}
          />

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g., New Feature Announcement"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description shown on the card"
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">CTA Label</label>
              <input
                value={ctaLabel}
                onChange={e => setCtaLabel(e.target.value)}
                placeholder="Learn More"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">CTA URL</label>
              <input
                value={ctaUrl}
                onChange={e => setCtaUrl(e.target.value)}
                placeholder="/wallet or https://..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Badge Label</label>
              <input
                value={badgeLabel}
                onChange={e => setBadgeLabel(e.target.value)}
                placeholder="Announcement"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="h-9 w-12 rounded-lg border border-white/[0.08] bg-white/[0.04] cursor-pointer"
                />
                <input
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 font-mono"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-2">Display Locations *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(LOCATION_LABELS).map(([loc, label]) => {
                const checked = locations.includes(loc);
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => toggleLocation(loc)}
                    className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs transition-all ${
                      checked
                        ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-400"
                        : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:border-indigo-500/30"
                    }`}
                  >
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-all disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Promotion"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Promotion Modal ───────────────────────────────────────────────────────

interface EditPromotionModalProps {
  promotion: Promotion;
  onClose: () => void;
  onSaved: () => void;
}

function EditPromotionModal({ promotion, onClose, onSaved }: EditPromotionModalProps) {
  const [title, setTitle]           = useState(promotion.title);
  const [description, setDescription] = useState(promotion.description ?? "");
  const [ctaLabel, setCtaLabel]     = useState(promotion.ctaLabel ?? "");
  const [ctaUrl, setCtaUrl]         = useState(promotion.ctaUrl ?? "");
  const [badgeLabel, setBadgeLabel] = useState(promotion.badgeLabel ?? "");
  const [accentColor, setAccentColor] = useState(promotion.accentColor ?? "#6366f1");
  const [saving, setSaving]         = useState(false);
  const imgUpload = useImageUpload((promotion as any).imageUrl ?? null);

  const submit = async () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    setSaving(true);
    try {
      await adminFetch(`/api/v1/admin/promotions/${promotion.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title:       title.trim(),
          description: description.trim() || null,
          ctaLabel:    ctaLabel.trim()    || null,
          ctaUrl:      ctaUrl.trim()      || null,
          badgeLabel:  badgeLabel.trim()  || null,
          accentColor,
          imageUrl:    imgUpload.imageUrl,
        }),
      });
      toast.success("Promotion updated");
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update promotion");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-[#18181b] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg my-4">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Edit className="h-5 w-5 text-indigo-400" />
            Edit Promotion
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Banner image upload */}
          <BannerUploadField
            imageUrl={imgUpload.imageUrl}
            dragOver={imgUpload.dragOver}
            setDragOver={imgUpload.setDragOver}
            fileRef={imgUpload.fileRef}
            onDrop={imgUpload.onDrop}
            onFileChange={imgUpload.onFileChange}
            onRemove={() => imgUpload.setImageUrl(null)}
          />

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">CTA Label</label>
              <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">CTA URL</label>
              <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="/wallet or https://..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Badge Label</label>
              <input value={badgeLabel} onChange={e => setBadgeLabel(e.target.value)} className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest block mb-1.5">Accent Color</label>
              <div className="flex items-center gap-2">
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} className="h-9 w-12 rounded-lg border border-white/[0.08] bg-white/[0.04] cursor-pointer" />
                <input value={accentColor} onChange={e => setAccentColor(e.target.value)} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white font-mono outline-none focus:border-indigo-500/50" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition-all">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-all disabled:opacity-50">
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reject Dialog ──────────────────────────────────────────────────────────────

function RejectDialog({ onConfirm, onClose }: { onConfirm: (reason: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#18181b] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm">
        <h2 className="text-base font-bold text-white mb-3">Rejection Reason</h2>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Explain why this is being rejected…"
          rows={3}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-red-500/50 resize-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-white/[0.08] text-sm text-zinc-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function PromotionsPage() {
  const { can: hasPermission } = useAdminAccess();
  const [activeTab, setActiveTab] = useState<"promotions" | "featured" | "pricing" | "revenue" | "flags">("promotions");

  // Promotions tab
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoLoading, setPromoLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);

  // Featured tab
  const [featuredRequests, setFeaturedRequests] = useState<FeaturedReqAdmin[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredFilter, setFeaturedFilter] = useState("pending_featured");
  const [rejectDialog, setRejectDialog] = useState<string | null>(null);

  // Pricing tab
  const [pricing, setPricing] = useState<PricingItem[]>([]);
  const [pricingLoading, setPricingLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState<{ durationDays: number; price: string } | null>(null);

  // Revenue tab
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Feature flags tab
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);

  const canManage = hasPermission("admin.promotions.manage");
  const canApprove = hasPermission("admin.promotions.featured.approve");
  const canRevenue = hasPermission("admin.promotions.revenue");

  // Load promotions
  const loadPromotions = useCallback(async () => {
    setPromoLoading(true);
    try {
      const data = await adminFetch<Promotion[]>("/api/v1/admin/promotions");
      setPromotions(data);
    } catch { /* ignore */ } finally { setPromoLoading(false); }
  }, []);

  // Load featured requests
  const loadFeatured = useCallback(async () => {
    setFeaturedLoading(true);
    try {
      const data = await adminFetch<FeaturedReqAdmin[]>(`/api/v1/admin/promotions/featured?status=${featuredFilter}`);
      setFeaturedRequests(data);
    } catch { /* ignore */ } finally { setFeaturedLoading(false); }
  }, [featuredFilter]);

  // Load pricing
  const loadPricing = useCallback(async () => {
    setPricingLoading(true);
    try {
      const data = await adminFetch<PricingItem[]>("/api/v1/admin/promotions/pricing");
      setPricing(data);
    } catch { /* ignore */ } finally { setPricingLoading(false); }
  }, []);

  // Load revenue
  const loadRevenue = useCallback(async () => {
    if (!canRevenue) return;
    setRevenueLoading(true);
    try {
      const data = await adminFetch<RevenueData>("/api/v1/admin/promotions/revenue");
      setRevenue(data);
    } catch { /* ignore */ } finally { setRevenueLoading(false); }
  }, [canRevenue]);

  // Load feature flags
  const loadFlags = useCallback(async () => {
    setFlagsLoading(true);
    try {
      const allConfig = await adminFetch<Array<{ key: string; value: any; description: string }>>("/api/v1/admin/config");
      const promotionFlags = (allConfig as any[]).filter((c: any) =>
        ["feature.featured_promotions", "feature.platform_announcements", "feature.featured_marketplace_tasks"].includes(c.key)
      );
      setFlags(promotionFlags.map(c => ({ key: c.key, value: !!c.value, description: c.description ?? "" })));
    } catch { /* ignore */ } finally { setFlagsLoading(false); }
  }, []);

  useEffect(() => { loadPromotions(); }, [loadPromotions]);
  useEffect(() => { if (activeTab === "featured") loadFeatured(); }, [activeTab, loadFeatured]);
  useEffect(() => { if (activeTab === "pricing") loadPricing(); }, [activeTab, loadPricing]);
  useEffect(() => { if (activeTab === "revenue") loadRevenue(); }, [activeTab, loadRevenue]);
  useEffect(() => { if (activeTab === "flags") loadFlags(); }, [activeTab, loadFlags]);

  // Promotion actions
  const doPromoAction = async (id: string, action: "activate" | "pause" | "expire" | "cancel") => {
    try {
      await adminFetch(`/api/v1/admin/promotions/${id}/${action}`, { method: "POST" });
      toast.success(`Promotion ${action}d`);
      loadPromotions();
    } catch (e: any) { toast.error(e.message ?? "Action failed"); }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm("Delete this promotion?")) return;
    try {
      await adminFetch(`/api/v1/admin/promotions/${id}`, { method: "DELETE" });
      toast.success("Promotion deleted");
      loadPromotions();
    } catch (e: any) { toast.error(e.message ?? "Delete failed"); }
  };

  // Featured request actions
  const approveRequest = async (id: string) => {
    try {
      await adminFetch(`/api/v1/admin/promotions/featured/${id}/approve`, { method: "POST" });
      toast.success("Featured request approved");
      loadFeatured();
    } catch (e: any) { toast.error(e.message ?? "Approval failed"); }
  };

  const rejectRequest = async (id: string, reason: string) => {
    try {
      await adminFetch(`/api/v1/admin/promotions/featured/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      toast.success("Featured request rejected");
      setRejectDialog(null);
      loadFeatured();
    } catch (e: any) { toast.error(e.message ?? "Rejection failed"); }
  };

  // Pricing actions
  const savePrice = async () => {
    if (!editingPrice) return;
    const price = parseFloat(editingPrice.price);
    if (isNaN(price) || price <= 0) { toast.error("Price must be greater than zero"); return; }
    try {
      await adminFetch(`/api/v1/admin/promotions/pricing/${editingPrice.durationDays}`, {
        method: "PUT",
        body: JSON.stringify({ price }),
      });
      toast.success("Price updated");
      setEditingPrice(null);
      loadPricing();
    } catch (e: any) { toast.error(e.message ?? "Failed to update price"); }
  };

  // Feature flag toggle
  const toggleFlag = async (key: string, currentValue: boolean) => {
    try {
      await adminFetch(`/api/v1/admin/config/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify({ value: !currentValue }),
      });
      toast.success(`${key} ${!currentValue ? "enabled" : "disabled"}`);
      loadFlags();
    } catch (e: any) { toast.error(e.message ?? "Failed to update flag"); }
  };

  const TABS = [
    { id: "promotions" as const, label: "Promotions",    icon: Megaphone, perm: "admin.promotions.view" },
    { id: "featured"   as const, label: "Featured Queue", icon: Star,      perm: "admin.promotions.featured.approve" },
    { id: "pricing"    as const, label: "Pricing",        icon: DollarSign, perm: "admin.promotions.featured.approve" },
    { id: "revenue"    as const, label: "Revenue",        icon: BarChart3,  perm: "admin.promotions.revenue" },
    { id: "flags"      as const, label: "Feature Flags",  icon: Settings,   perm: "admin.promotions.manage" },
  ];

  const visibleTabs = TABS.filter(t => hasPermission(t.perm as any));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <PageHeader
        title="Promotions"
        description="Manage platform promotions, featured task placement, and revenue"
        actions={
          activeTab === "promotions" && canManage ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-sm font-semibold text-white transition-all"
            >
              <Plus className="h-4 w-4" />
              New Promotion
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[#111113] rounded-xl p-1 w-fit">
        {visibleTabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#18181b] text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Promotions Tab ──────────────────────────────────────────────────── */}
      {activeTab === "promotions" && (
        <div className="space-y-4">
          {promoLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
            </div>
          ) : promotions.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No promotions yet"
              description="Create your first platform promotion to announce features, updates, or events."
            />
          ) : (
            promotions.map(promo => {
              const statusClass = PROMOTION_STATUS_COLORS[promo.status] ?? "text-gray-400 bg-gray-500/10 border-gray-500/20";
              const pages = promo.placements?.map(p => LOCATION_LABELS[p.location] ?? p.location).join(", ") || "—";
              return (
                <SectionCard key={promo.id}>
                  <div className="flex items-start gap-4">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${promo.accentColor ?? "#6366f1"}20`, border: `1px solid ${promo.accentColor ?? "#6366f1"}30` }}
                    >
                      {promo.type === "platform"
                        ? <Megaphone className="h-5 w-5" style={{ color: promo.accentColor ?? "#6366f1" }} />
                        : <Star className="h-5 w-5" style={{ color: promo.accentColor ?? "#a855f7" }} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-semibold text-white">{promo.title}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusClass}`}>
                          {promo.status}
                        </span>
                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{promo.type}</span>
                      </div>
                      <p className="text-xs text-zinc-500 mb-1.5">{pages}</p>
                      <p className="text-xs text-zinc-600">
                        Created {new Date(promo.createdAt).toLocaleDateString()} · Priority {promo.priority}
                      </p>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        {/* Edit button — always available for manage permission */}
                        <button
                          onClick={() => setEditingPromo(promo)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all"
                        >
                          <Edit className="h-3 w-3" />
                          Edit
                        </button>
                        {promo.status === "draft" && (
                          <button
                            onClick={() => doPromoAction(promo.id, "activate")}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all"
                          >
                            <Play className="h-3 w-3" />
                            Activate
                          </button>
                        )}
                        {promo.status === "active" && (
                          <button
                            onClick={() => doPromoAction(promo.id, "pause")}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-all"
                          >
                            <Pause className="h-3 w-3" />
                            Pause
                          </button>
                        )}
                        {promo.status === "paused" && (
                          <button
                            onClick={() => doPromoAction(promo.id, "activate")}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all"
                          >
                            <Play className="h-3 w-3" />
                            Resume
                          </button>
                        )}
                        {["active", "paused", "scheduled"].includes(promo.status) && (
                          <button
                            onClick={() => doPromoAction(promo.id, "expire")}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-500/10 text-gray-400 hover:bg-gray-500/20 border border-gray-500/20 transition-all"
                          >
                            <Clock className="h-3 w-3" />
                            Expire
                          </button>
                        )}
                        {promo.status !== "cancelled" && (
                          <button
                            onClick={() => deletePromotion(promo.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                          >
                            <X className="h-3 w-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </SectionCard>
              );
            })
          )}
        </div>
      )}

      {/* ── Featured Queue Tab ──────────────────────────────────────────────── */}
      {activeTab === "featured" && (
        <div>
          {/* Filter */}
          <div className="flex gap-1 mb-4 bg-[#111113] rounded-xl p-1 w-fit">
            {(["pending_marketplace", "pending_featured", "approved", "rejected", "refunded"] as const).map(status => (
              <button
                key={status}
                onClick={() => setFeaturedFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  featuredFilter === status
                    ? "bg-[#18181b] text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {status.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {featuredLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
              </div>
            ) : featuredRequests.length === 0 ? (
              <EmptyState
                icon={Star}
                title="No requests"
                description={`No featured requests with status: ${featuredFilter.replace(/_/g, " ")}`}
              />
            ) : (
              featuredRequests.map(req => {
                const statusClass = FEATURED_STATUS_COLORS[req.status] ?? "text-gray-400 bg-gray-500/10 border-gray-500/20";
                const pages = req.promotion?.placements?.map(p => LOCATION_LABELS[p.location] ?? p.location).join(", ") || "—";
                return (
                  <SectionCard key={req.id}>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0">
                        <Star className="h-5 w-5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="text-sm font-semibold text-white">{req.task?.title ?? "Task"}</h3>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusClass}`}>
                            {req.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mb-1">
                          {req.user.email} · {req.durationDays} day{req.durationDays !== 1 ? "s" : ""} · ${req.amount.toFixed(2)} · {pages}
                        </p>
                        <p className="text-xs text-zinc-600">Submitted {new Date(req.createdAt).toLocaleDateString()}</p>
                        {req.rejectionReason && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />{req.rejectionReason}
                          </p>
                        )}
                      </div>
                      {canApprove && req.status === "pending_featured" && (
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => approveRequest(req.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectDialog(req.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all"
                          >
                            <XCircle className="h-3 w-3" />
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Pricing Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "pricing" && (
        <div className="space-y-4">
          <SectionCard title="Featured Placement Pricing" description="Set price per duration. Changes apply to all future featured requests.">
            {pricingLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {pricing.map(p => (
                  <div
                    key={p.durationDays}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">
                      {p.durationDays} Day{p.durationDays !== 1 ? "s" : ""}
                    </p>
                    {editingPrice?.durationDays === p.durationDays ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <span className="text-zinc-400 text-sm">$</span>
                          <input
                            type="number"
                            value={editingPrice.price}
                            onChange={e => setEditingPrice({ durationDays: p.durationDays, price: e.target.value })}
                            step="0.01"
                            min="0"
                            className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-indigo-500/50"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={savePrice}
                            className="flex-1 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingPrice(null)}
                            className="px-2 py-1.5 rounded-lg border border-white/[0.08] text-xs text-zinc-400 hover:text-white"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-2xl font-bold text-white">${p.price.toFixed(2)}</p>
                        {canApprove && (
                          <button
                            onClick={() => setEditingPrice({ durationDays: p.durationDays, price: p.price.toString() })}
                            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-all"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* ── Revenue Tab ─────────────────────────────────────────────────────── */}
      {activeTab === "revenue" && (
        <div className="space-y-4">
          {!canRevenue ? (
            <EmptyState
              icon={DollarSign}
              title="Access Restricted"
              description="Revenue data is only accessible to Super Admins."
            />
          ) : revenueLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500" />
            </div>
          ) : revenue ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <StatCard
                  title="Gross Revenue"
                  value={`$${revenue.totalGross.toFixed(2)}`}
                  icon={DollarSign}
                  iconColor="text-green-400"
                  iconBg="bg-green-500/10"
                />
                <StatCard
                  title="Total Refunds"
                  value={`$${revenue.totalRefunds.toFixed(2)}`}
                  icon={RefreshCw}
                  iconColor="text-orange-400"
                  iconBg="bg-orange-500/10"
                />
                <StatCard
                  title="Net Revenue"
                  value={`$${revenue.netRevenue.toFixed(2)}`}
                  icon={BarChart3}
                  iconColor="text-indigo-400"
                  iconBg="bg-indigo-500/10"
                />
              </div>
              <SectionCard title="Revenue Entries" description="All featured placement payments received">
                {revenue.entries.length === 0 ? (
                  <EmptyState icon={DollarSign} title="No revenue yet" />
                ) : (
                  <div className="space-y-2">
                    {revenue.entries.map(entry => (
                      <div key={entry.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                        <div>
                          <p className="text-xs font-mono text-zinc-400">{entry.userId}</p>
                          <p className="text-xs text-zinc-600">{new Date(entry.createdAt).toLocaleDateString()} · {entry.durationDays}d</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${entry.refunded ? "text-orange-400 line-through opacity-60" : "text-green-400"}`}>
                            ${entry.amount.toFixed(2)}
                          </p>
                          {entry.refunded && <p className="text-[10px] text-orange-400">refunded</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </>
          ) : (
            <EmptyState icon={BarChart3} title="Failed to load revenue" />
          )}
        </div>
      )}

      {/* ── Feature Flags Tab ───────────────────────────────────────────────── */}
      {activeTab === "flags" && (
        <SectionCard title="Promotion Feature Flags" description="Enable or disable promotion features platform-wide">
          {flagsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500" />
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
                    onClick={() => canManage && toggleFlag(flag.key, flag.value)}
                    disabled={!canManage}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      flag.value ? "bg-indigo-600" : "bg-zinc-700"
                    } ${!canManage ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
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
      {showCreateModal && (
        <CreatePromotionModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadPromotions}
        />
      )}
      {editingPromo && (
        <EditPromotionModal
          promotion={editingPromo}
          onClose={() => setEditingPromo(null)}
          onSaved={loadPromotions}
        />
      )}
      {rejectDialog && (
        <RejectDialog
          onConfirm={reason => rejectRequest(rejectDialog, reason)}
          onClose={() => setRejectDialog(null)}
        />
      )}
    </div>
  );
}

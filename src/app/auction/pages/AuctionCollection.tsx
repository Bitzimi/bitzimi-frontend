/**
 * AuctionCollection — Phase 22.3
 *
 * Winner's prize collection page with full claim UI.
 *
 * Claim flow:
 *   • POST /api/v1/auctions/collection/:id/claim
 *   • Per reward-type result display after claim
 *   • Loading state during claim
 *   • Replay-safe (server increments claimAttempts before reveal)
 *
 * Phase 22.2 features preserved:
 *   • Filter tabs with count badges
 *   • Image/emoji thumbnails
 *   • Status colors
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Trophy, Loader2, AlertCircle, Tag,
  Clock, CheckCircle, Package, Gift, Crown, DollarSign,
  Monitor, Sparkles, Copy, Check, ExternalLink,
  ChevronRight, RefreshCw,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL ?? "";
const tok = () => localStorage.getItem("bitzimi_access_token") ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionItem {
  id: string;
  auctionId: string;
  status: string;
  claimedAt:     string | null;
  expiresAt:     string | null;
  deliveryNotes: string | null;
  auction: {
    id: string;
    title: string;
    rewardType: string;
    rewardName: string | null;
    rewardValue: number;
    rewardImageUrl: string | null;
    bidAmount: number;
  };
}

interface ClaimResult {
  status: string;
  rewardType: string;
  claimedAt: string;
  // cash_reward
  creditedAmount?: number;
  // vip_subscription
  activeUntil?: string;
  vipGranted?: boolean;
  // gift_card
  code?: string;
  // software
  licenseKey?: string;
  downloadLink?: string | null;
  activationInstructions?: string | null;
  // future_item
  content?: string | null;
  deliveryNotes?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { key: "all",           label: "All" },
  { key: "pending_claim", label: "Pending" },
  { key: "claimed",       label: "Claimed" },
  { key: "delivered",     label: "Delivered" },
  { key: "expired",       label: "Expired" },
];

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string; bg: string }> = {
  pending_claim: { label: "Pending Claim", icon: Clock,         color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  claimed:       { label: "Claimed",       icon: CheckCircle,   color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20" },
  delivered:     { label: "Delivered",     icon: Package,       color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-500/20" },
  expired:       { label: "Expired",       icon: AlertCircle,   color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20" },
};

const REWARD_ICONS: Record<string, React.ElementType> = {
  cash_reward:      DollarSign,
  vip_subscription: Crown,
  gift_card:        Gift,
  software:         Monitor,
  future_item:      Sparkles,
};

const REWARD_EMOJIS: Record<string, string> = {
  cash_reward:      "💵",
  vip_subscription: "👑",
  gift_card:        "🎁",
  software:         "💻",
  future_item:      "🔮",
};

const REWARD_LABELS: Record<string, string> = {
  cash_reward:      "Cash Reward",
  vip_subscription: "VIP Subscription",
  gift_card:        "Gift Card",
  software:         "Software License",
  future_item:      "Future Item",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-xs text-zinc-300 transition-all"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function ClaimResultDisplay({ result, rewardType }: { result: ClaimResult; rewardType: string }) {
  if (rewardType === "cash_reward") {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 space-y-1">
        <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
          <CheckCircle className="w-4 h-4" />
          <span>Reward Claimed!</span>
        </div>
        {result.creditedAmount !== undefined && (
          <p className="text-xs text-emerald-400/80">
            <span className="font-bold text-emerald-300">${result.creditedAmount.toFixed(2)}</span> credited to your Game Wallet.
          </p>
        )}
      </div>
    );
  }

  if (rewardType === "vip_subscription") {
    return (
      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 space-y-1">
        <div className="flex items-center gap-2 text-purple-300 font-bold text-sm">
          <Crown className="w-4 h-4" />
          <span>VIP Activated!</span>
        </div>
        {result.activeUntil && (
          <p className="text-xs text-purple-400/80">
            Active until{" "}
            <span className="font-semibold text-purple-300">
              {new Date(result.activeUntil).toLocaleDateString()}
            </span>
          </p>
        )}
      </div>
    );
  }

  if (rewardType === "gift_card" && result.code) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-rose-300 font-bold text-sm">
          <Gift className="w-4 h-4" />
          <span>Your Gift Card Code</span>
        </div>
        <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg border border-white/[0.06]">
          <code className="text-base font-mono font-bold text-white tracking-widest flex-1 break-all">
            {result.code}
          </code>
          <CopyButton value={result.code} />
        </div>
        {result.deliveryNotes && (
          <p className="text-xs text-zinc-500 italic">{result.deliveryNotes}</p>
        )}
      </div>
    );
  }

  if (rewardType === "software") {
    return (
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
          <Monitor className="w-4 h-4" />
          <span>Software License</span>
        </div>
        {result.licenseKey && (
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">License Key</p>
            <div className="flex items-center gap-2 p-3 bg-zinc-900 rounded-lg border border-white/[0.06]">
              <code className="text-sm font-mono font-bold text-white tracking-wider flex-1 break-all">
                {result.licenseKey}
              </code>
              <CopyButton value={result.licenseKey} />
            </div>
          </div>
        )}
        {result.downloadLink && (
          <a
            href={result.downloadLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Download Software
          </a>
        )}
        {result.activationInstructions && (
          <div>
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">Activation Instructions</p>
            <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">
              {result.activationInstructions}
            </p>
          </div>
        )}
      </div>
    );
  }

  if (rewardType === "future_item") {
    return (
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
          <Sparkles className="w-4 h-4" />
          <span>Your Prize Details</span>
        </div>
        {result.content && (
          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{result.content}</p>
        )}
        {result.deliveryNotes && (
          <p className="text-xs text-zinc-500 italic">{result.deliveryNotes}</p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
        <CheckCircle className="w-4 h-4" />
        <span>Claim Successful</span>
      </div>
    </div>
  );
}

// ─── Collection item card ─────────────────────────────────────────────────────

function CollectionCard({ item, onClaimed }: { item: CollectionItem; onClaimed: () => void }) {
  const [claiming, setClaiming]       = useState(false);
  const [claimError, setClaimError]   = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
  const [imgLoaded, setImgLoaded]     = useState(false);
  const [imgError, setImgError]       = useState(false);
  const navigate = useNavigate();

  const statusCfg   = STATUS_CONFIG[item.status];
  const StatusIcon  = statusCfg?.icon ?? Clock;
  const RewardIcon  = REWARD_ICONS[item.auction.rewardType] ?? Trophy;
  const emoji       = REWARD_EMOJIS[item.auction.rewardType] ?? "🏆";
  const rewardLabel = REWARD_LABELS[item.auction.rewardType] ?? item.auction.rewardType;
  const showImage   = item.auction.rewardImageUrl && !imgError;

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await fetch(`${API}/api/v1/auctions/collection/${item.id}/claim`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      setClaimResult(data);
      onClaimed();
    } catch (e: any) {
      setClaimError(e.message);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl overflow-hidden">
      {/* Thumbnail */}
      <div className="relative h-36 bg-zinc-800">
        {showImage ? (
          <>
            {!imgLoaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" />}
            <img
              src={item.auction.rewardImageUrl!}
              alt={item.auction.rewardName ?? item.auction.title}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgError(true)}
              className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-zinc-800 to-zinc-900">
            <span className="text-4xl">{emoji}</span>
          </div>
        )}
        {statusCfg && (
          <div className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusCfg.bg} ${statusCfg.color}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {statusCfg.label}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white leading-snug">{item.auction.title}</h3>
          <div className="flex items-center gap-1.5 mt-1">
            <RewardIcon className="w-3 h-3 text-zinc-600" />
            <span className="text-xs text-zinc-500">
              {item.auction.rewardName ? `${item.auction.rewardName} · ` : ""}{rewardLabel}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Tag className="w-3 h-3 text-zinc-700" />
            <span className="text-xs text-zinc-600">
              Value:{" "}
              <span className="text-white font-semibold">${item.auction.rewardValue.toLocaleString()}</span>
            </span>
          </div>
        </div>

        {item.expiresAt && item.status === "pending_claim" && (
          <p className="text-xs text-yellow-400/70 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            Claim by {new Date(item.expiresAt).toLocaleDateString()}
          </p>
        )}

        {item.deliveryNotes && !claimResult && (
          <p className="text-xs text-zinc-500 italic">{item.deliveryNotes}</p>
        )}

        {claimResult && <ClaimResultDisplay result={claimResult} rewardType={item.auction.rewardType} />}

        {claimError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400">{claimError}</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          {item.status === "pending_claim" && !claimResult && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                claiming
                  ? "bg-zinc-700 text-zinc-400 cursor-wait"
                  : "bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white shadow-md shadow-amber-900/20"
              }`}
            >
              {claiming
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Claiming…</>
                : <><Trophy className="w-3.5 h-3.5" /> Claim Reward</>
              }
            </button>
          )}

          <button
            onClick={() => navigate(`/auction/${item.auctionId}`)}
            className={`flex items-center gap-1.5 py-2.5 px-3 rounded-xl text-xs text-zinc-500 bg-zinc-800 hover:text-zinc-300 border border-white/[0.05] transition-all ${
              item.status === "pending_claim" && !claimResult ? "" : "flex-1"
            }`}
          >
            View Auction <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {item.claimedAt && (
          <p className="text-[10px] text-zinc-700 text-center">
            Claimed {new Date(item.claimedAt).toLocaleDateString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuctionCollection() {
  const navigate = useNavigate();
  const [items, setItems]         = useState<CollectionItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const loadCollection = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auctions/collection/my`, {
        headers: { Authorization: `Bearer ${tok()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load collection");
      setItems(data.items ?? []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCollection(); }, [loadCollection]);

  const counts: Record<string, number> = { all: items.length };
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }

  const filtered = activeTab === "all"
    ? items
    : items.filter((i) => i.status === activeTab);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.05] sticky top-0 bg-zinc-950/90 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate("/auction")}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Marketplace</span>
        </button>
        <h1 className="text-sm font-bold text-white">My Prizes</h1>
        <button
          onClick={() => loadCollection(true)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 px-4 pt-4 overflow-x-auto scrollbar-none">
        {FILTER_TABS.map((tab) => {
          const count    = counts[tab.key] ?? 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                isActive
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:text-zinc-300 border border-white/[0.05]"
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-[10px] px-1 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-zinc-700 text-zinc-400"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="p-4 pb-24 md:pb-8 space-y-4 max-w-2xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
            <button onClick={() => loadCollection()} className="text-xs text-zinc-500 hover:text-zinc-300">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-white/[0.06] flex items-center justify-center">
              <Trophy className="w-8 h-8 text-zinc-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-400">
                {activeTab === "all" ? "No prizes yet" : `No ${activeTab.replace("_", " ")} prizes`}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                {activeTab === "all"
                  ? "Win an auction to see your prizes here."
                  : "Switch to another filter to see your prizes."}
              </p>
            </div>
            {activeTab === "all" && (
              <button
                onClick={() => navigate("/auction")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-semibold hover:bg-amber-500 transition-all"
              >
                Browse Auctions <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {filtered.map((item) => (
              <CollectionCard
                key={item.id}
                item={item}
                onClaimed={() => loadCollection(true)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

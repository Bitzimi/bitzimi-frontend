/**
 * AuctionDetail — Phase 22.3
 *
 * Full auction detail page with live SSE updates and bid placement.
 *
 * Live features:
 *   • SSE connection for real-time pool/leader/timer sync
 *   • Game Wallet balance display
 *   • Bid button with cooldown + optimistic feedback
 *   • Live bid feed (masked usernames)
 *   • Last-minute extension visual indicator
 *
 * Phase 22.1/22.2 features preserved:
 *   • Dual countdown (Timer A / Timer B)
 *   • All status states
 *   • Reward information
 *   • Auction rules
 *   • Collection status
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ArrowLeft, Gavel, Trophy, Users, DollarSign, Clock, AlertCircle,
  Loader2, Info, Zap, Crown, CheckCircle, Tag, CalendarClock,
  RefreshCw, Star, Wifi, WifiOff, Wallet, ChevronRight,
} from "lucide-react";
import AuctionCountdown from "../components/AuctionCountdown";
import { AuctionPublic } from "../components/AuctionCard";
import { useAuctionSSE, LiveBidEvent } from "../hooks/useAuctionSSE";
import { useGameWallet } from "../hooks/useGameWallet";

const API = import.meta.env.VITE_API_URL ?? "";
const tok = () => localStorage.getItem("bitzimi_access_token") ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollectionItem {
  id: string;
  auctionId: string;
  status: string;
  claimedAt: string | null;
  expiresAt: string | null;
  deliveryNotes: string | null;
}

const REWARD_TYPE_LABELS: Record<string, string> = {
  cash_reward:      "Cash Reward",
  vip_subscription: "VIP Subscription",
  gift_card:        "Gift Card",
  software:         "Software License",
  future_item:      "Future Item",
};

const REWARD_TYPE_ICONS: Record<string, string> = {
  cash_reward:      "💵",
  vip_subscription: "👑",
  gift_card:        "🎁",
  software:         "💻",
  future_item:      "🔮",
};

const COLLECTION_STATUS: Record<string, { label: string; color: string; icon: typeof Trophy }> = {
  pending_claim: { label: "Pending Claim — contact support to collect",  color: "text-yellow-400", icon: Clock },
  claimed:       { label: "Claimed",        color: "text-blue-400",    icon: CheckCircle },
  delivered:     { label: "Delivered",      color: "text-emerald-400", icon: CheckCircle },
  expired:       { label: "Claim Expired",  color: "text-red-400",     icon: AlertCircle },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value, accent = false }: {
  icon: React.ElementType; label: string; value: string | number; accent?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-white/[0.07] rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-1.5">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${accent ? "text-amber-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function InfoRow({ label, value, valueClass = "text-white" }: {
  label: string; value: string; valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className={`text-xs font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

// ─── Bid feed item ────────────────────────────────────────────────────────────

function BidFeedItem({ bid }: { bid: LiveBidEvent }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0 animate-in slide-in-from-top-1 fade-in duration-300">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-zinc-600 font-mono">#{bid.bidNumber}</span>
        <span className="text-xs font-mono font-semibold text-amber-300">{bid.userMasked}</span>
        {bid.wasExtended && (
          <span className="flex items-center gap-0.5 text-[9px] text-orange-400">
            <Zap className="w-2.5 h-2.5" />+10m
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 tabular-nums">${bid.amount.toFixed(2)}</span>
        <span className="text-[10px] text-zinc-700">{new Date(bid.timestamp).toLocaleTimeString()}</span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuctionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [auction, setAuction]       = useState<AuctionPublic | null>(null);
  const [collection, setCollection] = useState<CollectionItem | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [imgLoaded, setImgLoaded]   = useState(false);
  const [imgError, setImgError]     = useState(false);

  // ── Bidding state ──────────────────────────────────────────────────────
  const [bidding, setBidding]         = useState(false);
  const [bidError, setBidError]       = useState<string | null>(null);
  const [bidSuccess, setBidSuccess]   = useState(false);
  const bidCooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Wallet ─────────────────────────────────────────────────────────────
  const { balance: gameBalance, refresh: refreshWallet } = useGameWallet();

  // ── SSE live updates ───────────────────────────────────────────────────
  const isLive = auction?.status === "live";

  const { connected, liveState, bids: liveBids } = useAuctionSSE({
    auctionId: id,
    enabled:   isLive,
    onBid: () => {
      // Refresh wallet after each bid (might be our own bid)
      refreshWallet();
    },
    onEnded: () => {
      // Re-fetch full auction to get final state
      loadAuction(true);
    },
  });

  // Merge SSE live state into displayed values
  const pool         = liveState?.currentPool         ?? auction?.currentPool         ?? 0;
  const bidCount     = liveState?.bidCount            ?? auction?.bidCount            ?? 0;
  const participants = liveState?.participantCount    ?? auction?.participantCount    ?? 0;
  const leader       = liveState?.currentLeaderMasked ?? auction?.currentLeaderMasked ?? null;
  const endsAt       = liveState?.endsAt              ?? auction?.endsAt              ?? null;
  const extensions   = liveState?.extensionCount      ?? auction?.extensionCount      ?? 0;

  // ── Data loading ───────────────────────────────────────────────────────
  const loadAuction = useCallback(async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const [aRes, cRes] = await Promise.all([
        fetch(`${API}/api/v1/auctions/${id}`, { headers: { Authorization: `Bearer ${tok()}` } }),
        fetch(`${API}/api/v1/auctions/collection/my`, { headers: { Authorization: `Bearer ${tok()}` } }),
      ]);
      const aData = await aRes.json();
      if (!aRes.ok) throw new Error(aData.error?.message ?? aData.message ?? "Auction not found");
      setAuction(aData.auction);

      if (cRes.ok) {
        const cData = await cRes.json();
        const mine = (cData.items ?? []).find((i: CollectionItem) => i.auctionId === id);
        setCollection(mine ?? null);
      }
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadAuction(); }, [loadAuction]);

  const handleExpire = useCallback(() => {
    setTimeout(() => loadAuction(true), 2000);
  }, [loadAuction]);

  // ── Place bid ──────────────────────────────────────────────────────────
  const handleBid = async () => {
    if (bidding || !id) return;
    setBidding(true);
    setBidError(null);
    setBidSuccess(false);

    try {
      const res = await fetch(`${API}/api/v1/auctions/${id}/bid`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${tok()}`, "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? data.message ?? "Bid failed");

      setBidSuccess(true);
      refreshWallet();

      // Clear success state after 3s
      if (bidCooldownRef.current) clearTimeout(bidCooldownRef.current);
      bidCooldownRef.current = setTimeout(() => setBidSuccess(false), 3000);
    } catch (e: any) {
      setBidError(e.message);
    } finally {
      setBidding(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error || !auction) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{error ?? "Auction not found"}</p>
          <p className="text-zinc-500 text-xs mt-1">It may have been removed or is not public.</p>
        </div>
        <button
          onClick={() => navigate("/auction")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 border border-white/[0.06] text-sm hover:text-white transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Marketplace
        </button>
      </div>
    );
  }

  const isUpcoming = auction.status === "upcoming";
  const isEnded    = auction.status === "ended";
  const isPaused   = auction.status === "paused";

  const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
    live:     { label: "LIVE",     badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
    upcoming: { label: "UPCOMING", badge: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    ended:    { label: "ENDED",    badge: "bg-zinc-700/60 text-zinc-400 border-zinc-600/30" },
    paused:   { label: "PAUSED",   badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
    cancelled:{ label: "CANCELLED",badge: "bg-red-500/20 text-red-400 border-red-500/30" },
    draft:    { label: "DRAFT",    badge: "bg-zinc-700/60 text-zinc-500 border-zinc-600/30" },
  };

  const statusCfg    = STATUS_CONFIG[auction.status] ?? STATUS_CONFIG.ended;
  const rewardLabel  = REWARD_TYPE_LABELS[auction.rewardType] ?? auction.rewardType;
  const rewardEmoji  = REWARD_TYPE_ICONS[auction.rewardType] ?? "🏆";
  const showImage    = auction.rewardImageUrl && !imgError;

  const canAfford   = gameBalance !== null && gameBalance >= auction.bidAmount;
  const biddingOpen = isLive && !isPaused;

  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Sticky top nav ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/[0.05] sticky top-0 bg-zinc-950/90 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate("/auction")}
          className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Marketplace</span>
        </button>

        <div className="flex items-center gap-3">
          {/* SSE connection indicator */}
          {isLive && (
            <div className={`flex items-center gap-1 text-xs ${connected ? "text-emerald-400" : "text-zinc-600"}`}>
              {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{connected ? "Live" : "Reconnecting…"}</span>
            </div>
          )}
          {isLive && (
            <button
              onClick={() => loadAuction(true)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-5 pb-20 md:pb-8">

        {/* ── Hero image ──────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden h-52 sm:h-64 bg-zinc-900 border border-white/[0.06]">
          {showImage ? (
            <>
              {!imgLoaded && <div className="absolute inset-0 bg-zinc-800 animate-pulse" />}
              <img
                src={auction.rewardImageUrl!}
                alt={auction.rewardName ?? auction.title}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
                className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            </>
          ) : (
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br ${
              auction.rewardType === "cash_reward"      ? "from-emerald-900/40 to-zinc-900"
              : auction.rewardType === "vip_subscription" ? "from-purple-900/40 to-zinc-900"
              : auction.rewardType === "gift_card"       ? "from-rose-900/40 to-zinc-900"
              : auction.rewardType === "software"        ? "from-blue-900/40 to-zinc-900"
              : "from-amber-900/40 to-zinc-900"
            }`}>
              <span className="text-5xl">{rewardEmoji}</span>
              <span className="text-zinc-500 text-sm">{rewardLabel}</span>
            </div>
          )}

          <div className="absolute top-3 left-3">
            <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full border ${statusCfg.badge}`}>
              {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
              {statusCfg.label}
            </span>
          </div>

          <div className="absolute bottom-3 left-3">
            <span className="text-sm font-bold text-white/90">
              Prize{" "}<span className="text-amber-400">${auction.rewardValue.toLocaleString()}</span>
            </span>
          </div>
        </div>

        {/* ── Title + description ──────────────────────────────────────── */}
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">{auction.title}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <Tag className="w-3.5 h-3.5 text-zinc-600" />
            <span className="text-xs text-zinc-500">
              {auction.rewardName ? `${auction.rewardName} · ` : ""}{rewardLabel}
            </span>
          </div>
          {auction.description && (
            <p className="mt-3 text-sm text-zinc-400 leading-relaxed">{auction.description}</p>
          )}
        </div>

        {/* ── Winner collection status ─────────────────────────────────── */}
        {collection && (() => {
          const cfg = COLLECTION_STATUS[collection.status];
          if (!cfg) return null;
          const Icon = cfg.icon;
          return (
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/25 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-300">You Won This Auction!</p>
                <div className={`flex items-center gap-1.5 mt-1 text-xs ${cfg.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cfg.label}</span>
                </div>
                {collection.deliveryNotes && (
                  <p className="text-xs text-zinc-500 mt-1 italic">{collection.deliveryNotes}</p>
                )}
                {collection.expiresAt && collection.status === "pending_claim" && (
                  <p className="text-xs text-zinc-600 mt-1">
                    Claim by {new Date(collection.expiresAt).toLocaleDateString()}
                  </p>
                )}
                <button
                  onClick={() => navigate("/auction/collection")}
                  className="mt-2 flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                >
                  Go to My Prizes <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── Countdown ───────────────────────────────────────────────── */}
        {(isLive || isUpcoming) && (
          <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl p-5">
            <AuctionCountdown
              startsAt={auction.startsAt}
              endsAt={endsAt}
              status={auction.status}
              onExpire={handleExpire}
              variant="full"
            />
            {extensions > 0 && (
              <p className="text-xs text-orange-400 text-center mt-3">
                Extended {extensions}× by last-minute bids
              </p>
            )}
          </div>
        )}

        {/* ── Live stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={DollarSign} label="Total Pool"   value={`$${pool.toFixed(2)}`} />
          <StatTile icon={Gavel}      label="Bid Amount"   value={`$${auction.bidAmount.toFixed(2)}`} accent />
          <StatTile icon={Users}      label="Participants" value={participants} />
          <StatTile icon={Clock}      label="Total Bids"   value={bidCount} />
        </div>

        {/* ── Current leader ───────────────────────────────────────────── */}
        {leader && (
          <div className="bg-amber-500/8 border border-amber-500/20 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[10px] text-amber-400/60 uppercase tracking-widest">Current Leader</p>
              <p className="text-base font-bold text-amber-300 font-mono mt-0.5">{leader}</p>
              <p className="text-xs text-zinc-600 mt-0.5">
                {isLive ? "Wins if time expires" : isEnded ? "Won this auction" : ""}
              </p>
            </div>
          </div>
        )}

        {/* ── Game Wallet + Bid button ─────────────────────────────────── */}
        {biddingOpen && (
          <div className="bg-zinc-900 border border-white/[0.07] rounded-2xl p-5 space-y-4">
            {/* Wallet balance */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Wallet className="w-4 h-4" />
                <span>Game Wallet</span>
              </div>
              <span className={`text-sm font-bold tabular-nums ${
                gameBalance === null
                  ? "text-zinc-600"
                  : canAfford
                  ? "text-white"
                  : "text-red-400"
              }`}>
                {gameBalance === null ? "Loading…" : `$${gameBalance.toFixed(2)}`}
              </span>
            </div>

            {/* Error from bid */}
            {bidError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400">{bidError}</p>
              </div>
            )}

            {/* Success state */}
            {bidSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-emerald-400">
                  Bid placed! You are now the Current Leader.
                </p>
              </div>
            )}

            {/* Bid button */}
            <button
              onClick={handleBid}
              disabled={bidding || !canAfford}
              className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                bidding
                  ? "bg-zinc-700 text-zinc-400 cursor-wait"
                  : !canAfford
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/[0.06]"
                  : "bg-amber-600 hover:bg-amber-500 active:scale-[0.98] text-white shadow-md shadow-amber-900/30"
              }`}
            >
              {bidding ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Placing Bid…</>
              ) : !canAfford ? (
                <><AlertCircle className="w-4 h-4" /> Insufficient Balance</>
              ) : (
                <><Gavel className="w-4 h-4" /> Place Bid — ${auction.bidAmount.toFixed(2)}</>
              )}
            </button>

            {!canAfford && gameBalance !== null && (
              <p className="text-xs text-zinc-600 text-center">
                Need ${(auction.bidAmount - gameBalance).toFixed(2)} more in your Game Wallet to bid.
              </p>
            )}
          </div>
        )}

        {/* ── Paused / ended / upcoming status messages ─────────────────── */}
        {isPaused && (
          <div className="bg-yellow-500/8 border border-yellow-500/15 rounded-2xl p-4 text-center">
            <p className="text-sm text-yellow-300/70">Auction is temporarily paused.</p>
            <p className="text-xs text-zinc-600 mt-1">Please check back shortly.</p>
          </div>
        )}
        {isUpcoming && (
          <div className="bg-blue-500/8 border border-blue-500/15 rounded-2xl p-4 text-center space-y-1">
            <CalendarClock className="w-6 h-6 text-blue-400/50 mx-auto" />
            <p className="text-sm text-blue-300/70">Auction hasn't started yet</p>
            <p className="text-xs text-zinc-600">Bidding opens when the countdown reaches zero.</p>
          </div>
        )}
        {isEnded && !collection && (
          <div className="bg-zinc-800/40 border border-white/[0.05] rounded-2xl p-4 text-center">
            <p className="text-sm text-zinc-500">This auction has ended.</p>
            {leader && (
              <p className="text-xs text-zinc-600 mt-1">
                Won by <span className="font-mono">{leader}</span>
              </p>
            )}
          </div>
        )}

        {/* ── Live bid feed ────────────────────────────────────────────── */}
        {isLive && liveBids.length > 0 && (
          <div className="bg-zinc-900 border border-white/[0.07] rounded-xl p-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Live Bid Feed
            </h3>
            <div className="max-h-48 overflow-y-auto space-y-0">
              {liveBids.map((b, i) => <BidFeedItem key={`${b.bidNumber}-${i}`} bid={b} />)}
            </div>
          </div>
        )}

        {/* ── Date/schedule info ────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-white/[0.07] rounded-xl px-4 py-3">
          <InfoRow label="Scheduled Start" value={new Date(auction.startsAt).toLocaleString()} />
          {auction.endsAt && (
            <InfoRow
              label={isEnded ? "Ended At" : "Scheduled End"}
              value={new Date(endsAt ?? auction.endsAt).toLocaleString()}
            />
          )}
          <InfoRow label="Duration" value={`${auction.durationMinutes} min`} />
        </div>

        {/* ── Last-minute extension info ────────────────────────────────── */}
        {(isLive || isUpcoming) && (
          <div className="bg-orange-500/8 border border-orange-500/20 rounded-2xl p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Zap className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-orange-300">Last-Minute Extension</p>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                If a bid is placed within the last{" "}
                <span className="text-orange-300 font-semibold">{auction.extensionWindowSeconds}s</span>,
                the countdown resets to{" "}
                <span className="text-orange-300 font-semibold">
                  {Math.floor(auction.extensionDurationSeconds / 60)} minutes
                </span>. No limit on extensions.
              </p>
            </div>
          </div>
        )}

        {/* ── Reward information ────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-white/[0.07] rounded-xl px-4 py-3">
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Reward Information
          </h3>
          <InfoRow label="Type"  value={rewardLabel} />
          {auction.rewardName && <InfoRow label="Item" value={auction.rewardName} />}
          <InfoRow label="Value" value={`$${auction.rewardValue.toFixed(2)}`} valueClass="text-emerald-400" />
        </div>

        {/* ── Auction rules ─────────────────────────────────────────────── */}
        <div className="bg-zinc-900 border border-white/[0.07] rounded-xl p-4">
          <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-zinc-400" />
            How This Auction Works
          </h3>
          <ul className="space-y-3">
            {[
              { icon: Gavel,    text: <>Each bid costs exactly <strong className="text-white">${auction.bidAmount.toFixed(2)}</strong> from your Game Wallet — fixed price, no exceptions.</> },
              { icon: Crown,    text: <>The <strong className="text-white">most recent bidder</strong> is the Current Leader. When time expires, the leader wins.</> },
              { icon: Zap,      text: <>Bids within the last <strong className="text-white">{auction.extensionWindowSeconds}s</strong> extend the timer to <strong className="text-white">{Math.floor(auction.extensionDurationSeconds / 60)} minutes</strong>.</> },
              { icon: Trophy,   text: "The winner receives the prize. Other participants do not receive refunds." },
              { icon: Star,     text: "Usernames are partially masked to protect participant privacy." },
            ].map((rule, i) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-zinc-400 leading-relaxed">
                <rule.icon className="w-3.5 h-3.5 text-amber-500/60 mt-0.5 flex-shrink-0" />
                <span>{rule.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * AuctionCard — Phase 22.2
 *
 * Displays a single auction in the marketplace grid.
 * Supports image lazy-load, skeleton state, all 6 statuses.
 */

import { useState } from "react";
import { useNavigate } from "react-router";
import { Gavel, Users, DollarSign, Trophy, Eye, Tag, Crown } from "lucide-react";
import AuctionCountdown from "./AuctionCountdown";

export interface AuctionPublic {
  id: string;
  title: string;
  description: string | null;
  rewardType: string;
  rewardName: string | null;
  rewardValue: number;
  rewardImageUrl: string | null;
  bidAmount: number;
  status: string;
  currentLeaderMasked: string | null;
  currentPool: number;
  bidCount: number;
  participantCount: number;
  extensionWindowSeconds: number;
  extensionDurationSeconds: number;
  startsAt: string;
  endsAt: string | null;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS: Record<string, {
  label: string;
  dot: string;
  badge: string;
  glow: string;
}> = {
  live: {
    label: "LIVE",
    dot: "bg-emerald-400",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    glow: "shadow-emerald-500/10",
  },
  upcoming: {
    label: "UPCOMING",
    dot: "bg-blue-400",
    badge: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    glow: "",
  },
  ended: {
    label: "ENDED",
    dot: "bg-zinc-500",
    badge: "bg-zinc-700/60 text-zinc-400 border-zinc-600/30",
    glow: "",
  },
  paused: {
    label: "PAUSED",
    dot: "bg-yellow-400",
    badge: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    glow: "",
  },
  cancelled: {
    label: "CANCELLED",
    dot: "bg-red-500",
    badge: "bg-red-500/20 text-red-400 border-red-500/30",
    glow: "",
  },
  draft: {
    label: "DRAFT",
    dot: "bg-zinc-600",
    badge: "bg-zinc-700/60 text-zinc-500 border-zinc-600/30",
    glow: "",
  },
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  cash_reward:      "Cash Reward",
  vip_subscription: "VIP Subscription",
  gift_card:        "Gift Card",
  software:         "Software",
  future_item:      "Future Item",
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

export function AuctionCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-white/[0.06] rounded-2xl overflow-hidden animate-pulse">
      <div className="h-40 bg-zinc-800" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-zinc-800 rounded-lg w-3/4" />
        <div className="h-3 bg-zinc-800 rounded-lg w-1/2" />
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="h-14 bg-zinc-800 rounded-xl" />
          <div className="h-14 bg-zinc-800 rounded-xl" />
        </div>
        <div className="h-9 bg-zinc-800 rounded-xl mt-2" />
      </div>
    </div>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function AuctionCard({ auction }: { auction: AuctionPublic }) {
  const navigate = useNavigate();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const cfg = STATUS[auction.status] ?? STATUS.ended;
  const isLive = auction.status === "live";
  const isUpcoming = auction.status === "upcoming";
  const isEnded = auction.status === "ended";
  const rewardTypeLabel = REWARD_TYPE_LABELS[auction.rewardType] ?? auction.rewardType;

  const showImage = auction.rewardImageUrl && !imgError;

  return (
    <article
      onClick={() => navigate(`/auction/${auction.id}`)}
      className={`
        group relative bg-zinc-900 border border-white/[0.07] rounded-2xl overflow-hidden cursor-pointer
        transition-all duration-300
        hover:border-amber-500/25 hover:bg-zinc-800/70 hover:-translate-y-0.5
        ${isLive ? `shadow-lg ${cfg.glow}` : ""}
        ${isEnded ? "opacity-80" : ""}
      `}
    >
      {/* ── Image area ────────────────────────────────────────────────────── */}
      <div className="relative h-40 overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-900">
        {/* Placeholder / gradient bg */}
        {!showImage && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center gap-2
            bg-gradient-to-br
            ${auction.rewardType === "cash_reward" ? "from-emerald-900/30 to-zinc-900"
              : auction.rewardType === "vip_subscription" ? "from-purple-900/30 to-zinc-900"
              : auction.rewardType === "gift_card" ? "from-rose-900/30 to-zinc-900"
              : auction.rewardType === "software" ? "from-blue-900/30 to-zinc-900"
              : "from-amber-900/30 to-zinc-900"
            }`}
          >
            <Trophy className="w-10 h-10 text-zinc-700" />
            <span className="text-xs text-zinc-600">{rewardTypeLabel}</span>
          </div>
        )}

        {/* Lazy image */}
        {auction.rewardImageUrl && !imgError && (
          <img
            src={auction.rewardImageUrl}
            alt={auction.rewardName ?? auction.title}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        )}

        {/* Image loading skeleton */}
        {showImage && !imgLoaded && (
          <div className="absolute inset-0 bg-zinc-800 animate-pulse" />
        )}

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Status badge — top left */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badge}`}>
            {isLive && (
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} animate-pulse`} />
            )}
            {cfg.label}
          </span>
        </div>

        {/* Countdown — bottom right of image */}
        <div className="absolute bottom-2 right-2.5">
          <AuctionCountdown
            startsAt={auction.startsAt}
            endsAt={auction.endsAt}
            status={auction.status}
            variant="compact"
          />
        </div>

        {/* Reward value — bottom left of image */}
        {!isEnded && (
          <div className="absolute bottom-2 left-2.5">
            <span className="text-xs font-bold text-white/90">
              Worth <span className="text-amber-400">${auction.rewardValue.toLocaleString()}</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="p-4">
        {/* Title */}
        <h3 className="text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors leading-snug">
          {auction.title}
        </h3>

        {/* Reward name + type */}
        <div className="flex items-center gap-1.5 mt-1">
          <Tag className="w-3 h-3 text-zinc-600 flex-shrink-0" />
          <p className="text-xs text-zinc-500 truncate">
            {auction.rewardName ? auction.rewardName : rewardTypeLabel}
          </p>
        </div>

        {/* Stats row */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {/* Pool */}
          <div className="bg-zinc-800/60 border border-white/[0.04] rounded-xl p-2.5">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">Pool</p>
            <div className="flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-sm font-bold text-white tabular-nums">
                {auction.currentPool.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Bid amount */}
          <div className="bg-zinc-800/60 border border-white/[0.04] rounded-xl p-2.5">
            <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-0.5">Per Bid</p>
            <div className="flex items-center gap-1">
              <Gavel className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-sm font-bold text-white tabular-nums">
                ${auction.bidAmount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Participants + leader row */}
        <div className="mt-2.5 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{auction.participantCount} {auction.participantCount === 1 ? "participant" : "participants"}</span>
          </div>

          {auction.currentLeaderMasked ? (
            <div className="flex items-center gap-1 text-amber-500/80">
              <Crown className="w-3 h-3" />
              <span className="font-mono font-medium">{auction.currentLeaderMasked}</span>
            </div>
          ) : isLive ? (
            <span className="text-zinc-600 italic text-[10px]">No leader yet</span>
          ) : null}
        </div>

        {/* CTA button */}
        <button
          className={`
            mt-3 w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5
            transition-all duration-200
            ${isLive
              ? "bg-amber-600 hover:bg-amber-500 text-white shadow-sm"
              : isUpcoming
              ? "bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/20"
              : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-white/[0.06]"
            }
          `}
          onClick={(e) => { e.stopPropagation(); navigate(`/auction/${auction.id}`); }}
        >
          <Eye className="w-3.5 h-3.5" />
          {isLive ? "View Live Auction" : isUpcoming ? "View Auction" : "View Details"}
        </button>
      </div>
    </article>
  );
}

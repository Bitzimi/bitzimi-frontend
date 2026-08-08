/**
 * FeaturedPromotionCard — Phase 21
 *
 * Displayed on: Wallet, Tasks, Referrals, Affiliate, Ambassador pages.
 * Fetches its own promotion from the backend using the provided location key.
 * Renders nothing if the feature is disabled or no active promotion exists for that location.
 *
 * Design: matches the wallet card visual style — same width, same rounded corners,
 * same premium dark-mode finish. Does NOT look like an external advertisement.
 *
 * Users never earn from clicking. No rewards, no commissions.
 * Platform type → show announcement. Featured task type → navigate to that task.
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { ExternalLink, Megaphone, Star, X, ArrowRight, Zap } from "lucide-react";

const API_BASE = (import.meta as any).env?.VITE_API_URL as string | undefined;
function getToken() { return localStorage.getItem("bitzimi_access_token"); }

export type PromotionLocation = "wallet" | "marketplace" | "referral" | "affiliate" | "ambassador";

interface Promotion {
  id:          string;
  type:        "platform" | "featured_task";
  title:       string;
  description: string | null;
  ctaLabel:    string | null;
  ctaUrl:      string | null;
  imageUrl:    string | null;
  badgeLabel:  string | null;
  badgeColor:  string | null;
  accentColor: string | null;
  startsAt:    string | null;
  endsAt:      string | null;
  taskId?:     string | null;
}

interface FeaturedPromotionCardProps {
  location: PromotionLocation;
  className?: string;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PromotionSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl overflow-hidden border border-white/[0.06] bg-[#18181b] mb-4">
      <div className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-3.5 w-20 rounded bg-zinc-800 mb-2" />
          <div className="h-4 w-48 rounded bg-zinc-700/70 mb-1.5" />
          <div className="h-3 w-32 rounded bg-zinc-800/80" />
        </div>
        <div className="h-8 w-20 rounded-lg bg-zinc-800 flex-shrink-0" />
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function FeaturedPromotionCard({ location, className = "" }: FeaturedPromotionCardProps) {
  const navigate = useNavigate();
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [loading, setLoading]     = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    if (!API_BASE || !getToken()) { setLoading(false); return; }
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/promotions/active?location=${location}`,
        { headers: { Authorization: `Bearer ${getToken()}` } },
      );
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();
      setPromotion(json.data ?? null);
    } catch {
      // Network error — fail silently, no card shown
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <PromotionSkeleton />;
  if (!promotion || dismissed) return null;

  const isPlatform = promotion.type === "platform";
  const accent     = promotion.accentColor ?? (isPlatform ? "#6366f1" : "#a855f7");
  const badge      = promotion.badgeLabel  ?? (isPlatform ? "Announcement" : "Featured");
  const cta        = promotion.ctaLabel    ?? (isPlatform ? "Learn More" : "View Task");

  function handleCta() {
    if (isPlatform) {
      if (promotion?.ctaUrl) {
        if (promotion.ctaUrl.startsWith("http")) {
          window.open(promotion.ctaUrl, "_blank", "noreferrer");
        } else {
          navigate(promotion.ctaUrl);
        }
      }
    } else {
      // Featured task — navigate to marketplace
      navigate("/tasks");
    }
  }

  return (
    <div
      className={`relative rounded-2xl overflow-hidden mb-4 border transition-all duration-200 hover:shadow-lg group ${className}`}
      style={{
        borderColor: `${accent}30`,
        background:  `linear-gradient(135deg, ${accent}12 0%, transparent 60%), #111113`,
        boxShadow:   `0 0 0 1px ${accent}20, inset 0 1px 0 ${accent}15`,
      }}
    >
      {/* Ambient glow top-left */}
      <div
        className="absolute -top-6 -left-6 w-24 h-24 rounded-full blur-2xl pointer-events-none"
        style={{ background: `${accent}18` }}
      />

      {/* Banner image — shown above content when imageUrl is set */}
      {promotion.imageUrl && (
        <div className="relative w-full h-28 overflow-hidden">
          <img
            src={promotion.imageUrl}
            alt={promotion.title}
            className="w-full h-full object-cover"
            style={{ filter: "brightness(0.85)" }}
          />
          {/* Gradient overlay so text below blends in */}
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(to bottom, transparent 40%, ${accent}20 100%)` }}
          />
        </div>
      )}

      <div className="relative flex items-center gap-3 px-4 py-3.5">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}20`, border: `1px solid ${accent}30` }}
        >
          {isPlatform
            ? <Megaphone className="w-4.5 h-4.5" style={{ color: accent }} />
            : <Star className="w-4.5 h-4.5" style={{ color: accent }} />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badge */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <Zap className="w-2.5 h-2.5 flex-shrink-0" style={{ color: accent }} />
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: accent }}>
              {badge}
            </span>
          </div>
          {/* Title */}
          <p className="text-sm font-semibold text-white leading-snug truncate">
            {promotion.title}
          </p>
          {/* Description */}
          {promotion.description && (
            <p className="text-xs text-zinc-400 truncate mt-0.5 leading-snug">
              {promotion.description}
            </p>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={handleCta}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg flex-shrink-0 transition-all duration-150 active:scale-95"
          style={{
            background:  `${accent}25`,
            border:      `1px solid ${accent}40`,
            color:       accent,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = `${accent}35`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = `${accent}25`;
          }}
        >
          {cta}
          <ArrowRight className="w-3 h-3" />
        </button>

        {/* Dismiss — platform promotions only */}
        {isPlatform && (
          <button
            onClick={() => setDismissed(true)}
            className="ml-1 flex-shrink-0 p-1 rounded-lg text-zinc-600 hover:text-zinc-400 hover:bg-white/5 transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Expiry indicator — subtle countdown bar if endsAt is set */}
      {promotion.endsAt && (() => {
        const remaining = new Date(promotion.endsAt).getTime() - Date.now();
        const total     = promotion.startsAt
          ? new Date(promotion.endsAt).getTime() - new Date(promotion.startsAt).getTime()
          : 7 * 24 * 60 * 60 * 1000;
        const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
        return (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
            <div
              className="h-full transition-all duration-1000"
              style={{ width: `${pct}%`, background: `${accent}60` }}
            />
          </div>
        );
      })()}
    </div>
  );
}

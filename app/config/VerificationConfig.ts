/**
 * VerificationConfig — single source of truth for all task verification thresholds.
 * DO NOT hardcode these values anywhere else in the codebase.
 *
 * Future: load from remote config / feature flags without code changes.
 */

export const VerificationConfig = {
  /** AI confidence ≥ this → auto-approve, reward credited immediately */
  AUTO_APPROVE_THRESHOLD: 85,

  /** AI confidence ≥ this (but < AUTO_APPROVE) → manual admin review queue */
  MANUAL_REVIEW_THRESHOLD: 70,

  /** Perceptual hash Hamming distance ≤ this → images are considered duplicates */
  PERCEPTUAL_HASH_SIMILARITY_THRESHOLD: 10,

  /** Max reference screenshots per task (advertiser uploads) */
  MAX_REFERENCE_SCREENSHOTS: 3,

  /** Max proof screenshot size in bytes (5 MB) */
  MAX_PROOF_SIZE_BYTES: 5 * 1024 * 1024,

  /** Screenshot retention period after task completion (days) */
  SCREENSHOT_RETENTION_DAYS: 60,

  /** Admin review items expire after this many days (if no decision made) */
  REVIEW_EXPIRY_DAYS: 7,

  /** Minimum time user must spend on task link (milliseconds) per category */
  MIN_TIME_MS: {
    telegram: 5000,
    twitter_x: 8000,
    youtube: 10000,
    facebook: 8000,
    instagram: 8000,
    tiktok: 8000,
    discord: 5000,
    website_visit: 10000,
    app_download_registration: 15000,
    crypto_web3: 8000,
    gaming: 10000,
    brand_promotion: 8000,
    product_campaign: 8000,
    service_promotion: 8000,
    lead_generation: 10000,
    ecommerce: 10000,
    event_promotion: 5000,
    surveys: 15000,
    referral: 5000,
    custom: 8000,
  } as Record<string, number>,

  /** Reward distribution percentages (sum < 100; platform keeps remainder) */
  REWARD_DISTRIBUTION: {
    free: 0.35,       // 35% to free user
    verified: 0.45,   // 45% to verified user
    vip: 0.65,        // 65% to VIP user
  },
} as const;

export type VerificationThresholds = typeof VerificationConfig;

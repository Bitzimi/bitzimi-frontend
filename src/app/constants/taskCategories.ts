/**
 * Task Category Definitions — Production Task Marketplace
 *
 * Structure:
 * - Top-level categories group related platforms/action types
 * - Each category has a svgIcon (inline SVG string) using the real brand color
 * - Sub-actions are instructions, NOT separate categories
 *
 * Used in: Tasks.tsx, CreateTaskModal.tsx, TaskModal.tsx, LandingPage task section
 */

export interface TaskCategory {
  id: string;
  label: string;
  group: "social" | "digital" | "business" | "advanced";
  /** Inline SVG path data — rendered as <svg> with viewBox="0 0 24 24" */
  svgIcon: string;
  /** Fill color for the icon */
  iconColor: string;
  /** Background color class for the icon container */
  iconBg: string;
  /** Common sub-actions shown as instructions hints */
  subActions?: string[];
  description: string;
}

export const TASK_CATEGORIES: TaskCategory[] = [
  // ── SOCIAL PLATFORMS ─────────────────────────────────────────────────────
  {
    id: "telegram",
    label: "Telegram",
    group: "social",
    svgIcon: `<path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>`,
    iconColor: "#26A5E4",
    iconBg: "bg-sky-100 dark:bg-sky-500/15",
    subActions: ["Join channel", "Join group", "Follow bot", "Subscribe"],
    description: "Join Telegram channels, groups, or bots",
  },
  {
    id: "twitter_x",
    label: "X (Twitter)",
    group: "social",
    svgIcon: `<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`,
    iconColor: "#000000",
    iconBg: "bg-gray-100 dark:bg-gray-700/40",
    subActions: ["Follow account", "Like post", "Repost / retweet", "Quote post", "Reply to post"],
    description: "Grow your X (Twitter) presence",
  },
  {
    id: "youtube",
    label: "YouTube",
    group: "social",
    svgIcon: `<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>`,
    iconColor: "#FF0000",
    iconBg: "bg-red-100 dark:bg-red-500/15",
    subActions: ["Subscribe to channel", "Like video", "Comment on video", "Watch video", "Share video"],
    description: "YouTube subscriptions, likes, and views",
  },
  {
    id: "facebook",
    label: "Facebook",
    group: "social",
    svgIcon: `<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>`,
    iconColor: "#1877F2",
    iconBg: "bg-blue-100 dark:bg-blue-500/15",
    subActions: ["Like page", "Follow page", "Share post", "Join group", "Comment"],
    description: "Facebook pages, groups, and posts",
  },
  {
    id: "instagram",
    label: "Instagram",
    group: "social",
    svgIcon: `<path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>`,
    iconColor: "#E1306C",
    iconBg: "bg-pink-100 dark:bg-pink-500/15",
    subActions: ["Follow account", "Like post", "Comment", "Story view", "Share reel"],
    description: "Instagram follows, likes, and engagement",
  },
  {
    id: "tiktok",
    label: "TikTok",
    group: "social",
    svgIcon: `<path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/>`,
    iconColor: "#010101",
    iconBg: "bg-gray-100 dark:bg-gray-700/40",
    subActions: ["Follow account", "Like video", "Comment", "Share video", "Watch video"],
    description: "TikTok follows, likes, and video engagement",
  },
  {
    id: "discord",
    label: "Discord",
    group: "social",
    svgIcon: `<path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.032.055a19.9 19.9 0 0 0 5.993 3.029.077.077 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.029.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>`,
    iconColor: "#5865F2",
    iconBg: "bg-indigo-100 dark:bg-indigo-500/15",
    subActions: ["Join server", "Verify in server", "Post in channel", "Boost server"],
    description: "Discord server joins and engagement",
  },

  // ── DIGITAL ACTIONS ───────────────────────────────────────────────────────
  {
    id: "website_visit",
    label: "Website Visit",
    group: "digital",
    svgIcon: `<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95c-.32-1.25-.78-2.45-1.38-3.56 1.84.63 3.37 1.9 4.33 3.56zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56-1.84-.63-3.37-1.9-4.33-3.56zm2.95-8H5.08c.96-1.66 2.49-2.93 4.33-3.56C8.81 5.55 8.35 6.75 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95c-.96 1.66-2.49 2.93-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z"/>`,
    iconColor: "#3B82F6",
    iconBg: "bg-blue-100 dark:bg-blue-500/15",
    subActions: ["Visit website", "Stay for minimum time", "Navigate to specific page", "Sign up"],
    description: "Website visits and engagement tasks",
  },
  {
    id: "app_download_registration",
    label: "Download App / Registration",
    group: "digital",
    svgIcon: `<path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-5-2l4-4h-3V8h-2v4H8l4 4z"/>`,
    iconColor: "#10B981",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    subActions: ["Download from App Store", "Download from Google Play", "Install and open", "Create account in app", "Complete profile", "Verify email"],
    description: "App downloads, installations, and new account registrations",
  },
  {
    id: "crypto_web3",
    label: "Crypto / Web3",
    group: "digital",
    svgIcon: `<path d="M13 7.83c.85.3 1.53.98 1.8 1.84L17 9l1 2-2.07.52c-.09.89-.56 1.68-1.27 2.19L15 16h-2l-.02-1.97c-.6-.17-1.12-.5-1.52-.95L9 14l-1-2 2.28-.63c.08-.81.49-1.53 1.09-2.03L11 7l2 .83zM12 1C5.93 1 1 5.93 1 12s4.93 11 11 11 11-4.93 11-11S18.07 1 12 1zm0 20c-4.97 0-9-4.03-9-9s4.03-9 9-9 9 4.03 9 9-4.03 9-9 9zm0-12c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>`,
    iconColor: "#F59E0B",
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    subActions: ["Connect wallet", "Follow on-chain", "Mint NFT", "Complete airdrop task", "DAO vote"],
    description: "Web3, DeFi, and crypto engagement tasks",
  },
  {
    id: "gaming",
    label: "Gaming",
    group: "digital",
    svgIcon: `<path d="M21 6H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-10 7H9v2H7v-2H5v-2h2V9h2v2h2v2zm4.5 2c-.83 0-1.5-.67-1.5-1.5S14.67 12 15.5 12s1.5.67 1.5 1.5S16.33 15 15.5 15zm3-3c-.83 0-1.5-.67-1.5-1.5S17.67 9 18.5 9s1.5.67 1.5 1.5S19.33 12 18.5 12z"/>`,
    iconColor: "#EC4899",
    iconBg: "bg-pink-100 dark:bg-pink-500/15",
    subActions: ["Install game", "Reach level", "Invite friends", "Complete achievement", "Join guild"],
    description: "Gaming milestones and in-game tasks",
  },

  // ── BUSINESS & MARKETING ─────────────────────────────────────────────────
  {
    id: "brand_promotion",
    label: "Brand Promotion",
    group: "business",
    svgIcon: `<path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.66 3.2-2.4zM4 9c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h1v4h2v-4h1l5 3V6L8 9H4zm11.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"/>`,
    iconColor: "#EF4444",
    iconBg: "bg-red-100 dark:bg-red-500/15",
    subActions: ["Post about brand", "Create content", "Share on social", "Write review"],
    description: "Promote brands and businesses online",
  },
  {
    id: "product_campaign",
    label: "Product Campaign",
    group: "business",
    svgIcon: `<path d="M21 6.5l-4-4-9 9-2 4.5L10.5 14l9-7.5zM6 18.5l1.5-3.5L9 16.5 6 18.5zm13-11l-1.5 1.5-1-1L18 6l1 1.5z"/>`,
    iconColor: "#F97316",
    iconBg: "bg-orange-100 dark:bg-orange-500/15",
    subActions: ["Create campaign post", "Publish advertisement", "Product unboxing", "Review product"],
    description: "Product launches and campaign tasks",
  },
  {
    id: "service_promotion",
    label: "Service Promotion",
    group: "business",
    svgIcon: `<path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z"/>`,
    iconColor: "#06B6D4",
    iconBg: "bg-cyan-100 dark:bg-cyan-500/15",
    subActions: ["Recommend service", "Write testimonial", "Share service link", "Create review"],
    description: "Promote services and service providers",
  },
  {
    id: "lead_generation",
    label: "Lead Generation",
    group: "business",
    svgIcon: `<path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>`,
    iconColor: "#0EA5E9",
    iconBg: "bg-sky-100 dark:bg-sky-500/15",
    subActions: ["Submit contact form", "Sign up for newsletter", "Complete KYC registration"],
    description: "Lead capture, sign-ups, and contact generation",
  },
  {
    id: "ecommerce",
    label: "E-commerce Promotion",
    group: "business",
    svgIcon: `<path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96C5 16.1 6.9 18 9 18h12v-2H9.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63H19c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>`,
    iconColor: "#7C3AED",
    iconBg: "bg-violet-100 dark:bg-violet-500/15",
    subActions: ["Visit store", "Add to wishlist", "Purchase product", "Leave review"],
    description: "E-commerce visits, purchases, and reviews",
  },
  {
    id: "event_promotion",
    label: "Event Promotion",
    group: "business",
    svgIcon: `<path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z"/>`,
    iconColor: "#D97706",
    iconBg: "bg-amber-100 dark:bg-amber-500/15",
    subActions: ["RSVP to event", "Share event", "Promote event", "Attend event"],
    description: "Event RSVPs, attendance, and promotion",
  },
  {
    id: "surveys",
    label: "Surveys",
    group: "business",
    svgIcon: `<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>`,
    iconColor: "#64748B",
    iconBg: "bg-slate-100 dark:bg-slate-500/15",
    subActions: ["Complete survey", "Answer questions", "Provide feedback", "Rate service"],
    description: "Surveys, questionnaires, and feedback tasks",
  },

  // ── ADVANCED ────────────────────────────────────────────────────────────────
  {
    id: "referral",
    label: "Referral System",
    group: "advanced",
    svgIcon: `<path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>`,
    iconColor: "#059669",
    iconBg: "bg-emerald-100 dark:bg-emerald-500/15",
    subActions: ["Refer and register", "Refer and deposit", "Refer and purchase"],
    description: "Referral campaigns with tracked conversions",
  },
  {
    id: "custom",
    label: "Custom Task",
    group: "advanced",
    svgIcon: `<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>`,
    iconColor: "#6366F1",
    iconBg: "bg-indigo-100 dark:bg-indigo-500/15",
    subActions: ["Define your own instructions"],
    description: "Custom tasks with specific instructions",
  },
];

export const CATEGORY_GROUPS = [
  { id: "social", label: "Social Platforms" },
  { id: "digital", label: "Digital Actions" },
  { id: "business", label: "Business & Marketing" },
  { id: "advanced", label: "Advanced" },
] as const;

/** Get category by ID */
export function getCategoryById(id: string): TaskCategory | undefined {
  return TASK_CATEGORIES.find(c => c.id === id);
}

/** Get category label for display */
export function getCategoryLabel(id: string): string {
  return getCategoryById(id)?.label ?? id;
}

/** Render category icon as React-compatible SVG element props */
export function getCategoryIconProps(categoryId: string) {
  const cat = getCategoryById(categoryId);
  return {
    svgPath: cat?.svgIcon ?? "",
    color: cat?.iconColor ?? "#6B7280",
    bg: cat?.iconBg ?? "bg-gray-100 dark:bg-gray-700",
  };
}

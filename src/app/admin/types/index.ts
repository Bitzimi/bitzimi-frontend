/**
 * Admin RBAC — Role and Permission types.
 *
 * Design principles:
 * - Roles group permissions for easy assignment.
 * - Permissions are fine-grained strings checked at the component level.
 * - Backend-ready: these fields arrive via JWT/session on the user object.
 *   When the backend is live, `identity.role` and `identity.permissions` will
 *   be populated from the decoded token — no rewrites needed.
 */

// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole =
  | "super_admin"    // Full platform access
  | "finance_admin"  // Financial operations only
  | "support_admin"  // User management, KYC
  | "moderator_admin"// Task + game moderation
  | "user";          // Regular platform user (no admin access)

// ─── Permissions ──────────────────────────────────────────────────────────────

export type Permission =
  // Dashboard
  | "admin.dashboard.view"
  // Users
  | "admin.users.view"
  | "admin.users.edit"
  | "admin.users.suspend"
  | "admin.users.override_limits"
  // KYC
  | "admin.kyc.view"
  | "admin.kyc.approve"
  | "admin.kyc.reject"
  // Financial
  | "admin.financial.view"
  | "admin.financial.process_withdrawals"
  | "admin.financial.confirm_deposits"
  | "admin.financial.transactions.view"
  // Tasks
  | "admin.tasks.view"
  | "admin.tasks.approve"
  | "admin.tasks.reject"
  | "admin.tasks.proofs.view"
  | "admin.tasks.proofs.approve"
  | "admin.tasks.proofs.reject"
  // Games
  | "admin.games.view"
  | "admin.games.moderate"
  | "admin.games.manage"
  // VIP
  | "admin.vip.view"
  | "admin.vip.manage"
  // Referrals & Affiliates
  | "admin.referrals.view"
  | "admin.affiliates.approve"
  | "admin.affiliates.reject"
  // Notifications
  | "admin.notifications.view"
  | "admin.notifications.broadcast"
  | "admin.notifications.manage"
  // Content Library (Phase 9)
  | "admin.content.view"
  | "admin.content.edit"
  // Static Pages (Phase 9)
  | "admin.pages.view"
  | "admin.pages.edit"
  // Platform Text (Phase 9)
  | "admin.text.view"
  | "admin.text.edit"
  // Analytics & Reports (Phase 10)
  | "admin.analytics.view"
  // Settings
  | "admin.settings.view"
  | "admin.settings.edit"
  // System Configuration (feature toggles, maintenance mode)
  | "admin.config.view"
  | "admin.config.edit"
  // Audit
  | "admin.audit.view"
  // Security (Phase 15)
  | "admin.security.view"
  | "admin.security.manage"
  // AI Developer Center (Phase 13)
  | "admin.developer.view"
  // Football AI Hub (Phase 16)
  | "admin.football.view"
  | "admin.football.manage"
  // Growth — Ambassador, Challenge, Points (Phase 20)
  | "admin.ambassadors.view"
  | "admin.ambassadors.manage"
  | "admin.referrals.manage"
  | "admin.challenges.view"
  | "admin.challenges.manage"
  // Featured Promotions (Phase 21)
  | "admin.promotions.view"
  | "admin.promotions.manage"
  | "admin.promotions.featured.approve"
  | "admin.promotions.revenue"
  // Auction Marketplace (Phase 22)
  | "admin.auction.view"
  | "admin.auction.manage"
  | "admin.auction.settings"
  | "admin.auction.statistics"
  // Admin Wallet Management (Phase 28)
  | "admin.wallets.view"
  | "admin.wallets.manage";

// ─── Nav Item ─────────────────────────────────────────────────────────────────

export interface AdminNavItem {
  id: string;
  label: string;
  path: string;
  icon: string;              // lucide icon name
  permission: Permission;
  badge?: number;            // notification count
  children?: AdminNavItem[];
  comingSoon?: boolean;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

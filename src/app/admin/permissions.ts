/**
 * Role → Permission mapping.
 *
 * Centralised here so that when the backend returns a role string,
 * we can immediately derive the full permission set client-side
 * for UI rendering (showing/hiding nav items, disabling buttons).
 *
 * The backend ALWAYS enforces permissions server-side — this is
 * purely a UI-layer convenience for progressive disclosure.
 */

import type { UserRole, Permission } from "./types/index";

// All permissions in the system — must mirror backend/src/utils/rolePermissions.ts exactly
const ALL_PERMISSIONS: Permission[] = [
  "admin.dashboard.view",
  "admin.users.view",
  "admin.users.edit",
  "admin.users.suspend",
  "admin.users.override_limits",
  "admin.kyc.view",
  "admin.kyc.approve",
  "admin.kyc.reject",
  "admin.financial.view",
  "admin.financial.process_withdrawals",
  "admin.financial.confirm_deposits",
  "admin.financial.transactions.view",
  "admin.tasks.view",
  "admin.tasks.approve",
  "admin.tasks.reject",
  "admin.tasks.proofs.view",
  "admin.tasks.proofs.approve",
  "admin.tasks.proofs.reject",
  "admin.games.view",
  "admin.games.moderate",
  "admin.games.manage",
  "admin.vip.view",
  "admin.vip.manage",
  "admin.referrals.view",
  "admin.affiliates.approve",
  "admin.affiliates.reject",
  "admin.notifications.view",
  "admin.notifications.broadcast",
  "admin.notifications.manage",
  "admin.content.view",
  "admin.content.edit",
  "admin.pages.view",
  "admin.pages.edit",
  "admin.text.view",
  "admin.text.edit",
  "admin.analytics.view",
  "admin.settings.view",
  "admin.settings.edit",
  "admin.config.view",
  "admin.config.edit",
  "admin.audit.view",
  "admin.security.view",
  "admin.security.manage",
  "admin.developer.view",
  "admin.football.view",
  "admin.football.manage",
  "admin.ai.view",
  "admin.ai.manage",
  // Growth — Phase 20
  "admin.ambassadors.view",
  "admin.ambassadors.manage",
  "admin.referrals.manage",
  "admin.challenges.view",
  "admin.challenges.manage",
  // Featured Promotions — Phase 21
  "admin.promotions.view",
  "admin.promotions.manage",
  "admin.promotions.featured.approve",
  "admin.promotions.revenue",
  // Auction Marketplace — Phase 22
  "admin.auction.view",
  "admin.auction.manage",
  "admin.auction.settings",
  "admin.auction.statistics",
  // Admin Wallet Management — Phase 28
  "admin.wallets.view",
  "admin.wallets.manage",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: ALL_PERMISSIONS,

  finance_admin: [
    "admin.dashboard.view",
    "admin.users.view",
    "admin.users.override_limits",
    "admin.financial.view",
    "admin.financial.process_withdrawals",
    "admin.financial.confirm_deposits",
    "admin.financial.transactions.view",
    "admin.games.view",
    "admin.games.manage",
    "admin.vip.view",
    "admin.config.view",
    "admin.audit.view",
    "admin.content.view",
    "admin.text.view",
    "admin.analytics.view",
    "admin.wallets.view",
    "admin.wallets.manage",
  ],

  support_admin: [
    "admin.dashboard.view",
    "admin.wallets.view",
    "admin.users.view",
    "admin.users.edit",
    "admin.users.suspend",
    "admin.kyc.view",
    "admin.kyc.approve",
    "admin.kyc.reject",
    "admin.tasks.view",
    "admin.tasks.proofs.view",
    "admin.referrals.view",
    "admin.ambassadors.view",
    "admin.challenges.view",
    "admin.promotions.view",
    "admin.auction.view",
    "admin.notifications.view",
    "admin.notifications.manage",
    "admin.content.view",
    "admin.content.edit",
    "admin.pages.view",
    "admin.pages.edit",
    "admin.text.view",
    "admin.text.edit",
    "admin.analytics.view",
    "admin.config.view",
    "admin.audit.view",
  ],

  moderator_admin: [
    "admin.dashboard.view",
    "admin.football.view",
    "admin.football.manage",
    "admin.ai.view",
    "admin.ai.manage",
    "admin.tasks.view",
    "admin.tasks.approve",
    "admin.tasks.reject",
    "admin.tasks.proofs.view",
    "admin.tasks.proofs.approve",
    "admin.tasks.proofs.reject",
    "admin.games.view",
    "admin.games.moderate",
    "admin.games.manage",
    "admin.referrals.view",
    "admin.notifications.view",
    "admin.promotions.view",
    "admin.auction.view",
    "admin.content.view",
    "admin.pages.view",
  ],

  // Regular users have no admin permissions
  user: [],
};

/**
 * Derive permissions from a role.
 * Used in buildIdentity() and the admin access hook.
 */
export function getPermissionsForRole(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Check if a permission set includes a specific permission.
 * Supports wildcard: "admin.*" grants all "admin." prefixed permissions.
 */
export function hasPermission(
  permissions: Permission[],
  required: Permission
): boolean {
  if (permissions.includes(required)) return true;
  // Check if super_admin has wildcard (future-proofing for backend tokens)
  const [namespace] = required.split(".");
  return (permissions as string[]).includes(`${namespace}.*`);
}

/**
 * Check if a user role qualifies as any admin role.
 */
export function isAdminRole(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role !== "user";
}

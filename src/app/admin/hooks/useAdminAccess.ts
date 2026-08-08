/**
 * useAdminAccess — derives admin access state from the platform identity.
 *
 * This hook never checks localStorage directly for admin status.
 * It reads from IdentityContext (the single source of truth) and
 * derives access using the permissions architecture.
 *
 * When the backend is live:
 *   identity.role and identity.permissions are populated from the JWT.
 *   This hook continues to work identically — zero rewrites.
 */

import { useIdentity } from "../../contexts/IdentityContext";
import { hasPermission, isAdminRole } from "../permissions";
import type { Permission } from "../types/index";

export interface AdminAccessState {
  /** True if the user has any admin role */
  isAdmin: boolean;
  /** The user's role (undefined for non-admin users) */
  role: string | undefined;
  /** Check a specific permission */
  can: (permission: Permission) => boolean;
  /** True if identity has fully loaded (userId is set) */
  isLoaded: boolean;
}

export function useAdminAccess(): AdminAccessState {
  const { identity } = useIdentity();

  const isLoaded = identity.userId !== "";
  const isAdmin = isAdminRole(identity.role);
  const permissions = identity.permissions ?? [];

  return {
    isAdmin,
    role: identity.role,
    isLoaded,
    can: (permission: Permission) => hasPermission(permissions, permission),
  };
}

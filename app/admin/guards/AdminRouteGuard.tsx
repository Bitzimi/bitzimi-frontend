/**
 * AdminRouteGuard — Protects admin routes using the platform identity.
 *
 * Flow:
 *   1. Wait for identity to load (userId must be set)
 *   2. If not authenticated → redirect to /login
 *   3. If authenticated but no admin role → render AccessDenied
 *   4. If admin but missing specific permission → render AccessDenied
 *   5. All checks pass → render children
 *
 * This guard never relies on hardcoded admin flags.
 * It reads exclusively from IdentityContext (single source of truth).
 */

import { Navigate } from "react-router";
import { useIdentity } from "../../contexts/IdentityContext";
import { useAdminAccess } from "../hooks/useAdminAccess";
import type { Permission } from "../types/index";
import AccessDenied from "../pages/AccessDenied";

interface AdminRouteGuardProps {
  children: React.ReactNode;
  /** Optional specific permission required to access this route */
  requiredPermission?: Permission;
}

export function AdminRouteGuard({ children, requiredPermission }: AdminRouteGuardProps) {
  const { identity } = useIdentity();
  const { isAdmin, isLoaded, can } = useAdminAccess();

  // Identity is still loading (polling interval hasn't fired yet)
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#09090b]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 text-sm">Verifying access…</p>
        </div>
      </div>
    );
  }

  // Not authenticated at all → go to login
  if (!identity.userId) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but no admin role
  if (!isAdmin) {
    return <AccessDenied reason="no_role" />;
  }

  // Has admin role but missing specific permission
  if (requiredPermission && !can(requiredPermission)) {
    return <AccessDenied reason="no_permission" permission={requiredPermission} />;
  }

  return <>{children}</>;
}

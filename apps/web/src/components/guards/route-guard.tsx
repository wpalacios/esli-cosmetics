"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import type { RoleKey } from "@esli-cosmetics/types/auth";
import { logger } from "@/lib/utils/logger";

type RouteGuardProps = {
  readonly children: React.ReactNode;
  readonly allowedRoles: readonly RoleKey[];
  readonly redirectTo?: string;
  /**
   * If true, RouteGuard will check session existence and redirect to login if missing.
   * If false (default), assumes authentication is already validated server-side and only checks roles.
   */
  readonly checkSession?: boolean;
};

/**
 * Client-side route guard for role-based access control.
 *
 * When used with server-side authentication (checkSession=false):
 * - Assumes authentication is already validated server-side
 * - Only checks if user has required roles
 * - Shows loading state if session is still loading
 *
 * When used standalone (checkSession=true):
 * - Checks both session existence and roles
 * - Redirects to login if no session
 * - Redirects to redirectTo if session exists but user lacks required roles
 */
export function RouteGuard({
  children,
  allowedRoles,
  redirectTo = "/dashboard",
  checkSession = false,
}: RouteGuardProps) {
  const { session, loading, hasRole } = useAuth();
  const router = useRouter();

  // Show loading state while session is loading
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent" />
          <p className="mt-4 text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // If checkSession is enabled, verify session exists
  if (checkSession && !session) {
    logger.authLog("RouteGuard: No session found, redirecting to login");
    router.replace("/login");
    return null;
  }

  // If session is null and we're not checking session, show loading
  // This shouldn't happen if server-side auth worked, but handle gracefully
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent" />
          <p className="mt-4 text-gray-600">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Debug: Log user roles and required roles
  const userRoles = session.roles.map(r => r.key);
  const currentPath =
    globalThis.window === undefined
      ? "unknown"
      : globalThis.window.location.pathname;
  logger.debug("RouteGuard: Checking access", {
    userRoles,
    allowedRoles: allowedRoles,
    path: currentPath,
    checkSession,
  });

  // Admin has access to everything
  if (hasRole("admin")) {
    logger.debug("RouteGuard: User is admin, allowing access");
    return children;
  }

  // Check if user has at least one of the allowed roles
  const hasAccess = allowedRoles.some(role => hasRole(role));

  if (!hasAccess) {
    // User has session but doesn't have required role
    logger.warn("RouteGuard: User does not have required role", {
      userRoles,
      requiredRoles: allowedRoles,
      redirectingTo: redirectTo,
    });

    // If checkSession is enabled, redirect to default page
    // Otherwise, show access denied message (server-side auth already validated)
    if (checkSession) {
      router.replace(redirectTo);
      return null;
    }

    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Acceso Denegado</h1>
          <p className="mt-2 text-gray-600">
            No tienes permisos para acceder a esta página.
          </p>
          {process.env.NODE_ENV === "development" && (
            <div className="mt-4 rounded bg-gray-100 p-4 text-left text-sm">
              <p>
                <strong>Roles del usuario:</strong>{" "}
                {userRoles.join(", ") || "Ninguno"}
              </p>
              <p>
                <strong>Roles requeridos:</strong> {allowedRoles.join(", ")}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  logger.debug("RouteGuard: User has required role, allowing access");
  return children;
}

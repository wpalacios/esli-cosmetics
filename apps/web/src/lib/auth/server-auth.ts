import {
  getCurrentUser,
  hasPermission as checkPermission,
  hasRole as checkRole,
  getRefreshTokenFromCookie,
  UserProfile,
} from "./session";

// Re-export for backwards compatibility
export type ServerUser = UserProfile;

/**
 * Get current user for server components.
 *
 * IMPORTANT: If token is expired but refresh_token exists, returns null
 * but does NOT redirect. This allows client-side RouteGuard to handle
 * token refresh before redirecting.
 *
 * Server components should check refresh_token before redirecting:
 * ```ts
 * const user = await getServerUser();
 * const refreshToken = await getRefreshTokenFromCookie();
 * if (!user && !refreshToken) {
 *   redirect('/login');
 * }
 * ```
 */
export async function getServerUser(): Promise<ServerUser | null> {
  return getCurrentUser();
}

/**
 * Check if user should be redirected to login.
 * Returns true only if both user is null AND no refresh token exists.
 *
 * This prevents redirecting when token is expired but can be refreshed.
 */
export async function shouldRedirectToLogin(): Promise<boolean> {
  const user = await getServerUser();
  if (user) {
    return false; // User exists, no redirect needed
  }

  // If no user but refresh token exists, don't redirect
  // Let client-side handle refresh
  const refreshToken = await getRefreshTokenFromCookie();
  return !refreshToken; // Only redirect if no refresh token
}

export async function hasPermission(permission: string): Promise<boolean> {
  return checkPermission(permission);
}

export async function hasRole(role: string): Promise<boolean> {
  return checkRole(role);
}

/**
 * Check if user has permission, but only after verifying authentication.
 *
 * This is a convenience function that ensures authentication is checked
 * before authorization, preventing premature redirects when tokens are expired
 * but refresh tokens exist.
 *
 * Usage:
 * ```ts
 * if (await shouldRedirectToLogin()) {
 *   redirect('/login');
 * }
 * const hasPerm = await hasPermission('resource.read');
 * if (!hasPerm) {
 *   redirect('/login');
 * }
 * ```
 *
 * Or use this helper:
 * ```ts
 * const hasPerm = await hasPermissionWithAuth('resource.read');
 * if (!hasPerm) {
 *   redirect('/login');
 * }
 * ```
 */
export async function hasPermissionWithAuth(
  permission: string
): Promise<boolean> {
  // First check authentication - if no user and no refresh token, return false
  if (await shouldRedirectToLogin()) {
    return false;
  }

  // Then check permission
  return checkPermission(permission);
}

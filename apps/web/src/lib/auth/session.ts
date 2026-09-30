import { cookies } from "next/headers";
import { logger } from "@/lib/utils/logger";

/**
 * JWT Payload interface matching backend structure
 */
interface JwtPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

/**
 * Decode JWT payload without verification (just to read userId).
 * This is safe because we only use it for quick checks - actual validation
 * happens on the backend when making API calls.
 *
 * @param token JWT token string
 * @returns Decoded payload or null if invalid
 */
function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    // Decode base64url payload (JWT uses base64url, not base64)
    const payload = parts[1];
    if (!payload) {
      return null;
    }
    // Replace URL-safe base64 characters
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf-8");

    return JSON.parse(decoded) as JwtPayload;
  } catch (error) {
    console.error("Error decoding JWT payload:", error);
    return null;
  }
}

/**
 * Check if a JWT token is expired.
 *
 * Best Practice: Check expiration with a small buffer (1 minute) to refresh
 * before actual expiration, but not too aggressively to avoid unnecessary refreshes.
 *
 * @param token JWT token string
 * @returns true if token is expired or invalid, false if valid and not expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return true; // Consider invalid tokens as expired
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = payload.exp * 1000;
  const now = Date.now();

  // Add 1 minute buffer to refresh before actual expiration
  // This prevents edge cases where token expires between check and use
  const bufferTime = 1 * 60 * 1000; // 1 minute

  return now >= expirationTime - bufferTime;
}

// No longer needed - all data comes from backend's HttpOnly cookies

/**
 * Get access token from backend's HttpOnly cookie.
 *
 * Best Practice: Backend (NestJS sets HttpOnly cookies directly.
 * Frontend should read from these cookies, not duplicate them in Iron Session.
 *
 * @returns Access token string or null if not found
 */
export async function getAccessTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    // Backend sets this cookie directly - single source of truth
    return cookieStore.get("access_token")?.value || null;
  } catch (error) {
    console.error("Error reading access token from cookie:", error);
    return null;
  }
}

/**
 * Get refresh token from backend's HttpOnly cookie.
 *
 * Best Practice: Backend (NestJS) sets HttpOnly cookies directly.
 * Frontend should read from these cookies, not duplicate them in Iron Session.
 *
 * @returns Refresh token string or null if not found
 */
export async function getRefreshTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    // Backend sets this cookie directly - single source of truth
    return cookieStore.get("refresh_token")?.value || null;
  } catch (error) {
    console.error("Error reading refresh token from cookie:", error);
    return null;
  }
}

/**
 * Get user roles from backend's HttpOnly cookie.
 *
 * Backend (NestJS) sets cookies with URL-encoded values, so we need to decode first.
 *
 * @returns Array of role strings
 */
export async function getRolesFromBackendCookie(): Promise<string[]> {
  try {
    const cookieStore = await cookies();
    const rolesCookie = cookieStore.get("user_roles")?.value;
    if (!rolesCookie) {
      return [];
    }

    // Backend sets cookies with URL-encoded values, so decode first
    const decoded = decodeURIComponent(rolesCookie);
    return JSON.parse(decoded);
  } catch (error) {
    console.error("Error reading roles from cookie:", error);
    return [];
  }
}

/**
 * Get user roles from backend's HttpOnly cookie.
 * This is the primary source - backend sets this cookie directly.
 */
export async function getRolesFromCookie(): Promise<string[]> {
  return getRolesFromBackendCookie();
}

/**
 * @deprecated Tokens should be managed by backend via HttpOnly cookies.
 * This function is kept for backwards compatibility but should not be used.
 * Backend sets tokens directly in HttpOnly cookies during login/refresh.
 */
export async function setAccessTokenInCookie(token: string): Promise<void> {
  // No-op: Backend manages tokens via HttpOnly cookies
  // This is kept for backwards compatibility but does nothing
  console.warn(
    "setAccessTokenInCookie() is deprecated. Backend manages tokens via HttpOnly cookies."
  );
}

/**
 * @deprecated Tokens should be managed by backend via HttpOnly cookies.
 * This function is kept for backwards compatibility but should not be used.
 */
export async function setRefreshTokenInCookie(token: string): Promise<void> {
  // No-op: Backend manages tokens via HttpOnly cookies
  console.warn(
    "setRefreshTokenInCookie() is deprecated. Backend manages tokens via HttpOnly cookies."
  );
}

/**
 * Get userId from JWT token.
 *
 * Best Practice: JWT already contains userId in 'sub' field.
 * No need for separate session storage - decode JWT directly.
 *
 * @returns User ID string or null if not found/invalid
 */
export async function getUserIdFromToken(): Promise<string | null> {
  const accessToken = await getAccessTokenFromCookie();
  if (!accessToken) {
    return null;
  }

  const payload = decodeJwtPayload(accessToken);
  return payload?.sub || null;
}

/**
 * @deprecated Use getUserIdFromToken() instead.
 * JWT already contains userId - no need for separate session storage.
 */
export async function getSession(): Promise<{ userId?: string }> {
  const userId = await getUserIdFromToken();
  return userId ? { userId } : {};
}

/**
 * Clear session - no-op since we don't store session data.
 *
 * Backend manages all authentication cookies (access_token, refresh_token, etc.)
 * These are cleared by calling the backend's logout endpoint.
 *
 * This function is kept for backwards compatibility.
 */
export async function clearSession(): Promise<void> {
  // No-op: Backend manages all cookies via logout endpoint
  // This is kept for backwards compatibility
  console.warn(
    "clearSession() is deprecated. Use backend logout endpoint to clear cookies."
  );
}

// User profile data fetched from backend
export interface UserProfile {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[] | Array<{ key: string; name: string }>;
  permissions: string[];
  person?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
  };
  employee?: {
    id: string;
    person?: {
      id: string;
      firstName: string;
      lastName?: string;
      phone?: string;
      email?: string;
    };
  };
}

// Helper function to get current user profile from backend
// Uses permissions and roles from cookies to avoid storing them in session
// Reads access token from HttpOnly cookie (set by backend)
//
// IMPORTANT: Server-side functions should NOT attempt token refresh.
// Token refresh must happen client-side via API routes that can set cookies.
// If token is expired, return null and let client-side handle refresh.
export async function getCurrentUser(): Promise<UserProfile | null> {
  try {
    const accessToken = await getAccessTokenFromCookie();

    // Check if access token is expired or missing
    const needsRefresh =
      !accessToken || (accessToken && isTokenExpired(accessToken));

    // If token is expired, return null immediately
    // Server-side refresh doesn't work because cookies can't be set in browser from server actions
    // Client-side AuthProvider will handle refresh via /api/auth/refresh
    if (needsRefresh) {
      logger.authLog(
        "Access token expired or missing - client will handle refresh"
      );
      return null;
    }

    // If no access token, return null
    if (!accessToken) {
      return null;
    }

    // If we have access token, try to get user data
    // Include cookies in the request so backend can read HttpOnly cookies if needed
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    // For web requests, use cookies only (backend prioritizes cookies)
    // Don't set Authorization header - let backend read from cookies
    // This ensures we use the new backend cookies, not old iron-session tokens
    let response: Response;
    try {
      response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/auth/me`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(cookieHeader && { Cookie: cookieHeader }),
          },
          cache: "no-store",
        }
      );
    } catch (fetchError) {
      // Handle network errors (backend unreachable, connection refused, etc.)
      // This is expected if backend is not running or not accessible
      logger.warn(
        "Backend unreachable when fetching user - returning null (backend may be down)",
        fetchError
      );
      return null;
    }

    if (!response.ok) {
      // Handle rate limit errors gracefully
      if (response.status === 429) {
        logger.warn(
          "Rate limit hit for /auth/me (429) - returning null to allow retry"
        );
        return null;
      }

      // If token is invalid (401), return null
      // Don't attempt server-side refresh - client-side will handle it
      // Server-side refresh can't set cookies in browser, so it's useless
      if (response.status === 401) {
        logger.authLog(
          "Access token invalid (401) - client will handle refresh"
        );
      } else {
        logger.warn("Failed to fetch current user:", response.status);
      }
      return null;
    }

    const userData = await response.json();

    // If userData doesn't have person directly, try to get it from employee
    if (!userData.person && userData.employee?.person) {
      userData.person = userData.employee.person;
    }

    // Get roles from backend's HttpOnly cookie, permissions come from backend response
    const roles = await getRolesFromBackendCookie();

    return {
      ...userData,
      permissions: userData.permissions || [],
      roles: roles.length > 0 ? roles : userData.roles || [],
    };
  } catch (error) {
    // Only log unexpected errors (not network errors, which are handled above)
    // Network errors are expected when backend is down and are already handled
    if (error instanceof TypeError && error.message.includes("fetch")) {
      // Network error already handled above, just return null
      return null;
    }
    logger.error("Unexpected error fetching current user:", error);
    return null;
  }
}

// In-memory cache for permission checks (5 minute TTL, aligned with backend cache)
// Key format: userId:permission
const permissionCache = new Map<
  string,
  { result: boolean; expiresAt: number }
>();
const PERMISSION_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedPermission(
  userId: string,
  permission: string
): boolean | null {
  const key = `${userId}:${permission}`;
  const cached = permissionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }
  if (cached) {
    permissionCache.delete(key);
  }
  return null;
}

function setCachedPermission(
  userId: string,
  permission: string,
  result: boolean
): void {
  const key = `${userId}:${permission}`;
  permissionCache.set(key, {
    result,
    expiresAt: Date.now() + PERMISSION_CACHE_TTL,
  });

  // Clean up expired entries when setting new ones (lazy cleanup)
  // This avoids needing setInterval which doesn't work well in serverless environments
  if (permissionCache.size > 100) {
    const now = Date.now();
    for (const [cacheKey, value] of permissionCache.entries()) {
      if (value.expiresAt < now) {
        permissionCache.delete(cacheKey);
      }
    }
  }
}

// Helper function to check if user has a specific permission
// First checks cached user profile, then falls back to API call
// Uses cookies for authentication (backend reads from cookies)
export async function hasPermission(permission: string): Promise<boolean> {
  try {
    const userId = await getUserIdFromToken();

    if (!userId) {
      logger.warn(`hasPermission(${permission}): No user ID available`);
      return false;
    }

    // Check in-memory cache first
    const cachedResult = getCachedPermission(userId, permission);
    if (cachedResult !== null) {
      return cachedResult;
    }

    // Try to get permissions from current user profile (uses backend cache)
    const user = await getCurrentUser();
    if (user && user.permissions) {
      const hasPerm = user.permissions.includes(permission);
      // Cache the result
      setCachedPermission(userId, permission, hasPerm);
      return hasPerm;
    }

    // Fallback: Make API call if user profile not available
    const accessToken = await getAccessTokenFromCookie();
    if (!accessToken) {
      logger.warn(`hasPermission(${permission}): No access token available`);
      return false;
    }

    // Include cookies in the request so backend can read HttpOnly cookies
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/v1/auth/check-permission`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
        body: JSON.stringify({ permission }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      logger.warn(
        `hasPermission(${permission}): API returned ${response.status}`
      );
      return false;
    }

    const data = await response.json();
    const result = data.hasPermission === true;

    // Cache the result
    setCachedPermission(userId, permission, result);
    return result;
  } catch (error) {
    logger.error("Error checking permission:", error);
    return false;
  }
}

// Helper function to check if user has a specific role
// Reads from HttpOnly cookie to avoid API calls and keep session cookie small
export async function hasRole(role: string): Promise<boolean> {
  const roles = await getRolesFromCookie();
  // Handle both string roles and role objects
  return roles.some(r => {
    if (typeof r === "string") {
      return r === role;
    }
    return (r as any).key === role;
  });
}

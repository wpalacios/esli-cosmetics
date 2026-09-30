"use server";

import {
  getCurrentUser,
  getAccessTokenFromCookie,
  getRefreshTokenFromCookie,
  isTokenExpired,
} from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface SessionData {
  user: {
    id: string;
    email: string;
    isActive: boolean;
    roles: string[];
    permissions: string[];
    person?: {
      id: string;
      firstName: string;
      lastName?: string;
      phone?: string;
      email?: string;
    };
  } | null;
}

export async function getSessionData(): Promise<SessionData> {
  try {
    // Get tokens from HttpOnly cookies (set by backend)
    // Check expiration FIRST before trying to decode userId
    // This prevents returning userId from expired tokens
    const accessToken = await getAccessTokenFromCookie();
    const refreshToken = await getRefreshTokenFromCookie();

    logger.debug("getSessionData: Token check", {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      accessTokenLength: accessToken?.length || 0,
    });

    // Check if access token is expired or missing
    const isExpired = accessToken ? isTokenExpired(accessToken) : true;
    const needsRefresh = !accessToken || isExpired;

    logger.debug("getSessionData: Expiration check", {
      isExpired,
      needsRefresh,
      hasRefreshToken: !!refreshToken,
    });

    // IMPORTANT: Server actions cannot set cookies that reach the browser.
    // If token is expired but we have a refresh token, return null to trigger
    // client-side refresh via API route (which can properly set cookies).
    if (needsRefresh) {
      if (refreshToken) {
        // Token expired but refresh token exists - client will handle refresh
        logger.authLog(
          "Access token expired - client will handle refresh via API route"
        );
        return { user: null };
      } else {
        // No tokens at all - user needs to login
        logger.authLog(
          "No access token and no refresh token - user needs to login"
        );
        return { user: null };
      }
    }

    // If no access token, return null
    if (!accessToken) {
      logger.warn("getSessionData: No access token found");
      return { user: null };
    }

    // Now that we know token is valid, get userId from it
    // This ensures we never return userId from expired tokens
    const { getUserIdFromToken } = await import("@/lib/auth/session");
    const userId = await getUserIdFromToken();

    logger.debug("getSessionData: UserId check", { userId });

    if (!userId) {
      logger.warn("getSessionData: No userId found in token");
      return { user: null };
    }

    // Fetch user data from backend using access token
    logger.debug("getSessionData: Fetching user from backend...");
    const user = await getCurrentUser();

    logger.debug("getSessionData: User fetch result", {
      hasUser: !!user,
      userId: user?.id,
      email: user?.email,
      rolesCount: user?.roles?.length || 0,
    });

    if (!user) {
      logger.warn("getSessionData: Failed to fetch user from backend");
      return { user: null };
    }

    // Get person data - prefer direct person, fallback to employee.person
    const person = user.person || user.employee?.person;

    // Normalize roles to string array
    let roles: string[];
    if (Array.isArray(user.roles) && user.roles.length > 0) {
      if (typeof user.roles[0] === "string") {
        roles = user.roles as string[];
      } else {
        roles = (user.roles as Array<{ key: string; name: string }>).map(
          r => r.key
        );
      }
    } else {
      roles = [];
    }

    // Return session data
    const userData: SessionData["user"] = {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      roles,
      permissions: user.permissions,
    };

    if (person) {
      userData.person = {
        id: person.id,
        firstName: person.firstName,
        ...(person.lastName !== undefined &&
          person.lastName !== null && { lastName: person.lastName }),
        ...(person.phone !== undefined &&
          person.phone !== null && { phone: person.phone }),
        ...(person.email !== undefined &&
          person.email !== null && { email: person.email }),
      };
    }

    return {
      user: userData,
    };
  } catch (error) {
    logger.error("Session action error:", error);
    return { user: null };
  }
}

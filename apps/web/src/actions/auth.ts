"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import { clearSession } from "@/lib/auth/session";
import { LocationInfo } from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export interface UserProfile {
  id: string;
  email: string;
  isActive: boolean;
  roles?: string[];
  permissions?: string[];
  employee?: {
    id: string;
    person?: {
      id: string;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    /** Assigned work location (API may omit top-level `location` and only send this). */
    location?: LocationInfo & {
      branch?: { id: string; name: string; code?: string };
    };
  };
  branch?: {
    id: string;
    name: string;
    code?: string;
  };
  location?: LocationInfo;
}

export async function getCurrentUser(): Promise<UserProfile | null> {
  try {

    const userProfile: UserProfile = await apiClient.post("/auth/me");

    if (!userProfile?.id) {
      console.warn(
        "❌ Server Action - Invalid response format: missing required fields"
      );
      return null;
    }


    return userProfile;
  } catch (error: any) {
    // Handle rate limit errors gracefully - return null instead of throwing
    // This allows the client to retry or use cached data
    if (error?.status === 429) {
      console.warn(
        "⚠️ Server Action - Rate limit hit for /auth/me, returning null to allow retry"
      );
      return null;
    }

    // For other errors, log and return null instead of throwing
    // This prevents the entire page from crashing due to auth errors
    console.error("❌ Server Action - Error fetching user profile:", error);
    return null;
  }
}

/**
 * Server Action to safely clear the session.
 * This can only be called from Server Actions or Route Handlers.
 */
export async function logout(): Promise<void> {
  try {
    await clearSession();
  } catch (error) {
    console.error("❌ Server Action - Error clearing session:", error);
    // Don't throw - session clearing might fail in some contexts
    // but we still want to proceed with logout
  }
}

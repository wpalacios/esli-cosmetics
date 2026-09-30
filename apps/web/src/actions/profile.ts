"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import { getUserIdFromToken } from "@/lib/auth/session";
import { UpdateUserRequest, UserWithRelations } from "@esli-cosmetics/types";
import {
  SessionExpiredError,
  isSessionExpiredError,
} from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();

/**
 * Get the current user's profile
 */
export async function getCurrentUserProfile(): Promise<UserWithRelations> {
  try {
    // Get userId from JWT token (no need for separate session storage)
    const userId = await getUserIdFromToken();

    if (!userId) {
      throw new Error("User not authenticated");
    }

    const response = await apiClient.get(`/profile`);

    // Transform the response to match UserWithRelations type
    const profile: UserWithRelations = {
      id: response.id,
      email: response.email,
      isActive: response.isActive,
      createdAt: response.createdAt,
      updatedAt: response.createdAt, // Backend doesn't return updatedAt, use createdAt
      isDeleted: false,
      deletedAt: null,
      lastLoginAt: response.lastLoginAt || null,
      roles: response.roles || [],
      permissions: response.permissions || [],
      person: response.person,
    };

    return profile;
  } catch (error) {
    console.error("❌ Server Action - Failed to fetch user profile:", error);

    // Handle session expiration
    if (isSessionExpiredError(error)) {
      throw error;
    }

    // Provide more specific error messages
    if (error instanceof Error) {
      // Check for connection errors
      if (
        error.message.includes("fetch failed") ||
        error.message.includes("ECONNREFUSED") ||
        (error as any).cause?.code === "ECONNREFUSED"
      ) {
        throw new Error(
          "Unable to connect to the server. Please check if the backend is running."
        );
      }

      // Preserve original error message if it's informative
      if (error.message.includes("not authenticated")) {
        throw error;
      }
    }

    throw new Error("Failed to fetch user profile");
  }
}

/**
 * Update the current user's profile
 */
export async function updateCurrentUserProfile(
  data: UpdateUserRequest
): Promise<UserWithRelations> {
  try {
    // Get userId from JWT token (no need for separate session storage)
    const userId = await getUserIdFromToken();

    if (!userId) {
      throw new Error("User not authenticated");
    }


    // Prepare the payload - only include fields that are provided
    const payload: Partial<UpdateUserRequest> = {};
    if (data.email !== undefined) payload.email = data.email;
    if (data.firstName !== undefined) payload.firstName = data.firstName;
    if (data.lastName !== undefined) payload.lastName = data.lastName;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.password !== undefined && data.password.trim() !== "") {
      payload.password = data.password;
    }

    const response = await apiClient.patch(`/profile`, payload);

    // Transform the response to match UserWithRelations type
    const profile: UserWithRelations = {
      id: response.id,
      email: response.email,
      isActive: response.isActive,
      createdAt: response.createdAt,
      updatedAt: response.createdAt, // Backend doesn't return updatedAt, use createdAt
      isDeleted: false,
      deletedAt: null,
      lastLoginAt: response.lastLoginAt || null,
      roles: response.roles || [],
      permissions: response.permissions || [],
      person: response.person,
    };

    return profile;
  } catch (error) {
    console.error("❌ Server Action - Failed to update user profile:", error);

    // Handle session expiration
    if (isSessionExpiredError(error)) {
      throw error;
    }

    // Re-throw the error with its original message
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to update user profile");
  }
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
} from "@/actions/profile";
import { ProfileForm } from "@/components/forms/profile-form";
import { UserWithRelations, UpdateUserRequest } from "@esli-cosmetics/types";
import { useToast } from "@/hooks/toast/use-toast";
import { useAuth } from "@/lib/auth/auth-provider";
import { Card, Button } from "@esli-cosmetics/ui";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";
import { useRouter } from "next/navigation";

export function ProfilePageClient() {
  const { t } = useTranslation("profile");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { refresh: refreshAuth } = useAuth();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    data: user,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["current-user-profile"],
    queryFn: async () => {
      try {
        const profile = await getCurrentUserProfile();
        // Ensure we never return undefined
        if (!profile) {
          throw new Error("Failed to fetch user profile: no data returned");
        }
        return profile;
      } catch (error) {
        // Ensure we always throw, never return undefined
        if (error instanceof Error) {
          throw error;
        }
        throw new Error("Failed to fetch user profile");
      }
    },
    enabled: isClient,
    retry: (failureCount, error) => {
      // Don't retry on session expiration
      if (isSessionExpiredError(error)) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 0,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: UpdateUserRequest) => updateCurrentUserProfile(data),
    onSuccess: async updatedUser => {
      // Update the query cache with the new data
      await queryClient.setQueryData(["current-user-profile"], updatedUser);
      await queryClient.invalidateQueries({
        queryKey: ["current-user-profile"],
      });

      // Refresh auth to update user info in auth context
      await refreshAuth();

      toast({
        title: t("toast.success") || "Success",
        description:
          t("toast.profileUpdated") || "Profile updated successfully",
        type: "success",
      });
    },
    onError: (error: unknown) => {
      console.error("Profile update error:", error);

      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "An unknown error occurred";

      // Handle session expiration
      if (isSessionExpiredError(error)) {
        toast({
          title: t("toast.error") || "Error",
          description: errorMessage || "Session expired. Please log in again.",
          type: "error",
        });
        // Redirect to login after a short delay
        setTimeout(() => {
          router.push("/login");
        }, 2000);
        return;
      }

      toast({
        title: t("toast.error") || "Error",
        description:
          errorMessage || t("toast.updateFailed") || "Failed to update profile",
        type: "error",
      });
    },
  });

  const handleSave = useCallback(
    async (data: UpdateUserRequest) => {
      await updateProfileMutation.mutateAsync(data);
    },
    [updateProfileMutation]
  );

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  // Don't render anything until client-side hydration
  if (!isClient) {
    return null;
  }

  // Loading state
  if (isLoading || isRefetching) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="mb-2 h-8 w-64 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-96 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <Card className="p-6">
          <div className="space-y-4">
            <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !user) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : t("page.errorLoading") || "Failed to load profile";

    // Check if it's a connection error
    const isConnectionError =
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("Unable to connect");

    // Check if it's a session error
    const isSessionError = isSessionExpiredError(error);

    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("page.title") || "Profile"}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t("page.subtitle") || "Manage your profile information"}
            </p>
          </div>
        </div>
        <Card className="p-6">
          <div className="py-8 text-center">
            <div className="mb-4 text-red-600 dark:text-red-400">
              {isSessionError
                ? t("page.errorSession") ||
                  "Your session has expired. Please log in again."
                : isConnectionError
                  ? t("page.errorConnection") ||
                    "Unable to connect to the server. Please check if the backend is running."
                  : errorMessage}
            </div>
            {!isSessionError && (
              <Button
                onClick={handleRetry}
                variant="outline"
                type="button"
                disabled={isRefetching}
              >
                {isRefetching
                  ? t("page.retrying") || "Retrying..."
                  : t("page.retry") || "Retry"}
              </Button>
            )}
            {isSessionError && (
              <Button
                onClick={() => router.push("/login")}
                variant="primary"
                type="button"
              >
                {t("page.goToLogin") || "Go to Login"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Success state - show the form
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.title") || "Profile"}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitle") || "Manage your profile information"}
          </p>
        </div>
      </div>

      <ProfileForm
        user={user}
        onSave={handleSave}
        isLoading={updateProfileMutation.isPending}
      />
    </div>
  );
}

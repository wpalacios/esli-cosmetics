"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type {
  AuthSession,
  AuthContextType,
  LoginCredentials,
  RegisterData,
} from "@esli-cosmetics/types/auth";
import { apiClient } from "@esli-cosmetics/utils/api/client";
import { useToast } from "@/hooks/toast/use-toast";
import { getSessionData } from "@/actions/session";
import { logger } from "@/lib/utils/logger";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [loading, setLoading] = useState(true);
  const [hasCompletedInitialLoad, setHasCompletedInitialLoad] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const router = useRouter();
  const refreshAttemptedRef = useRef(false);

  // Query for current session using server action
  const {
    data: session,
    isLoading,
    isPending,
    isFetching,
    isError,
    status,
  } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async (): Promise<AuthSession | null> => {
      try {
        const sessionData = await getSessionData();

        // If session is null, check if we should attempt refresh
        // getSessionData() returns { user: null } if:
        // 1. Token expired but refresh token exists (client should refresh)
        // 2. No tokens at all (user needs to login)
        if (!sessionData?.user) {
          // Only attempt refresh once per query cycle to avoid infinite loops
          if (!refreshAttemptedRef.current) {
            refreshAttemptedRef.current = true;

            try {
              logger.authLog(
                "Session data is null, attempting token refresh..."
              );
              const refreshResponse = await fetch("/api/auth/refresh", {
                method: "POST",
                credentials: "include",
                cache: "no-store",
              });

              if (refreshResponse.ok) {
                // Refresh succeeded - cookies are now set by the API route
                // Invalidate query to trigger refetch with new cookies
                // Use setTimeout to avoid calling invalidateQueries during query execution
                logger.authLog("Token refresh succeeded, will refetch session");
                setTimeout(() => {
                  queryClient.invalidateQueries({ queryKey: ["auth-session"] });
                }, 0);
                // Return null - the refetch will get the new session data
                return null;
              } else {
                // Refresh failed - refresh token is invalid or expired
                logger.authLog(
                  "Token refresh failed - user needs to login again"
                );
                return null;
              }
            } catch (refreshError) {
              logger.error("Client-side refresh error:", refreshError);
              return null;
            }
          }

          // If refresh was already attempted, return null
          return null;
        }

        // Transform session data to AuthSession format
        const authSession: AuthSession = {
          user: {
            id: sessionData.user.id,
            email: sessionData.user.email,
            isActive: sessionData.user.isActive,
            isDeleted: false,
            createdAt: "",
            lastLoginAt: null,
            deletedAt: null,
          },
          roles: (sessionData.user.roles || []).map((role: string) => ({
            key: role,
            id: "",
            name: role,
            description: null,
            isDeleted: false,
            createdAt: "",
            updatedAt: "",
            deletedAt: null,
          })),
          permissions: (sessionData.user.permissions || []).map(
            (permission: string) => ({
              key: permission,
              id: "",
              name: permission,
              description: null,
              isDeleted: false,
              createdAt: "",
              updatedAt: "",
              deletedAt: null,
            })
          ),
          ...(sessionData.user.person && {
            person: {
              id: sessionData.user.person.id,
              firstName: sessionData.user.person.firstName,
              lastName: sessionData.user.person.lastName || null,
              phone: sessionData.user.person.phone || null,
              email: sessionData.user.person.email || null,
              docType: null,
              docNumber: null,
              metadata: {},
              createdAt: "",
              updatedAt: "",
              isDeleted: false,
              deletedAt: null,
            },
          }),
        };

        return authSession;
      } catch (error) {
        logger.error("Error fetching session:", error);
        return null;
      }
    },
    retry: (failureCount, error: any) => {
      // Only retry once for rate limit errors
      if (failureCount < 1 && error?.message?.includes("429")) {
        return true;
      }
      return false;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 5000),
    placeholderData: null,
    refetchOnMount: "always",
    staleTime: 30 * 1000, // Cache for 30 seconds
    gcTime: 60 * 1000, // Keep in cache for 1 minute
  });

  // Manage loading state based on query status
  useEffect(() => {
    // Mark initial load as complete once query finishes (success or error)
    if ((!isPending || isError) && !hasCompletedInitialLoad) {
      setHasCompletedInitialLoad(true);
    }

    // Loading is true if:
    // 1. Query is still pending (waiting for first fetch)
    // 2. OR query is fetching AND initial load hasn't completed
    // Stop loading immediately on error to prevent infinite loading
    const isStillLoading =
      (isPending || (!hasCompletedInitialLoad && isFetching)) && !isError;
    setLoading(isStillLoading);

    logger.debug("AuthProvider loading state", {
      status,
      isPending,
      isFetching,
      isError,
      hasCompletedInitialLoad,
      isStillLoading,
      hasSession: !!session,
    });
  }, [
    status,
    isPending,
    isFetching,
    isError,
    hasCompletedInitialLoad,
    session,
  ]);

  // Timeout fallback: prevent infinite loading states
  useEffect(() => {
    if (loading && !hasCompletedInitialLoad) {
      const timeout = setTimeout(() => {
        logger.warn(
          "AuthProvider: Loading timeout - forcing initial load to complete"
        );
        setHasCompletedInitialLoad(true);
        setLoading(false);
      }, 10000); // 10 second timeout

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [loading, hasCompletedInitialLoad]);

  // Sign in mutation (redirects to login page)
  const signInMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<AuthSession> => {
      // Redirect to login page - the actual login is handled by server action
      router.push("/login");
      throw new Error("Redirecting to login");
    },
    onSuccess: () => {
      toast({
        type: "success",
        title: "Bienvenido",
        description: "Has iniciado sesión exitosamente.",
      });
    },
    onError: (error: Error) => {
      if (error.message !== "Redirecting to login") {
        toast({
          type: "error",
          title: "Error al iniciar sesión",
          description: error.message,
        });
      }
    },
  });

  // Sign up mutation
  const signUpMutation = useMutation({
    mutationFn: async (data: RegisterData): Promise<AuthSession> => {
      const response = await apiClient.post("/auth/register", {
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
      });

      // After successful registration, redirect to login
      router.push("/login");
      throw new Error("Registration successful, please login");
    },
    onSuccess: () => {
      toast({
        type: "success",
        title: "Cuenta creada",
        description: "Tu cuenta ha sido creada exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        type: "error",
        title: "Error al crear cuenta",
        description: error.message,
      });
    },
  });

  // Sign out mutation
  const signOutMutation = useMutation({
    mutationFn: async () => {
      try {
        // Call logout API to clear all cookies (backend + legacy)
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch (error) {
        // Continue with logout even if API call fails
        logger.error("Error calling logout API:", error);
      }

      // Clear client state and redirect to login
      queryClient.clear();
      router.push("/login");
    },
    onSuccess: () => {
      toast({
        type: "success",
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        type: "error",
        title: "Error al cerrar sesión",
        description: error.message,
      });
    },
  });

  // Helper functions
  const hasPermission = async (permission: string): Promise<boolean> => {
    return session?.permissions.some(p => p.key === permission) ?? false;
  };

  const hasRole = (role: string): boolean => {
    return session?.roles.some(r => r.key === role) ?? false;
  };

  const refresh = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["auth-session"] });
  };

  const contextValue: AuthContextType = {
    session: session ?? null,
    loading,
    signIn: signInMutation.mutateAsync,
    signUp: signUpMutation.mutateAsync,
    signOut: signOutMutation.mutateAsync,
    resetPassword: async () => {
      throw new Error("Not implemented");
    },
    changePassword: async () => {
      throw new Error("Not implemented");
    },
    hasPermission,
    hasRole,
    refresh,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children as any}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

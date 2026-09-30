"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  AuthSession,
  AuthContextType,
  LoginCredentials,
  RegisterData,
} from "@esli-cosmetics/types/auth";
import { apiClient } from "@esli-cosmetics/utils/api/client";
import { useToast } from "@/hooks/toast/use-toast";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthProviderProps = {
  children: React.ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Helper to get tokens from HttpOnly cookies (handled by server)
  const getStoredTokens = () => {
    // With HttpOnly cookies, we can't access tokens from client-side
    // The server will handle authentication via cookies
    return { accessToken: null, refreshToken: null, rememberMe: false };
  };

  // Query for current session with optimized caching
  // Cache for 5 minutes to reduce redundant API calls
  // Backend also caches user profiles for 5 minutes, so this aligns well
  const { data: session, isLoading } = useQuery({
    queryKey: ["auth-session"],
    queryFn: async (): Promise<AuthSession | null> => {
      try {
        // With HttpOnly cookies, we make a request to get current user data
        // The server will automatically use the HttpOnly cookie for authentication
        const userData = await apiClient.get("/auth/me");

        return {
          user: {
            id: userData.id,
            email: userData.email,
            isActive: userData.isActive,
            isDeleted: false,
            createdAt: "",
            lastLoginAt: null,
            deletedAt: null,
          },
          roles: userData.roles || [],
          permissions: userData.permissions || [],
          employee: userData.employee,
          customer: userData.customer,
          person: userData.person,
        };
      } catch (error) {
        console.error("Error fetching session:", error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus to reduce requests
    refetchOnMount: false, // Don't refetch on mount if data is fresh
    retry: false,
  });

  useEffect(() => {
    setLoading(isLoading);
  }, [isLoading]);

  // Sign in mutation
  const signInMutation = useMutation({
    mutationFn: async (credentials: LoginCredentials): Promise<AuthSession> => {
      const response = await apiClient.post("/auth/login", {
        email: credentials.email,
        password: credentials.password,
      });

      const { user, roles, permissions } = response;

      // With HttpOnly cookies, tokens are automatically set by the server
      // No need to manually store or set tokens

      const authSession: AuthSession = {
        user: {
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          isDeleted: false,
          createdAt: "",
          lastLoginAt: null,
          deletedAt: null,
        },
        roles: roles || [],
        permissions: permissions || [],
        employee: user.employee,
        customer: user.customer,
        person: user.person,
      };

      // Invalidate and refetch session
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] });

      return authSession;
    },
    onSuccess: () => {
      toast({
        type: "success",
        title: "Bienvenido",
        description: "Has iniciado sesión exitosamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        type: "error",
        title: "Error al iniciar sesión",
        description: error.message,
      });
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

      const { user, roles, permissions } = response;

      // With HttpOnly cookies, tokens are automatically set by the server
      // No need to manually store or set tokens

      const authSession: AuthSession = {
        user: {
          id: user.id,
          email: user.email,
          isActive: user.isActive,
          isDeleted: false,
          createdAt: "",
          lastLoginAt: null,
          deletedAt: null,
        },
        roles: roles || [],
        permissions: permissions || [],
        employee: user.employee,
        customer: user.customer,
        person: user.person,
      };

      await queryClient.invalidateQueries({ queryKey: ["auth-session"] });

      return authSession;
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
        await apiClient.post("/auth/logout");
      } catch (error) {
        // Continue with logout even if API call fails
        console.error("Error calling logout API:", error);
      }

      // With HttpOnly cookies, we can't clear them from client-side
      // The server should handle clearing the cookies
      // We just need to clear the client-side state
    },
    onSuccess: () => {
      queryClient.clear();
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

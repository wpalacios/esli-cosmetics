import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/actions/auth";

// Query keys for auth
export const authKeys = {
  all: ["auth"] as const,
  profile: () => [...authKeys.all, "profile"] as const,
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: authKeys.profile(),
    queryFn: async () => {
      const user = await getCurrentUser();
      // If null is returned (e.g., due to rate limit), throw to trigger retry
      // But only retry once to avoid infinite loops
      if (user === null) {
        throw new Error("User not available");
      }
      return user;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - user profile doesn't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error) => {
      // Only retry once for rate limit errors, don't retry for other errors
      if (failureCount < 1) {
        return true;
      }
      return false;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    refetchOnMount: false, // Don't refetch if data exists
    refetchOnWindowFocus: false, // Don't refetch on window focus
  });
};

export function useHasRole(role: string): boolean {
  const { data: user } = useCurrentUser();
  return Array.isArray(user?.roles) && user.roles.includes(role);
}

import { useQuery } from "@tanstack/react-query";
import { LocationsResponse } from "@/actions/locations";

// Query keys for locations
export const locationKeys = {
  all: ["locations"] as const,
  lists: () => [...locationKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...locationKeys.lists(), params] as const,
};

export const useLocations = (params?: { page?: number; limit?: number }) => {
  return useQuery({
    queryKey: locationKeys.list(params || {}),
    queryFn: async (): Promise<LocationsResponse> => {
      try {
        const page = params?.page || 1;
        const limit = params?.limit || 100;
        const response = await fetch(
          `/api/locations?page=${page}&limit=${limit}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch locations");
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error("Error fetching locations:", error);
        // Return empty data structure on error
        return {
          locations: [],
          page: params?.page || 1,
          limit: params?.limit || 100,
          total: 0,
          totalPages: 0,
        };
      }
    },
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnMount: false, // Use cached data if available
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  });
};

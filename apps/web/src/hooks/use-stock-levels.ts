import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  StockLevelWithRelations,
  CreateStockLevelRequest,
  UpdateStockLevelRequest,
  StockLevelsResponse,
} from "@esli-cosmetics/types";
import {
  getStockLevels,
  searchStockLevels,
  getStockLevelById,
  createStockLevel,
  updateStockLevel,
  deleteStockLevel,
  getStockLevelsByProductVariant,
  getStockLevelByLocationAndProduct,
  getKitStockLevelsByLocation,
  type StockLevelFilters,
} from "@/actions";
import type { POSKitItem } from "@esli-cosmetics/types";
import { useMemo } from "react";

// Query keys for stock levels
export const stockLevelKeys = {
  all: ["stock-levels"] as const,
  lists: () => [...stockLevelKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...stockLevelKeys.lists(), params] as const,
  details: () => [...stockLevelKeys.all, "detail"] as const,
  detail: (id: string) => [...stockLevelKeys.details(), id] as const,
};

export const useStockLevels = (params?: {
  page?: number;
  limit?: number;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  enabled?: boolean;
  filters?: StockLevelFilters;
}) => {
  const queryOptions: any = {
    queryKey: stockLevelKeys.list({
      page: params?.page,
      limit: params?.limit,
      filters: params?.filters,
    }),
    queryFn: () => getStockLevels(params?.page, params?.limit, params?.filters),
    staleTime: 0,
    refetchOnWindowFocus: params?.refetchOnWindowFocus ?? true,
    enabled: params?.enabled !== undefined ? params.enabled : true,
  };

  if (params?.refetchInterval !== undefined) {
    queryOptions.refetchInterval = params.refetchInterval;
  }

  return useQuery(queryOptions);
};

export const useSearchStockLevels = (
  search: string,
  page: number = 1,
  limit: number = 10,
  filters?: StockLevelFilters
) => {
  return useQuery<StockLevelsResponse>({
    queryKey: ["stock-levels-search", search, page, limit, filters || {}],
    queryFn: async () => {
      if (!search || search.trim() === "") {
        return { stockLevels: [], total: 0, page, limit, totalPages: 0 };
      }
      return searchStockLevels(search, page, limit, filters);
    },
    enabled: !!search && search.trim().length > 0,
    placeholderData: prev => prev,
    staleTime: 0,
  });
};

export const useStockLevel = (id: string) => {
  return useQuery({
    queryKey: stockLevelKeys.detail(id),
    queryFn: () => getStockLevelById(id),
    enabled: !!id,
  });
};

export const useCreateStockLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStockLevelRequest) => createStockLevel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockLevelKeys.lists() });
    },
  });
};

export const useUpdateStockLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStockLevelRequest }) =>
      updateStockLevel(id, data),
    onSuccess: updatedStockLevel => {
      queryClient.setQueryData(
        stockLevelKeys.detail(updatedStockLevel.id),
        updatedStockLevel
      );
      queryClient.invalidateQueries({ queryKey: stockLevelKeys.lists() });
    },
  });
};

export const useDeleteStockLevel = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteStockLevel(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: stockLevelKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: stockLevelKeys.all });
    },
  });
};

export const useStockLevelsByProductVariant = (
  productVariantId: string | null
) => {
  return useQuery({
    queryKey: ["stock-levels", "by-product-variant", productVariantId],
    queryFn: () => getStockLevelsByProductVariant(productVariantId!),
    enabled: !!productVariantId,
    staleTime: 0,
  });
};

export const useStockLevelByLocationAndProduct = (
  locationId: string | null | undefined,
  productVariantId?: string | null,
  productId?: string | null
) => {
  return useQuery({
    queryKey: [
      "stock-level",
      "by-location-and-product",
      locationId,
      productVariantId,
      productId,
    ],
    queryFn: () =>
      getStockLevelByLocationAndProduct(
        locationId!,
        productVariantId || undefined,
        productId || undefined
      ),
    enabled: !!locationId && (!!productVariantId || !!productId),
    staleTime: 30000,
    refetchOnWindowFocus: true,
    retry: false,
  });
};

//  hook to get kit availability by location
export const useKitStockByLocation = (
  kitVariantId: string | null,
  enabled: boolean = true
) => {
  const kitVariantIds = kitVariantId ? [kitVariantId] : [];

  const { data: rawAvailability = [], isLoading } = useQuery({
    queryKey: ["stock-levels", "kit-availability-batch", kitVariantIds],
    queryFn: () => getKitStockLevelsByLocation(kitVariantIds),
    enabled: enabled && kitVariantIds.length > 0,
    staleTime: 1000 * 60,
  });

  const kitsPerLocation = useMemo(() => {
    if (isLoading || rawAvailability.length === 0 || !kitVariantId) return [];

    return rawAvailability
      .filter(row => row.kitVariantId === kitVariantId)
      .map(loc => ({
        locationId: loc.locationId,
        locationName: loc.locationName,
        kitsAvailable: Math.max(0, Number(loc.kitsAvailable ?? 0)),
      }))
      .sort((a, b) => b.kitsAvailable - a.kitsAvailable);
  }, [rawAvailability, isLoading, kitVariantId]);

  return { kitsPerLocation, isLoading };
};

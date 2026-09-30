import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  StockMovementWithRelations,
  CreateStockMovementRequest,
  UpdateStockMovementRequest,
  StockMovementsResponse,
} from "@esli-cosmetics/types";
import {
  getStockMovements,
  searchStockMovements,
  getStockMovementById,
  createStockMovement,
  updateStockMovement,
  deleteStockMovement,
  type StockMovementFilters,
} from "@/actions";
import { stockLevelKeys } from "./use-stock-levels";
import { invalidateInventoryQueries } from "@/lib/invalidate-inventory-queries";

// Query keys for stock movements
export const stockMovementKeys = {
  all: ["stock-movements"] as const,
  lists: () => [...stockMovementKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...stockMovementKeys.lists(), params] as const,
  details: () => [...stockMovementKeys.all, "detail"] as const,
  detail: (id: string) => [...stockMovementKeys.details(), id] as const,
};

export const useStockMovements = (params?: {
  page?: number;
  limit?: number;
  filters?: StockMovementFilters;
}) => {
  return useQuery({
    queryKey: stockMovementKeys.list(params || {}),
    queryFn: () =>
      getStockMovements(params?.page, params?.limit, params?.filters),
    staleTime: 0,
  });
};

export const useSearchStockMovements = (
  search: string,
  page: number = 1,
  limit: number = 10,
  filters?: StockMovementFilters
) => {
  return useQuery<StockMovementsResponse>({
    queryKey: ["stock-movements-search", search, page, limit, filters || {}],
    queryFn: async () => {
      if (!search || search.trim() === "") {
        return { stockMovements: [], total: 0, page, limit, totalPages: 0 };
      }
      return searchStockMovements(search, page, limit, filters);
    },
    enabled: !!search && search.trim().length > 0,
    placeholderData: prev => prev,
    staleTime: 0,
  });
};

export const useStockMovement = (id: string) => {
  return useQuery({
    queryKey: stockMovementKeys.detail(id),
    queryFn: () => getStockMovementById(id),
    enabled: !!id,
  });
};

export const useCreateStockMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateStockMovementRequest) => createStockMovement(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.lists() });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useUpdateStockMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateStockMovementRequest;
    }) => updateStockMovement(id, data),
    onSuccess: updatedStockMovement => {
      queryClient.invalidateQueries({ queryKey: stockLevelKeys.lists() });
      queryClient.setQueryData(
        stockMovementKeys.detail(updatedStockMovement.id),
        updatedStockMovement
      );
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.lists() });
    },
  });
};

export const useDeleteStockMovement = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteStockMovement(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({
        queryKey: stockMovementKeys.detail(deletedId),
      });
      queryClient.invalidateQueries({ queryKey: stockMovementKeys.all });
    },
  });
};

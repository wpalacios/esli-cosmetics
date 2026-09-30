import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  WarehouseWithRelations,
  WarehousesResponse,
  CreateWarehouseRequest,
  UpdateWarehouseRequest,
} from "@esli-cosmetics/types";
import {
  getWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
} from "@/actions/warehouses";

// Query keys
const WAREHOUSES_QUERY_KEY = "warehouses";

// Types for API calls
interface WarehousesParams {
  page?: number;
  limit?: number;
  search?: string;
}

// Hook to fetch warehouses with pagination and search
export function useWarehouses(params: WarehousesParams = {}) {
  const { page = 1, limit = 10, search } = params;

  return useQuery<WarehousesResponse>({
    queryKey: [
      WAREHOUSES_QUERY_KEY,
      { page, limit, ...(search && { search }) },
    ],
    queryFn: async () => {
      return await getWarehouses({ page, limit, ...(search && { search }) });
    },
    staleTime: 0,
  });
}

// Hook to fetch a single warehouse by ID
export function useWarehouse(id: string) {
  return useQuery<WarehouseWithRelations>({
    queryKey: [WAREHOUSES_QUERY_KEY, id],
    queryFn: async () => {
      return await getWarehouse(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

// Hook to create a new warehouse
export function useCreateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation<WarehouseWithRelations, Error, CreateWarehouseRequest>({
    mutationFn: async data => {
      return await createWarehouse(data);
    },
    onSuccess: () => {
      // Invalidate and refetch warehouses queries
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
    },
  });
}

// Hook to update a warehouse
export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation<
    WarehouseWithRelations,
    Error,
    { id: string; data: UpdateWarehouseRequest }
  >({
    mutationFn: async ({ id, data }) => {
      return await updateWarehouse(id, data);
    },
    onSuccess: data => {
      // Invalidate and refetch warehouses queries
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
      // Update the specific warehouse in cache
      queryClient.setQueryData([WAREHOUSES_QUERY_KEY, data.id], data);
    },
  });
}

// Hook to delete a warehouse
export function useDeleteWarehouse() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async id => {
      return await deleteWarehouse(id);
    },
    onSuccess: () => {
      // Invalidate and refetch warehouses queries
      queryClient.invalidateQueries({ queryKey: [WAREHOUSES_QUERY_KEY] });
    },
  });
}

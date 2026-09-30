import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SupplierWithRelations,
  SuppliersResponse,
  CreateSupplierRequest,
  UpdateSupplierRequest,
} from "@esli-cosmetics/types";
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "@/actions/suppliers";

// Query keys
const SUPPLIERS_QUERY_KEY = "suppliers";

// Types for API calls
interface SuppliersParams {
  page?: number;
  limit?: number;
  search?: string;
}

// Hook to fetch suppliers with pagination and search
export function useSuppliers(params: SuppliersParams = {}) {
  const { page = 1, limit = 10, search } = params;

  return useQuery<SuppliersResponse>({
    queryKey: [SUPPLIERS_QUERY_KEY, { page, limit, ...(search && { search }) }],
    queryFn: async () => {
      return await getSuppliers({ page, limit, ...(search && { search }) });
    },
    staleTime: 0,
  });
}

// Hook to fetch a single supplier by ID
export function useSupplier(id: string) {
  return useQuery<SupplierWithRelations>({
    queryKey: [SUPPLIERS_QUERY_KEY, id],
    queryFn: async () => {
      return await getSupplier(id);
    },
    enabled: !!id,
    staleTime: 0,
  });
}

// Hook to create a new supplier
export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation<SupplierWithRelations, Error, CreateSupplierRequest>({
    mutationFn: async data => {
      return await createSupplier(data);
    },
    onSuccess: () => {
      // Invalidate and refetch suppliers queries
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
    },
  });
}

// Hook to update a supplier
export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation<
    SupplierWithRelations,
    Error,
    { id: string; data: UpdateSupplierRequest }
  >({
    mutationFn: async ({ id, data }) => {
      return await updateSupplier(id, data);
    },
    onSuccess: data => {
      // Invalidate and refetch suppliers queries
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
      // Update the specific supplier in cache
      queryClient.setQueryData([SUPPLIERS_QUERY_KEY, data.id], data);
    },
  });
}

// Hook to delete a supplier
export function useDeleteSupplier() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async id => {
      return await deleteSupplier(id);
    },
    onSuccess: () => {
      // Invalidate and refetch suppliers queries
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_QUERY_KEY] });
    },
  });
}

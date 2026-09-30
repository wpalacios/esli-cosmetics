import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  SupplierOrder,
  CreateSupplierOrderRequest,
  UpdateSupplierOrderRequest,
  PaginatedSupplierOrdersResponse,
  DeleteSupplierOrderResponse,
} from "@esli-cosmetics/types";
import {
  getSupplierOrders,
  getSupplierOrderById,
  createSupplierOrder,
  updateSupplierOrder,
  deleteSupplierOrder,
  exportSupplierOrderPdf,
  searchSupplierOrders,
  getVariantsByBrand,
} from "@/actions/supplier-order";
import { useState, useEffect } from "react";

// Query keys
export const supplierOrderKeys = {
  all: ["supplier-orders"] as const,
  lists: () => [...supplierOrderKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...supplierOrderKeys.lists(), params] as const,
  details: () => [...supplierOrderKeys.all, "detail"] as const,
  detail: (id: string) => [...supplierOrderKeys.details(), id] as const,
  searchPOS: (query: string) =>
    [...supplierOrderKeys.all, "search-pos", query] as const,
};

// List supplier orders (with search and pagination)
export function useGetSupplierOrder(params?: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const queryParams = { ...params };
  return useQuery({
    queryKey: supplierOrderKeys.list(queryParams),
    queryFn: () => getSupplierOrders(queryParams),
    placeholderData: prev => prev,
    staleTime: 0,
  });
}

// Get supplier order by ID
export const useGetSupplierOrderById = (id: string) => {
  return useQuery({
    queryKey: supplierOrderKeys.detail(id),
    queryFn: () => getSupplierOrderById(id),
    enabled: !!id,
  });
};

// Search supplier orders (explicit)
export const useSearchSupplierOrders = (searchParams: {
  search: string;
  page?: number;
  limit?: number;
}) => {
  const params = { ...searchParams };
  return useQuery({
    queryKey: ["supplier-orders-search", params],
    queryFn: () =>
      searchSupplierOrders(params.search, params.page ?? 1, params.limit ?? 10),
    enabled: !!params.search && params.search.trim().length > 0,
    placeholderData: prev => prev,
    staleTime: 0,
  });
};

// Search product variants for global stock level (global stock, prices, etc)
export const useGetVariantsByBrand = (
  brandId: string,
  page: number = 1,
  limit: number = 6
) => {
  return useQuery({
    queryKey: ["variants-by-brand", brandId, page, limit],
    queryFn: () => getVariantsByBrand(brandId, page, limit),
    enabled: !!brandId,
    staleTime: 0,
    placeholderData: prev => prev,
  });
};

// Create supplier order
export const useCreateSupplierOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupplierOrderRequest) => {
      return createSupplierOrder(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: supplierOrderKeys.lists() });
    },
  });
};

// Update supplier order
export const useUpdateSupplierOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateSupplierOrderRequest;
    }) => {
      const result = await updateSupplierOrder(id, data);

      return result;
    },
    onSuccess: updated => {
      queryClient.setQueryData(
        supplierOrderKeys.detail(updated.id ?? ""),
        updated
      );
      queryClient.invalidateQueries({ queryKey: supplierOrderKeys.lists() });
    },
  });
};

// Delete supplier order
export const useDeleteSupplierOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => {
      return deleteSupplierOrder(id);
    },
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({
        queryKey: supplierOrderKeys.detail(deletedId),
      });
      queryClient.invalidateQueries({ queryKey: supplierOrderKeys.all });
    },
  });
};

// Export supplier order PDF
export const useExportSupplierOrderPdf = () => {
  return useMutation({
    mutationFn: (orderId: string) => {
      return exportSupplierOrderPdf(orderId);
    },
  });
};

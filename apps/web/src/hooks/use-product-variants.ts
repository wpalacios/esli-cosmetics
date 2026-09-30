import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  searchProductVariants,
  getProductVariant,
  createProductVariant,
  updateProductVariant,
  deleteProductVariant,
  listProductVariantsPaginated,
  getAllVariantsWithStock,
} from "@/actions/product-variants";
import {
  ApiProductVariant,
  CreateApiProductVariantRequest,
  UpdateApiProductVariantRequest,
} from "@esli-cosmetics/types";

// Query keys for product variants
export const productVariantKeys = {
  all: ["product-variants"] as const,
  lists: () => [...productVariantKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...productVariantKeys.lists(), params] as const,
  details: () => [...productVariantKeys.all, "detail"] as const,
  detail: (id: string) => [...productVariantKeys.details(), id] as const,
  searches: () => [...productVariantKeys.all, "search"] as const,
  search: (query: string, locationId?: string) =>
    [...productVariantKeys.searches(), query, locationId] as const,
};

export const useSearchProductVariants = (
  query: string,
  locationId?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: productVariantKeys.search(query, locationId),
    queryFn: () =>
      searchProductVariants({
        query,
        ...(locationId && { locationId }),
      }),
    enabled:
      (options?.enabled ?? true) &&
      !!query &&
      query.trim().length >= 2 &&
      !!locationId,
    staleTime: 0, // Always fresh data - critical for POS stock accuracy
    gcTime: 0, // Don't cache - stock levels change frequently during POS operations
    refetchOnMount: "always", // Always get latest data
    refetchOnWindowFocus: true, // Refetch when window regains focus for accuracy
  });
};

export const useProductVariant = (variantId: string) => {
  return useQuery({
    queryKey: productVariantKeys.detail(variantId),
    queryFn: () => getProductVariant({ variantId }),
    enabled: !!variantId,
    staleTime: 0,
  });
};

export const useCreateProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      data,
    }: {
      productId: string;
      data: CreateApiProductVariantRequest;
    }) => createProductVariant({ productId, data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productVariantKeys.lists() });
      // Invalidate products queries to refetch product data with updated variants
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
    },
  });
};

export const useUpdateProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      productId,
      variantId,
      data,
    }: {
      productId: string;
      variantId: string;
      data: UpdateApiProductVariantRequest;
    }) => updateProductVariant({ productId, variantId, data }),
    onSuccess: (_, { variantId }) => {
      queryClient.invalidateQueries({ queryKey: productVariantKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: productVariantKeys.detail(variantId),
      });
      // Invalidate products queries to refetch product data with updated variants
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
    },
  });
};

export const useDeleteProductVariant = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variantId: string) => deleteProductVariant({ variantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productVariantKeys.lists() });
      // Invalidate products queries to refetch product data with updated variants
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
    },
  });
};

export const useProductVariantsPaginated = (
  productId: string,
  page: number,
  limit: number = 10
) => {
  return useQuery({
    queryKey: productVariantKeys.list({ productId, page, limit }),
    queryFn: () => listProductVariantsPaginated({ productId, page, limit }),
    enabled: !!productId && productId.trim() !== "",
    staleTime: 0,
  });
};

// Custom hook to get all product variants with global stock, paginated & searchable
export const useAllVariantsWithStock = (
  page: number = 1,
  limit: number = 10,
  search?: string
) => {
  // Normalize search to ensure consistent query keys (undefined vs empty string)
  const normalizedSearch =
    search && search.trim().length > 0 ? search.trim() : undefined;

  return useQuery({
    queryKey: ["all-variants-with-stock", page, limit, normalizedSearch],
    queryFn: () => getAllVariantsWithStock(page, limit, normalizedSearch),
    enabled: true,
    staleTime: 0,
    placeholderData: prev => prev,
  });
};

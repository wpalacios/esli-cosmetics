import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ProductWithRelations,
  CreateProductRequest,
  UpdateProductRequest,
  ProductsFilters,
  ProductsResponse,
  ProductType,
} from "@esli-cosmetics/types";
import {
  getProducts,
  searchProduct,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/actions";
import { useState, useEffect } from "react";

// Query keys for products
export const productKeys = {
  all: ["products"] as const,

  lists: () => [...productKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...productKeys.lists(), params] as const,
  details: () => [...productKeys.all, "detail"] as const,
  detail: (id: string) => [...productKeys.details(), id] as const,
  variantsList: (productId: string) =>
    [...productKeys.details(), productId, "variants"] as const,
};

export const useProducts = (params?: {
  page?: number;
  limit?: number;
  excludeTypes?: ProductType[];
  brandId?: string;
  categoryId?: string;
}) => {
  return useQuery({
    queryKey: productKeys.list(params || {}),
    queryFn: () => getProducts(params),
    staleTime: 0,
  });
};

export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

//Searching product by name, sku or barcode
export const useSearchProduct = (
  search: string,
  page: number = 1,
  limit: number = 10,
  excludeTypes?: ProductType[],
  brandId?: string,
  categoryId?: string
) => {
  return useQuery<ProductsResponse>({
    queryKey: [
      "products-search",
      search,
      page,
      limit,
      excludeTypes,
      brandId,
      categoryId,
    ],
    queryFn: async () => {
      if (!search || search.trim() === "") {
        return { products: [], total: 0, page, limit };
      }
      return searchProduct(
        search,
        page,
        limit,
        excludeTypes,
        brandId,
        categoryId
      );
    },
    enabled: !!search && search.trim().length > 0,
    placeholderData: prev => prev,
    staleTime: 0,
  });
};

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => getProductById(id),
    enabled: !!id,
  });
};

export const useCreateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProductRequest) => createProduct(data),
    onSuccess: () => {
      //Invalidate and refetch products list and search queries
      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
    },
  });
};

export const useUpdateProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProductRequest }) =>
      updateProduct(id, data) as Promise<ProductWithRelations>,

    onSuccess: updatedProduct => {
      queryClient.setQueryData(
        productKeys.detail(updatedProduct.id),
        updatedProduct
      );

      queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ["products-search"] });
    },
  });
};

export const useDeleteProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: productKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });
};

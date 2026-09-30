import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BrandWithRelations,
  CreateBrandRequest,
  UpdateBrandRequest,
  BrandsResponse,
} from "@esli-cosmetics/types";
import {
  getBrands,
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand,
  checkBrandNameExists,
} from "@/actions/brands";
import { useDebounce } from "@esli-cosmetics/utils";

// Query keys for brands
export const brandKeys = {
  all: ["brands"] as const,
  lists: () => [...brandKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...brandKeys.lists(), params] as const,
  details: () => [...brandKeys.all, "detail"] as const,
  detail: (id: string) => [...brandKeys.details(), id] as const,
};

export const useBrands = (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return useQuery({
    queryKey: brandKeys.list(params || {}),
    queryFn: () => getBrands(params),
    staleTime: 0,
  });
};

export const useBrand = (id: string) => {
  return useQuery({
    queryKey: brandKeys.detail(id),
    queryFn: () => getBrand(id),
    enabled: !!id,
    staleTime: 0,
  });
};

export const useCreateBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBrandRequest) => createBrand(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
    },
  });
};

export const useUpdateBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBrandRequest }) =>
      updateBrand(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
      queryClient.invalidateQueries({ queryKey: brandKeys.detail(id) });
    },
  });
};

export const useCheckBrandName = (name: string, excludeId?: string) => {
  const debouncedName = useDebounce(name, 1000);

  return useQuery({
    queryKey: [...brandKeys.all, "check-name", debouncedName, excludeId],
    queryFn: () => checkBrandNameExists(debouncedName, excludeId),
    enabled: !!debouncedName && debouncedName.trim().length > 0,
    staleTime: 0,
    gcTime: 0,
  });
};

export const useDeleteBrand = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteBrand(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: brandKeys.lists() });
    },
  });
};

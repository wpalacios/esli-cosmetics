import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CategoryWithRelations,
  CreateCategoryRequest,
  UpdateCategoryRequest,
  CategoryFilters,
  CategoriesResponse,
} from "@esli-cosmetics/types";
import {
  getCategories,
  searchCategoriesByName,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  checkCategoryNameExists,
} from "@/actions";
import { UseQueryResult } from "@tanstack/react-query";
import { useDebounce } from "@esli-cosmetics/utils";

// Query keys for categories
export const categoryKeys = {
  all: ["categories"] as const,

  lists: () => [...categoryKeys.all, "list"] as const, //groups all variants of list(params) for global overrides
  list: (
    params: Record<string, any> //identifies specific queries.
  ) => [...categoryKeys.lists(), params] as const,
  details: () => [...categoryKeys.all, "detail"] as const, //groups individual queries
  detail: (id: string) => [...categoryKeys.details(), id] as const, //to invalidate all details at the same time
};

// TODO: remove this function
export const useCategories = (params?: {
  page?: number;
  limit?: number;
}): UseQueryResult<CategoriesResponse, unknown> => {
  return useQuery({
    queryKey: categoryKeys.list(params || {}),
    queryFn: () => getCategories(params),
    staleTime: 0,
  });
};

export const useSearchCategoriesByName = (
  name: string,
  page: number = 1,
  limit: number = 10
) => {
  return useQuery({
    queryKey: categoryKeys.list({ name, page, limit }),
    queryFn: () => searchCategoriesByName(name, page, limit),
    staleTime: 0,
  });
};

export const useCategory = (id: string) => {
  return useQuery({
    queryKey: categoryKeys.detail(id),
    queryFn: () => getCategoryById(id),
    enabled: !!id,
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) => createCategory(data),
    onSuccess: () => {
      // Invalidate and refetch categories list
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryRequest }) =>
      updateCategory(id, data) as Promise<CategoryWithRelations>,

    onSuccess: updatedCategory => {
      queryClient.setQueryData(
        categoryKeys.detail(updatedCategory.id),
        updatedCategory
      );

      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

export const useCheckCategoryName = (name: string, excludeId?: string) => {
  const debouncedName = useDebounce(name, 300);

  return useQuery({
    queryKey: [...categoryKeys.all, "check-name", debouncedName, excludeId],
    queryFn: () => checkCategoryNameExists(debouncedName, excludeId),
    enabled: !!debouncedName && debouncedName.trim().length > 0,
    staleTime: 0,
    gcTime: 0,
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: categoryKeys.detail(deletedId) });

      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
    },
  });
};

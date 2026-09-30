import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  PriceType,
  CreatePriceRequest,
  UpdatePriceRequest,
  PricesResponse,
  PricesFilters,
} from "@esli-cosmetics/types";
import {
  createPrice,
  getPrices,
  searchPrice,
  getPriceById,
  updatePrice,
  deletePrice,
} from "@/actions/prices";

export const priceKeys = {
  all: ["prices"] as const,

  lists: () => [...priceKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...priceKeys.lists(), params] as const,

  details: () => [...priceKeys.all, "detail"] as const,
  detail: (id: string) => [...priceKeys.details(), id] as const,

  search: (search: string, page: number, limit: number) =>
    [...priceKeys.all, "search", search, page, limit] as const,
};

export const usePrices = (params: PricesFilters = {}) => {
  return useQuery<PricesResponse>({
    queryKey: priceKeys.list(params),
    queryFn: () => getPrices(params),
    staleTime: 0,
  });
};

export const usePrice = (id: string) => {
  return useQuery<PriceType>({
    queryKey: priceKeys.detail(id),
    queryFn: () => getPriceById(id),
    enabled: !!id,
  });
};

export const useSearchPrice = (
  search: string,
  page: number = 1,
  limit: number = 10
) => {
  return useQuery<PricesResponse>({
    queryKey: priceKeys.search(search, page, limit),
    queryFn: async () => {
      if (!search || search.trim() === "") {
        return {
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNext: false,
            hasPrev: false,
          },
        };
      }
      return searchPrice(search, page, limit);
    },
    enabled: !!search && search.trim().length > 0,
    placeholderData: prev => prev,
    staleTime: 0,
  });
};

export const useCreatePrice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePriceRequest) => createPrice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: priceKeys.lists() });
    },
  });
};

export const useUpdatePrice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePriceRequest }) =>
      updatePrice(id, data) as Promise<PriceType>,

    onSuccess: updatedPrice => {
      queryClient.setQueryData(priceKeys.detail(updatedPrice.id), updatedPrice);
      queryClient.invalidateQueries({ queryKey: priceKeys.lists() });
    },
  });
};

export const useDeletePrice = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deletePrice(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: priceKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: priceKeys.all });
    },
  });
};

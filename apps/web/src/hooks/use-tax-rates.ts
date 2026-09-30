import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  TaxRate,
  CreateTaxRateDto,
  UpdateTaxRateDto,
  PaginatedTaxRates,
} from "@esli-cosmetics/types";
import {
  getTaxRates,
  getTaxRateById,
  createTaxRate,
  updateTaxRate,
  deleteTaxRate,
} from "@/actions/tax-rates";

export const taxRateKeys = {
  all: ["tax-rates"] as const,
  lists: () => [...taxRateKeys.all, "list"] as const,
  list: (params: { page?: number; limit?: number; search?: string }) =>
    [...taxRateKeys.lists(), params] as const,
  details: () => [...taxRateKeys.all, "detail"] as const,
  detail: (id: string) => [...taxRateKeys.details(), id] as const,
};

export const useTaxRates = (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return useQuery<PaginatedTaxRates>({
    queryKey: taxRateKeys.list(params || {}),
    queryFn: () => getTaxRates(params),
    staleTime: 0,
  });
};
export const useTaxRate = (id: string) => {
  return useQuery<TaxRate>({
    queryKey: taxRateKeys.detail(id),
    queryFn: () => getTaxRateById(id),
    enabled: !!id,
  });
};

export const useCreateTaxRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTaxRateDto) => createTaxRate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taxRateKeys.lists() });
    },
  });
};

export const useUpdateTaxRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaxRateDto }) =>
      updateTaxRate(id, data) as Promise<TaxRate>,

    onSuccess: updatedTaxRate => {
      queryClient.setQueryData(
        taxRateKeys.detail(updatedTaxRate.id),
        updatedTaxRate
      );

      queryClient.invalidateQueries({ queryKey: taxRateKeys.lists() });
    },
  });
};

export const useDeleteTaxRate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTaxRate(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: taxRateKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: taxRateKeys.all });
    },
  });
};

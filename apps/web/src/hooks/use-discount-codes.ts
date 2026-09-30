import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getDiscountCodes,
  getDiscountCode,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  validateDiscountCode,
  ValidateDiscountCodeResponse,
} from "@/actions/discount-codes";
import {
  DiscountCode,
  CreateDiscountCodeRequest,
  UpdateDiscountCodeRequest,
  DiscountCodesResponse,
} from "@esli-cosmetics/types";

// Query keys for discount codes
export const discountCodeKeys = {
  all: ["discount-codes"] as const,
  lists: () => [...discountCodeKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...discountCodeKeys.lists(), params] as const,
  details: () => [...discountCodeKeys.all, "detail"] as const,
  detail: (id: string) => [...discountCodeKeys.details(), id] as const,
};

export const useDiscountCodes = (params?: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  return useQuery({
    queryKey: discountCodeKeys.list(params || {}),
    queryFn: () => getDiscountCodes(params),
    staleTime: 0,
  });
};

export const useDiscountCode = (id: string) => {
  return useQuery({
    queryKey: discountCodeKeys.detail(id),
    queryFn: () => getDiscountCode(id),
    enabled: !!id,
    staleTime: 0,
  });
};

export const useCreateDiscountCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDiscountCodeRequest) => createDiscountCode(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discountCodeKeys.lists() });
    },
  });
};

export const useUpdateDiscountCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateDiscountCodeRequest;
    }) => updateDiscountCode(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: discountCodeKeys.lists() });
      queryClient.invalidateQueries({ queryKey: discountCodeKeys.detail(id) });
    },
  });
};

export const useDeleteDiscountCode = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteDiscountCode(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discountCodeKeys.lists() });
    },
  });
};

export const useValidateDiscountCode = () => {
  return useMutation({
    mutationFn: ({
      code,
      customerId,
      orderAmount,
    }: {
      code: string;
      customerId?: string;
      orderAmount: number;
    }) =>
      validateDiscountCode(code, {
        ...(customerId && { customerId }),
        orderAmount,
      }),
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CustomerType,
  CreateCustomerTypeRequest,
  UpdateCustomerTypeRequest,
  PaginatedCustomerTypesResponse,
} from "@esli-cosmetics/types";
import {
  createCustomerType,
  getCustomerTypes,
  searchCustomerType,
  getCustomerTypeById,
  updateCustomerType,
  deleteCustomerType,
} from "@/actions/customer-types";

export const customerTypeKeys = {
  all: ["customer-types"] as const,

  lists: () => [...customerTypeKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...customerTypeKeys.lists(), params] as const,

  details: () => [...customerTypeKeys.all, "detail"] as const,
  detail: (id: string) => [...customerTypeKeys.details(), id] as const,

  search: (search: string, page: number, limit: number) =>
    [...customerTypeKeys.all, "search", search, page, limit] as const,
};

export interface CustomerTypesFilters {
  page?: number;
  limit?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  search?: string;
}

export const useCustomerTypes = (params: CustomerTypesFilters = {}) => {
  return useQuery<PaginatedCustomerTypesResponse>({
    queryKey: customerTypeKeys.list(params),
    queryFn: () => getCustomerTypes(params),
    staleTime: 0,
  });
};

export const useCustomerType = (id: string) => {
  return useQuery<CustomerType>({
    queryKey: customerTypeKeys.detail(id),
    queryFn: () => getCustomerTypeById(id),
    enabled: !!id,
  });
};

export const useSearchCustomerType = (
  search: string,
  page: number = 1,
  limit: number = 10
) => {
  return useQuery<PaginatedCustomerTypesResponse>({
    queryKey: customerTypeKeys.search(search, page, limit),
    queryFn: async () => {
      if (!search || search.trim() === "") {
        return {
          data: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
        };
      }
      return searchCustomerType(search, page, limit);
    },
    enabled: !!search && search.trim().length > 0,
    placeholderData: prev => prev,
    staleTime: 0,
  });
};

export const useCreateCustomerType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomerTypeRequest) =>
      createCustomerType(data) as Promise<CustomerType>,

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerTypeKeys.lists() });
    },
  });
};

export const useUpdateCustomerType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCustomerTypeRequest;
    }) => updateCustomerType(id, data) as Promise<CustomerType>,

    onSuccess: updatedCustomerType => {
      queryClient.setQueryData(
        customerTypeKeys.detail(updatedCustomerType.id),
        updatedCustomerType
      );
      queryClient.invalidateQueries({ queryKey: customerTypeKeys.lists() });
    },
  });
};

export const useDeleteCustomerType = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCustomerType(id),

    onSuccess: response => {
      queryClient.invalidateQueries({ queryKey: customerTypeKeys.lists() });
    },
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerAccountStatement,
  createCustomerPayment,
  createCustomerRefund,
  reversePayment,
  manualReversePayment,
  CustomersParams,
  AccountStatementParams,
  CreateCustomerPaymentRequest,
  ReversePaymentRequest,
  ManualPaymentReversalRequest,
} from "@/actions/customers";
import {
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from "@esli-cosmetics/types";

export { useExportPaymentReceiptPdf } from "./use-orders";

export const CUSTOMERS_QUERY_KEY = "customers";

export function useCustomers(params: CustomersParams = {}, initialData?: any) {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, params],
    queryFn: () => getCustomers(params),
    placeholderData: initialData,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 2 minutes
    refetchOnMount: false, // Use cached data if available
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, id],
    queryFn: () => getCustomer(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnMount: false, // Use cached data if available
    refetchOnWindowFocus: false, // Prevent refetch on window focus
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCustomerRequest) => createCustomer(data),
    onSuccess: () => {
      // Invalidate and refetch customers list
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCustomerRequest }) =>
      updateCustomer(id, data),
    onSuccess: (data, variables) => {
      // Invalidate and refetch customers list
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
      // Update the specific customer in cache
      queryClient.setQueryData([CUSTOMERS_QUERY_KEY, variables.id], data);
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      // Invalidate and refetch customers list
      queryClient.invalidateQueries({ queryKey: [CUSTOMERS_QUERY_KEY] });
    },
  });
}

export function useCustomerAccountStatement(
  customerId: string,
  params: Omit<AccountStatementParams, "customerId"> = {},
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [CUSTOMERS_QUERY_KEY, customerId, "account-statement", params],
    queryFn: () => getCustomerAccountStatement({ customerId, ...params }),
    enabled: options?.enabled !== false && !!customerId,
    staleTime: 0,
  });
}

export function useCreateCustomerPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      data,
    }: {
      customerId: string;
      data: CreateCustomerPaymentRequest;
    }) => createCustomerPayment(customerId, data),
    onSuccess: (_, variables) => {
      // Invalidate customer account statement and customer data
      queryClient.invalidateQueries({
        queryKey: [
          CUSTOMERS_QUERY_KEY,
          variables.customerId,
          "account-statement",
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [CUSTOMERS_QUERY_KEY, variables.customerId],
      });
    },
  });
}

export function useCreateCustomerRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      customerId,
      data,
    }: {
      customerId: string;
      data: CreateCustomerPaymentRequest;
    }) => createCustomerRefund(customerId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          CUSTOMERS_QUERY_KEY,
          variables.customerId,
          "account-statement",
        ],
      });
      queryClient.invalidateQueries({
        queryKey: [CUSTOMERS_QUERY_KEY, variables.customerId],
      });
    },
  });
}

export function useReversePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      paymentId,
      data,
    }: {
      customerId: string;
      paymentId: string;
      data: ReversePaymentRequest;
    }) => reversePayment(paymentId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          CUSTOMERS_QUERY_KEY,
          variables.customerId,
          "account-statement",
        ],
      });
    },
  });
}

export function useManualReversePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      customerId,
      paymentId,
      data,
    }: {
      customerId: string;
      paymentId: string;
      data: ManualPaymentReversalRequest;
    }) => manualReversePayment(paymentId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          CUSTOMERS_QUERY_KEY,
          variables.customerId,
          "account-statement",
        ],
      });
    },
  });
}

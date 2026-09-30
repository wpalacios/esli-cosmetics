import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createOrder,
  getOrder,
  getOrders,
  annulOrder,
  approveOrder,
  payInstallment,
  payOrder,
  exportReceiptPdf,
  exportInstallmentReceiptPdf,
  exportPaymentReceiptPdf,
  reversePayment,
  manualReversePayment,
  CreateOrderRequest,
  Order,
  OrdersResponse,
  GetOrdersParams,
  PayInstallmentRequest,
  PayOrderRequest,
  AnnulOrderItemRequest,
  annulOrderItem,
  BulkAnnulOrderItemsRequest,
  bulkAnnulOrderItems,
  ReversePaymentRequest,
  ManualPaymentReversalRequest,
} from "@/actions/orders";
import { getReportExportMeta } from "@/lib/report-export-meta";
import { invalidateInventoryQueries } from "@/lib/invalidate-inventory-queries";

// Query keys for orders
export const orderKeys = {
  all: ["orders"] as const,
  lists: () => [...orderKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...orderKeys.lists(), params] as const,
  details: () => [...orderKeys.all, "detail"] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
};

export const useOrder = (id: string) => {
  return useQuery({
    queryKey: orderKeys.detail(id),
    queryFn: () => getOrder(id),
    enabled: !!id,
    staleTime: 0,
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOrderRequest) => createOrder(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      invalidateInventoryQueries(queryClient);
    },
  });
};

// Hook to export receipt PDF by orderId
export const useExportReceiptPdf = () => {
  return useMutation({
    mutationFn: (orderId: string) => {
      const { timeZone } = getReportExportMeta();
      return exportReceiptPdf(orderId, { timeZone });
    },
  });
};

export const useOrders = (
  params: GetOrdersParams = {},
  initialData?: OrdersResponse
) => {
  return useQuery({
    queryKey: orderKeys.list(params),
    queryFn: () => getOrders(params),
    initialData,
    staleTime: 0, // never stale
  });
};

export const useAnnulOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => annulOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderKeys.details() });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useApproveOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => approveOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      queryClient.invalidateQueries({ queryKey: orderKeys.details() });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const usePayInstallment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      installmentId,
      data,
    }: {
      orderId: string;
      installmentId: string;
      data: PayInstallmentRequest;
    }) => payInstallment(orderId, installmentId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(variables.orderId),
      });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
};

export const usePayOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: PayOrderRequest;
    }) => payOrder(orderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(variables.orderId),
      });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
};

export const useExportInstallmentReceiptPdf = () => {
  return useMutation({
    mutationFn: (installmentId: string) => {
      const { timeZone } = getReportExportMeta();
      return exportInstallmentReceiptPdf(installmentId, { timeZone });
    },
  });
};

export const useExportPaymentReceiptPdf = () => {
  return useMutation({
    mutationFn: (paymentId: string) => {
      const { timeZone } = getReportExportMeta();
      return exportPaymentReceiptPdf(paymentId, { timeZone });
    },
  });
};

export const useAnnulOrderItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      orderItemId,
      data,
    }: {
      orderId: string;
      orderItemId: string;
      data: AnnulOrderItemRequest;
    }) => annulOrderItem(orderId, orderItemId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(variables.orderId),
      });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useBulkAnnulOrderItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      orderId,
      data,
    }: {
      orderId: string;
      data: BulkAnnulOrderItemsRequest;
    }) => bulkAnnulOrderItems(orderId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(variables.orderId),
      });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useReverseOrderPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      paymentId,
      data,
    }: {
      orderId: string;
      paymentId: string;
      data: ReversePaymentRequest;
    }) => reversePayment(paymentId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(variables.orderId),
      });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
};

export const useManualReverseOrderPayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      paymentId,
      data,
    }: {
      orderId: string;
      paymentId: string;
      data: ManualPaymentReversalRequest;
    }) => manualReversePayment(paymentId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: orderKeys.detail(variables.orderId),
      });
      queryClient.invalidateQueries({ queryKey: orderKeys.lists() });
    },
  });
};

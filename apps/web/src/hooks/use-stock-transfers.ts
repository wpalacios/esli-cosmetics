import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createTransfer,
  getStockTransfers,
  getStockTransfer,
  updateTransferStatus,
  dispatchTransfer,
  receiveTransfer,
  cancelTransfer,
  exportTransferPdf,
  GetStockTransfersParams,
  StockTransfer,
  StockTransfersResponse,
  CreateTransferRequest,
  UpdateTransferStatusRequest,
  DispatchTransferRequest,
  ReceiveTransferRequest,
} from "@/actions/stock-transfers";
import { invalidateInventoryQueries } from "@/lib/invalidate-inventory-queries";

// Query keys for stock transfers
export const stockTransferKeys = {
  all: ["stock-transfers"] as const,
  lists: () => [...stockTransferKeys.all, "list"] as const,
  list: (params: GetStockTransfersParams) =>
    [...stockTransferKeys.lists(), params] as const,
  details: () => [...stockTransferKeys.all, "detail"] as const,
  detail: (id: string) => [...stockTransferKeys.details(), id] as const,
};

export const useStockTransfers = (
  params: GetStockTransfersParams = {},
  initialData?: StockTransfersResponse
) => {
  return useQuery({
    queryKey: stockTransferKeys.list(params),
    queryFn: () => getStockTransfers(params),
    initialData,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};

export const useStockTransfer = (id: string) => {
  return useQuery({
    queryKey: stockTransferKeys.detail(id),
    queryFn: () => getStockTransfer(id),
    enabled: !!id,
    staleTime: 0,
  });
};

export const useCreateTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTransferRequest) => createTransfer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.lists(),
      });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useUpdateTransferStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateTransferStatusRequest;
    }) => updateTransferStatus(id, data),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.detail(data.id),
      });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useDispatchTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DispatchTransferRequest }) =>
      dispatchTransfer(id, data),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.detail(data.id),
      });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useReceiveTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceiveTransferRequest }) =>
      receiveTransfer(id, data),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.detail(data.id),
      });
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useCancelTransfer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => cancelTransfer(id),
    onSuccess: data => {
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: stockTransferKeys.detail(data.id),
      });
      invalidateInventoryQueries(queryClient);
    },
  });
};

// Hook to export transfer PDF by transferId
export const useExportTransferPdf = () => {
  return useMutation({
    mutationFn: (transferId: string) => exportTransferPdf(transferId),
  });
};

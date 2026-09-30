import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createQuote,
  getQuote,
  getQuotes,
  updateQuote,
  deleteQuote,
  convertQuoteToOrder,
  exportQuotePdf,
  GetQuotesParams,
  annulQuote,
  approveQuote,
} from "@/actions/quotes";
import { getReportExportMeta } from "@/lib/report-export-meta";
import { invalidateInventoryQueries } from "@/lib/invalidate-inventory-queries";
import type {
  PaginatedQuotes,
  CreateQuote,
  UpdateQuote,
  ConvertQuoteToOrder,
  Quote,
} from "@esli-cosmetics/types";

// Query keys for quotes
export const quoteKeys = {
  all: ["quotes"] as const,
  lists: () => [...quoteKeys.all, "list"] as const,
  list: (params: Record<string, any>) =>
    [...quoteKeys.lists(), params] as const,
  details: () => [...quoteKeys.all, "detail"] as const,
  detail: (id: string) => [...quoteKeys.details(), id] as const,
};

export const useQuote = (id: string, initialData?: Quote) => {
  return useQuery({
    queryKey: quoteKeys.detail(id),
    queryFn: () => getQuote(id),
    enabled: !!id,
    initialData,
    staleTime: 0, // Always consider data stale to ensure fresh data
    refetchOnMount: true, // Always refetch on mount to get latest data (especially for stock levels)
    refetchOnWindowFocus: true, // Refetch when window regains focus to catch changes from other tabs
  });
};

export const useCreateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateQuote) => createQuote(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
};

export const useQuotes = (
  params: GetQuotesParams = {},
  initialData?: PaginatedQuotes
) => {
  return useQuery({
    queryKey: quoteKeys.list(params),
    queryFn: () => getQuotes(params),
    initialData,
    /**
     * staleTime: 0 ensures the UI fetches fresh data on every window focus
     * or component mount to immediately catch midnight status changes.
     */
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    /**
     * refetchInterval: 86400000 (24 hours).
     * Synchronizes the automated background refresh with the daily
     * expiration cycle of the backend.
     */
    refetchInterval: 86400000,
    refetchIntervalInBackground: false,
  });
};

export const useUpdateQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuote }) =>
      updateQuote(id, data),
    onSuccess: (updatedQuote, variables) => {
      // Update the specific quote in cache to avoid refetch of detail query
      queryClient.setQueryData(quoteKeys.detail(variables.id), updatedQuote);
      // Invalidate list queries - they will only refetch if actively being viewed
      // Since user is on edit page, list queries are likely inactive and won't refetch immediately
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      // Editing an APPROVED quote (item removal, quantity change, or a location
      // move) changes stock_levels.reserved, so refresh POS/stock views too.
      invalidateInventoryQueries(queryClient);
    },
  });
};

export const useDeleteQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteQuote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
    },
  });
};

export const useConvertQuoteToOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConvertQuoteToOrder }) =>
      convertQuoteToOrder(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: quoteKeys.detail(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      // Also invalidate orders since we created one
      queryClient.invalidateQueries({ queryKey: ["orders", "list"] });
      invalidateInventoryQueries(queryClient);
    },
  });
};

// Hook to export quote PDF by quoteId
export const useExportQuotePdf = () => {
  return useMutation({
    mutationFn: (quoteId: string) => {
      const { timeZone } = getReportExportMeta();
      return exportQuotePdf(quoteId, { timeZone });
    },
  });
};

/**
 * Hook to approve a quote (DRAFT -> APPROVED)
 * Reserves inventory and sets expiration
 */
export const useApproveQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      approveQuote(id, userId),
    onSuccess: (updatedQuote, variables) => {
      // 1. Update the specific quote in cache immediately
      queryClient.setQueryData(quoteKeys.detail(variables.id), updatedQuote);

      // 2. Invalidate lists to ensure consistency across the app
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      invalidateInventoryQueries(queryClient);
    },
  });
};

/**
 * Hook to annul a quote (DRAFT/APPROVED -> ANNULLED)
 * Releases inventory if it was previously reserved
 */
export const useAnnulQuote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      annulQuote(id, userId),
    onSuccess: (updatedQuote, variables) => {
      // 1. Update the cache with the annulled status
      queryClient.setQueryData(quoteKeys.detail(variables.id), updatedQuote);

      // 2. Invalidate lists
      queryClient.invalidateQueries({ queryKey: quoteKeys.lists() });
      invalidateInventoryQueries(queryClient);
    },
  });
};

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCurrentCashSession,
  getCashSession,
  openCashRegisterSession,
  closeCashRegisterSession,
  getCashMovements,
  createCashRegisterMovement,
  getCashRegisters,
  getCashRegister,
  createCashRegister,
  updateCashRegister,
  deleteCashRegister,
  getCashSessions,
} from "@/actions/cash-register";
import type {
  OpenCashSessionRequest,
  CloseCashSessionRequest,
  CreateCashMovementRequest,
  CashSession,
  CashMovement,
  CashRegister,
  CreateCashRegisterRequest,
  UpdateCashRegisterRequest,
} from "@esli-cosmetics/types";

// Query keys
export const cashRegisterKeys = {
  all: ["cash-register"] as const,
  sessions: () => [...cashRegisterKeys.all, "sessions"] as const,
  currentSession: () => [...cashRegisterKeys.sessions(), "current"] as const,
  session: (id: string) => [...cashRegisterKeys.sessions(), id] as const,
  movements: (sessionId?: string) =>
    [...cashRegisterKeys.all, "movements", sessionId] as const,
  registers: () => [...cashRegisterKeys.all, "registers"] as const,
};

export function useCashSession() {
  return useQuery({
    queryKey: cashRegisterKeys.currentSession(),
    queryFn: () => getCurrentCashSession(),
    staleTime: 0, // Always consider data stale to allow immediate refetches
    refetchInterval: 30000, // Refetch every 30 seconds
    refetchOnWindowFocus: false, // Prevent refetch on window focus to reduce requests
    refetchOnMount: "always", // Always refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
    retry: false, // Don't retry on error (return null instead)
    gcTime: 0, // Don't keep in cache
  });
}

export function useCashSessionById(
  id: string,
  options?: { enabled?: boolean; staleTime?: number }
) {
  return useQuery({
    queryKey: cashRegisterKeys.session(id),
    queryFn: () => getCashSession(id),
    enabled: options?.enabled !== undefined ? options.enabled && !!id : !!id,
    staleTime: 0, // Always consider data stale to allow immediate refetches
  });
}

export function useCashMovements(sessionId?: string) {
  return useQuery({
    queryKey: cashRegisterKeys.movements(sessionId),
    queryFn: () =>
      getCashMovements(sessionId ? { cashSessionId: sessionId } : undefined),
    enabled: !!sessionId,
    staleTime: 0,
  });
}

export function useCashRegisters(params?: {
  locationId?: string;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...cashRegisterKeys.registers(), params],
    queryFn: () => getCashRegisters(params),
    enabled: !!params?.locationId, // Only fetch if locationId is provided
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    refetchOnMount: false, // Use cached data if available
    refetchOnWindowFocus: false, // Prevent refetch on window focus to reduce requests
  });
}

export function useOpenCashSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: OpenCashSessionRequest) => openCashRegisterSession(data),
    onSuccess: async session => {
      // Invalidate queries first to mark them as stale
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.currentSession(),
      });
      queryClient.invalidateQueries({ queryKey: cashRegisterKeys.sessions() });
      // Invalidate the cash session by cash register query if we have a cashRegisterId
      if (session?.cashRegisterId) {
        queryClient.invalidateQueries({
          queryKey: [
            ...cashRegisterKeys.sessions(),
            "by-cash-register",
            session.cashRegisterId,
          ],
        });
      }
      // Force refetch the current session query immediately
      await queryClient.refetchQueries({
        queryKey: cashRegisterKeys.currentSession(),
        type: "active", // Only refetch active queries
      });
      // Also refetch all sessions to ensure consistency
      await queryClient.refetchQueries({
        queryKey: cashRegisterKeys.sessions(),
        type: "active",
      });
    },
  });
}

export function useCloseCashSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: string;
      data: CloseCashSessionRequest;
    }) => closeCashRegisterSession(sessionId, data),
    onSuccess: async session => {
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.currentSession(),
      });
      queryClient.invalidateQueries({ queryKey: cashRegisterKeys.sessions() });
      // Invalidate the cash session by cash register query if we have a cashRegisterId
      if (session?.cashRegisterId) {
        queryClient.invalidateQueries({
          queryKey: [
            ...cashRegisterKeys.sessions(),
            "by-cash-register",
            session.cashRegisterId,
          ],
        });
      }
    },
  });
}

export function useCreateCashMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCashMovementRequest) =>
      createCashRegisterMovement(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.movements(variables.cashSessionId),
      });
      queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.currentSession(),
      });
    },
  });
}

export function useCashRegister(id: string) {
  return useQuery({
    queryKey: [...cashRegisterKeys.registers(), id],
    queryFn: () => getCashRegister(id),
    enabled: !!id,
    staleTime: 0,
  });
}

export function useCreateCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCashRegisterRequest) => createCashRegister(data),
    onSuccess: async () => {
      // Invalidate and refetch all cash register queries
      await queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.registers(),
      });
      await queryClient.refetchQueries({
        queryKey: cashRegisterKeys.registers(),
        type: "active", // Only refetch active queries
      });
    },
  });
}

export function useUpdateCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: UpdateCashRegisterRequest;
    }) => updateCashRegister(id, data),
    onSuccess: async () => {
      // Invalidate and refetch all cash register queries
      await queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.registers(),
      });
      await queryClient.refetchQueries({
        queryKey: cashRegisterKeys.registers(),
        type: "active", // Only refetch active queries
      });
    },
  });
}

export function useDeleteCashRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteCashRegister(id),
    onSuccess: async () => {
      // Invalidate and refetch all cash register queries
      await queryClient.invalidateQueries({
        queryKey: cashRegisterKeys.registers(),
      });
      await queryClient.refetchQueries({
        queryKey: cashRegisterKeys.registers(),
        type: "active", // Only refetch active queries
      });
    },
  });
}

export function useOpenCashSessionsByLocation(locationId?: string) {
  return useQuery({
    queryKey: [...cashRegisterKeys.sessions(), "open", locationId],
    queryFn: () =>
      getCashSessions(
        locationId ? { locationId, status: "open" } : { status: "open" }
      ),
    enabled: !!locationId,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnMount: false, // Use cached data if available
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetch the open cash session for a specific cash register
 * Returns the first open session found for the cash register (there should only be one)
 */
export function useCashSessionByCashRegisterId(cashRegisterId?: string) {
  return useQuery({
    queryKey: [
      ...cashRegisterKeys.sessions(),
      "by-cash-register",
      cashRegisterId,
    ],
    queryFn: async () => {
      if (!cashRegisterId) return null;
      const sessions = await getCashSessions({
        cashRegisterId,
        status: "open",
      });
      // Return the first (and should be only) open session, or null if none found
      return sessions.length > 0 ? sessions[0] : null;
    },
    enabled: !!cashRegisterId,
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    refetchOnMount: false, // Use cached data if available
    refetchInterval: 30000, // Refetch every 30 seconds (only when component is mounted)
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: false,
  });
}

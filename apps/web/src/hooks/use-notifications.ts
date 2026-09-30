"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  NotificationsResponse,
  UnreadCountResponse,
} from "@esli-cosmetics/types";
import {
  getNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/actions/notifications";

export const notificationKeys = {
  all: ["notifications"] as const,
  lists: () => [...notificationKeys.all, "list"] as const,
  list: (params: {
    page?: number;
    limit?: number;
    channel?: string;
    read?: boolean;
    search?: string;
  }) => [...notificationKeys.lists(), params] as const,
  details: () => [...notificationKeys.all, "detail"] as const,
  detail: (id: string) => [...notificationKeys.details(), id] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
  me: () => [...notificationKeys.all, "me"] as const,
};

export const useNotifications = (params?: {
  page?: number;
  limit?: number;
  channel?: string;
  read?: boolean;
  search?: string;
}) => {
  return useQuery<NotificationsResponse>({
    queryKey: notificationKeys.list({
      ...(params?.page !== undefined && { page: params.page }),
      ...(params?.limit !== undefined && { limit: params.limit }),
      ...(params?.channel !== undefined && { channel: params.channel }),
      ...(params?.read !== undefined && { read: params.read }),
      ...(params?.search !== undefined && { search: params.search }),
    }),
    queryFn: () =>
      getNotifications(
        params?.page,
        params?.limit,
        params?.channel,
        params?.read,
        params?.search
      ),
    staleTime: 300000,
    refetchOnWindowFocus: true,
  });
};

export const useUnreadNotificationCount = () => {
  return useQuery<UnreadCountResponse>({
    queryKey: notificationKeys.unreadCount(),
    queryFn: getUnreadCount,
    staleTime: 300000,
    refetchInterval: 600000,
    refetchOnWindowFocus: true,
    retry: false,
  });
};

export const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};

export const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
};

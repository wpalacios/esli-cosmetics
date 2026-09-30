"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import {
  NotificationsResponse,
  Notification,
  UnreadCountResponse,
} from "@esli-cosmetics/types";
import { isSessionExpiredError } from "@/lib/errors/session-expired-error";

const apiClient = new ServerApiClient();

export async function getNotifications(
  page: number = 1,
  limit: number = 10,
  channel?: string,
  read?: boolean,
  search?: string
): Promise<NotificationsResponse> {
  const emptyResponse: NotificationsResponse = {
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

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (channel) params.append("channel", channel);
    if (read !== undefined) params.append("read", read.toString());
    if (search) params.append("search", search);

    const result = await apiClient.get(
      `/notifications/me?${params.toString()}`
    );

    return {
      data: result.data || [],
      pagination: result.pagination || emptyResponse.pagination,
    };
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    return emptyResponse;
  }
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  try {
    const result = await apiClient.get("/notifications/unread-count");
    return { count: result.count || 0 };
  } catch (error) {
    if (isSessionExpiredError(error)) throw error;
    return { count: 0 };
  }
}

export async function markNotificationAsRead(
  id: string
): Promise<Notification> {
  return await apiClient.patch(`/notifications/${id}/read`, {});
}

export async function markAllNotificationsAsRead(): Promise<{ count: number }> {
  return await apiClient.patch("/notifications/mark-all-read", {});
}

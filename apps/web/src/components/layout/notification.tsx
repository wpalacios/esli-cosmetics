"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BellIcon } from "./notification-icons";
import { Badge } from "@esli-cosmetics/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@esli-cosmetics/ui";
import { useIsMobile } from "@esli-cosmetics/utils/client";
import { PlaceholderAvatar } from "../ui/placeholder-avatar";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
} from "@/hooks/use-notifications";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Notification } from "@esli-cosmetics/types";

export function Notification() {
  const { t } = useTranslation("layout");
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  // Fetch notifications
  const { data: notificationsData, isLoading } = useNotifications({
    page: 1,
    limit: 10,
  });

  // Fetch unread count
  const { data: unreadCountData } = useUnreadNotificationCount();
  const unreadCount = unreadCountData?.count || 0;

  const markAsRead = useMarkNotificationAsRead();

  const notifications = notificationsData?.data || [];
  const hasUnread = unreadCount > 0;

  // Get first letter for avatar fallback
  const getFallback = (title?: string | null): string => {
    if (!title) return "!";
    return title.charAt(0).toUpperCase();
  };

  // Format notification time
  const formatTime = (dateString: string): string => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: es,
      });
    } catch {
      return "";
    }
  };

  // Get redirect URL based on notification payload type
  const getNotificationRedirectUrl = (
    notification: Notification
  ): string | null => {
    if (!notification.payload || typeof notification.payload !== "object") {
      return null;
    }

    const payload = notification.payload as Record<string, unknown>;
    const type = payload.type as string | undefined;

    if (type === "low_stock") {
      const sku = (payload.sku as string) || "";
      if (sku) {
        return `/stock/stock-levels?q=${encodeURIComponent(sku)}`;
      }
    }

    return null;
  };

  // Handle notification click
  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead.mutateAsync(notification.id);
    setIsOpen(false);

    // Redirect based on notification type
    const redirectUrl = getNotificationRedirectUrl(notification);
    if (redirectUrl) {
      router.push(redirectUrl);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative grid size-12 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-600 outline-none transition-all duration-200 hover:bg-neutral-50 hover:text-primary-500 focus-visible:border-primary-500 focus-visible:text-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 dark:focus-visible:border-primary-500"
          aria-label={t("notifications.viewLabel")}
        >
          <BellIcon className="h-5 w-5" />

          {hasUnread && (
            <span className="absolute right-1 top-1 z-10 size-2 rounded-full bg-error-500 ring-2 ring-white dark:ring-neutral-800">
              <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-error-500 opacity-75" />
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={isMobile ? "end" : "center"}
        className="w-80 border border-neutral-200 bg-white px-3.5 py-3 shadow-elevation dark:border-neutral-700 dark:bg-neutral-800"
        sideOffset={8}
      >
        <div className="mb-3 flex items-center justify-between px-2 py-1.5">
          <span className="text-lg font-semibold text-neutral-900 dark:text-white">
            {t("notifications.title")}
          </span>
          {unreadCount > 0 && (
            <Badge
              variant="error"
              className="rounded-md bg-primary-500 px-2 py-0.5 text-xs font-medium text-white"
            >
              {t("notifications.newCount", { count: unreadCount })}
            </Badge>
          )}
        </div>

        <div className="mb-3 max-h-96 space-y-1.5 overflow-y-auto">
          {(() => {
            if (isLoading) {
              return (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t("notifications.loading") || "Cargando..."}
                  </p>
                </div>
              );
            }
            if (notifications.length === 0) {
              return (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t("notifications.empty") || "No hay notificaciones"}
                  </p>
                </div>
              );
            }
            return notifications.map(notification => (
              <DropdownMenuItem
                key={notification.id}
                asChild
                className={notification.read ? "opacity-75" : ""}
              >
                <button
                  onClick={() => handleNotificationClick(notification)}
                  className="flex w-full items-center gap-4 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-neutral-100 focus-visible:bg-neutral-100 dark:hover:bg-neutral-700 dark:focus-visible:bg-neutral-700"
                >
                  <PlaceholderAvatar
                    fallback={getFallback(notification.title)}
                    alt="Notification"
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="block truncate text-sm font-medium text-neutral-900 dark:text-white">
                      {notification.title ||
                        t("notifications.noTitle") ||
                        "Sin titulo"}
                    </p>
                    <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
                      {notification.body || ""}
                    </p>
                    {notification.createdAt && (
                      <p className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
                        {formatTime(notification.createdAt)}
                      </p>
                    )}
                  </div>
                  {!notification.read && (
                    <span className="size-2 rounded-full bg-primary-500" />
                  )}
                </button>
              </DropdownMenuItem>
            ));
          })()}
        </div>

        <DropdownMenuSeparator className="my-1" />

        <div className="px-2 py-1.5">
          <Link
            href="/notifications"
            onClick={() => setIsOpen(false)}
            className="block w-full text-center text-sm font-medium text-primary-600 transition-colors hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            {t("notifications.seeAll") || "Ver todas las notificaciones"}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

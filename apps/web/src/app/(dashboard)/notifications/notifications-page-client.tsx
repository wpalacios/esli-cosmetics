"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  SearchInput,
  DataTable,
  PAGE_SIZE_OPTIONS,
  DEFAULT_PAGE_SIZE,
} from "@esli-cosmetics/ui";
import { Badge } from "@esli-cosmetics/ui";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationAsRead,
  useMarkAllNotificationsAsRead,
} from "@/hooks/use-notifications";
import { usePageSizeParam } from "@/hooks/use-page-size-param";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Notification } from "@esli-cosmetics/types";

type FilterTab = "all" | "unread" | "read";

export function NotificationsPageClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();

  const readParam =
    activeTab === "unread" ? false : activeTab === "read" ? true : undefined;

  const { data: notificationsData, isLoading } = useNotifications({
    page,
    limit: pageSize,
    ...(readParam !== undefined && { read: readParam }),
    ...(activeSearch && { search: activeSearch }),
  });

  const { data: unreadCountData } = useUnreadNotificationCount();
  const unreadCount = unreadCountData?.count || 0;

  const markAsRead = useMarkNotificationAsRead();
  const markAllAsRead = useMarkAllNotificationsAsRead();

  const notifications = notificationsData?.data || [];
  const pagination = notificationsData?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const totalItems = pagination?.total || 0;

  const formatTime = (dateString: string | Date): string => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: es,
      });
    } catch {
      return "";
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead.mutateAsync(notification.id);
    }

    if (
      notification.payload &&
      typeof notification.payload === "object" &&
      (notification.payload as Record<string, unknown>).type === "low_stock"
    ) {
      const sku =
        ((notification.payload as Record<string, unknown>).sku as string) || "";
      if (sku) {
        router.push(`/stock/stock-levels?q=${encodeURIComponent(sku)}`);
      }
    }
  };

  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSearch = useCallback((value: string) => {
    setActiveSearch(value);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (!value) {
      setActiveSearch("");
      setPage(1);
    }
  }, []);

  const handlePageChange = useCallback((p: number) => setPage(p), []);

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setPage(1);
    },
    [setPageSize]
  );

  const columns: ColumnDef<Notification, unknown>[] = [
    {
      id: "status",
      header: "",
      size: 40,
      cell: ({ row }) =>
        !row.original.read ? (
          <span className="inline-block size-2.5 rounded-full bg-primary-500" />
        ) : null,
    },
    {
      accessorKey: "title",
      header: "Titulo",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p
            className={`truncate text-sm ${
              !row.original.read
                ? "font-semibold text-gray-900 dark:text-white"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            {row.original.title || "Sin titulo"}
          </p>
        </div>
      ),
    },
    {
      accessorKey: "body",
      header: "Contenido",
      cell: ({ row }) => {
        const payload = row.original.payload as Record<string, unknown> | null;
        const hasLink = payload?.type === "low_stock";
        return (
          <div className="flex max-w-md items-center gap-2">
            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
              {row.original.body || ""}
            </p>
            {hasLink && (
              <span
                className="shrink-0 text-primary-500"
                title="Ver en inventario"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="size-3.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                  />
                </svg>
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "channel",
      header: "Canal",
      size: 100,
      cell: ({ row }) =>
        row.original.channel ? (
          <Badge variant="secondary" className="text-[10px] uppercase">
            {row.original.channel}
          </Badge>
        ) : null,
    },
    {
      accessorKey: "createdAt",
      header: "Fecha",
      size: 150,
      cell: ({ row }) =>
        row.original.createdAt ? (
          <span className="whitespace-nowrap text-xs text-gray-400 dark:text-gray-500">
            {formatTime(row.original.createdAt)}
          </span>
        ) : null,
    },
  ];

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "unread", label: "No leidas" },
    { key: "read", label: "Leidas" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Notificaciones
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {unreadCount > 0
              ? `Tienes ${unreadCount} notificacion${unreadCount !== 1 ? "es" : ""} sin leer`
              : "No tienes notificaciones sin leer"}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            type="button"
            onClick={() => markAllAsRead.mutateAsync()}
            disabled={markAllAsRead.isPending}
          >
            {markAllAsRead.isPending
              ? "Marcando..."
              : "Marcar todas como leidas"}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {tabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              {tab.label}
              {tab.key === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-1/2">
          <SearchInput
            placeholder="Buscar notificaciones..."
            value={searchTerm}
            onChange={handleSearchChange}
            onSearch={handleSearch}
            minLength={0}
            translations={{
              hintPressEnter: "Presiona Enter para buscar",
            }}
          />
        </div>
      </div>

      <DataTable
        data={notifications}
        columns={columns}
        loading={isLoading}
        onRowClick={notification => handleNotificationClick(notification)}
        empty={
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              No hay notificaciones
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {activeSearch
                ? "No se encontraron resultados para tu busqueda"
                : activeTab === "unread"
                  ? "No tienes notificaciones sin leer"
                  : activeTab === "read"
                    ? "No tienes notificaciones leidas"
                    : "Aun no tienes notificaciones"}
            </p>
          </div>
        }
        pagination={{
          currentPage: page,
          totalPages,
          onPageChange: handlePageChange,
          totalItems,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
        paginationLabels={{
          showing: "Mostrando",
          of: "de",
          results: "resultados",
          previous: "Anterior",
          next: "Siguiente",
          page: "Pagina",
          rowsPerPage: "Filas por pagina",
        }}
      />
    </div>
  );
}

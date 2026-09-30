"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { StockTransfer } from "@/actions/stock-transfers";
import { Pencil1Icon, CrossCircledIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui";
import { useMemo } from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface StockTransfersTableProps {
  transfers: StockTransfer[];
  onView: (transfer: StockTransfer) => void;
  onCancel?: (transfer: StockTransfer) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function StockTransfersTable({
  transfers,
  onView,
  onCancel,
  isLoading = false,
  pagination,
}: StockTransfersTableProps) {
  const { t } = useTranslation("stock");

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      {
        labelKey: string;
        variant: "success" | "warning" | "error" | "neutral" | "outline";
      }
    > = {
      CREATED: { labelKey: "transfers.status.CREATED", variant: "neutral" },
      ACCEPTED: { labelKey: "transfers.status.ACCEPTED", variant: "neutral" },
      DISPATCHING: {
        labelKey: "transfers.status.DISPATCHING",
        variant: "warning",
      },
      IN_TRANSIT: {
        labelKey: "transfers.status.IN_TRANSIT",
        variant: "warning",
      },
      RECEIVED_COMPLETE: {
        labelKey: "transfers.status.RECEIVED_COMPLETE",
        variant: "success",
      },
      RECEIVED_PARTIAL: {
        labelKey: "transfers.status.RECEIVED_PARTIAL",
        variant: "error",
      },
      CANCELLED: { labelKey: "transfers.status.CANCELLED", variant: "error" },
    };

    const config = statusConfig[status] || {
      labelKey: status,
      variant: "neutral" as const,
    };
    return <Badge variant={config.variant}>{t(config.labelKey)}</Badge>;
  };

  const columns = useMemo<ColumnDef<StockTransfer, any>[]>(
    () => [
      {
        id: "trackingNumber",
        header: t("transfers.table.trackingNumber"),
        cell: ({ row }) => {
          const transfer = row.original;
          const isPartial = transfer.status === "RECEIVED_PARTIAL";
          return (
            <span
              className={`font-mono font-medium ${isPartial ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}
            >
              {transfer.trackingNumber}
            </span>
          );
        },
      },
      {
        id: "fromLocation",
        header: t("transfers.table.fromLocation"),
        cell: ({ row }) => {
          const transfer = row.original;
          return (
            <span className="text-gray-900 dark:text-white">
              {transfer.fromLocation?.name || "N/A"}
            </span>
          );
        },
      },
      {
        id: "toLocation",
        header: t("transfers.table.toLocation"),
        cell: ({ row }) => {
          const transfer = row.original;
          return (
            <span className="text-gray-900 dark:text-white">
              {transfer.toLocation?.name || "N/A"}
            </span>
          );
        },
      },
      {
        id: "status",
        header: t("transfers.table.status"),
        cell: ({ row }) => {
          return getStatusBadge(row.original.status);
        },
      },
      {
        id: "createdAt",
        header: t("transfers.table.createdAt"),
        cell: ({ row }) => {
          const transfer = row.original;
          return (
            <span className="text-gray-600 dark:text-gray-400">
              {format(new Date(transfer.createdAt), "dd/MM/yyyy HH:mm")}
            </span>
          );
        },
      },
      {
        id: "createdBy",
        header: t("transfers.table.requestedBy"),
        cell: ({ row }) => {
          const transfer = row.original;
          const creator = transfer.createdBy;
          if (!creator) return "N/A";
          const name =
            creator.email ||
            `${creator.firstName || ""} ${creator.lastName || ""}`.trim() ||
            "Unknown";
          return (
            <span className="text-gray-600 dark:text-gray-400">{name}</span>
          );
        },
      },
      {
        id: "actions",
        header: t("transfers.table.actions"),
        cell: ({ row }) => {
          const transfer = row.original;
          const canCancel =
            transfer.status === "CREATED" || transfer.status === "ACCEPTED";
          return (
            <div className="flex items-center space-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(transfer)}
                      className="h-8 w-8 p-0 hover:bg-yellow-100 dark:hover:bg-yellow-900/20"
                    >
                      <Pencil1Icon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="sr-only">
                        {t("transfers.table.view")}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("transfers.table.viewTooltip")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {onCancel && canCancel && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation(); // to avoid row interference
                          onCancel(transfer);
                        }}
                        className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/20"
                      >
                        <CrossCircledIcon className="h-4 w-4 text-red-600 dark:text-red-400" />
                        <span className="sr-only">
                          {t("transfers.table.cancel")}
                        </span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t("transfers.table.cancelTooltip")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          );
        },
      },
    ],
    [t, onView, onCancel]
  );

  return (
    <DataTable
      data={transfers}
      columns={columns}
      loading={isLoading}
      title={t("transfers.table.title")}
      empty={
        <div className="py-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            {t("transfers.table.noData")}
          </div>
        </div>
      }
      paginationLabels={{
        showing: t("movements.table.showing"),
        of: t("movements.table.of"),
        results: t("movements.table.results"),
        previous: t("movements.table.previous"),
        next: t("movements.table.next"),
        page: t("movements.table.page") || "Page",
        rowsPerPage: t("pagination.rowsPerPage"),
      }}
      {...(pagination && { pagination })}
    />
  );
}

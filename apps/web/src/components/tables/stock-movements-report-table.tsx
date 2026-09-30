"use client";

import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, DataTable } from "@esli-cosmetics/ui";
import { ColumnDef } from "@tanstack/react-table";
import { CopyIcon } from "@radix-ui/react-icons";
import { BiPrinter } from "react-icons/bi";
import type {
  ReportPreviewResponse,
  StockMovementPreviewRow,
  StockMovementsPreviewFilters,
} from "@esli-cosmetics/types";
import { useClipboard } from "node_modules/@esli-cosmetics/utils/src/hooks/use-clipboard";
import { useToast } from "~/hooks/toast/use-toast";
import { useStockMovementsExport } from "@/hooks/use-reports";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface StockMovementsReportTableProps {
  preview: ReportPreviewResponse | null;
  isLoading?: boolean;
  pagination?: PaginationProps;
  pageSize?: number;
  appliedFilters: StockMovementsPreviewFilters;
}

const getMovementTypeColor = (type: string) => {
  const colors: Record<string, string> = {
    PURCHASE:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    SALE: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    TRANSFER:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    POSITIVE_ADJUSTMENT:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    NEGATIVE_ADJUSTMENT:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    DAMAGE:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    RETURN:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    RESTOCK: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
    ANNULMENT:
      "bg-gray-200 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  };
  return (
    colors[type] ||
    "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  );
};

export function StockMovementsReportTable({
  preview,
  isLoading,
  pagination,
  pageSize,
  appliedFilters,
}: StockMovementsReportTableProps) {
  const { t } = useTranslation("stock");
  const { copy, hasCopied } = useClipboard();
  const { toast } = useToast();
  const { exportPdf, loading: exportLoading } = useStockMovementsExport();

  const sheet = preview?.sheets?.[0];
  const data: StockMovementPreviewRow[] = useMemo(() => {
    if (!sheet) return [];
    return (sheet.rows as StockMovementPreviewRow[]) || [];
  }, [sheet]);

  const handleCopySku = (sku: string | null | undefined) => {
    if (sku) copy(sku);
    toast({
      title: t("movements.toast.copied"),
      description: t("movements.toast.copiedDesc"),
      type: "success",
    });
  };
  const handleExportMovements = async (globalIndex: number) => {
    try {
      toast({
        title: t("movements.toast.exporting"),
        description: t("movements.toast.wait"),
        type: "success",
      });

      await exportPdf({
        ...appliedFilters,
        skip: globalIndex,
        take: 8,
      });

      toast({
        title: t("movements.toast.success"),
        description: t("movements.toast.successDesc"),
        type: "success",
      });
    } catch (e) {
      toast({
        title: t("movements.toast.error"),
        description: t("movements.toast.exportFailed"),
        type: "error",
      });
    }
  };

  const columns: ColumnDef<StockMovementPreviewRow, any>[] = [
    {
      id: "date",
      header: t("movements.table.date"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {row.original.date
              ? new Date(row.original.date).toLocaleDateString()
              : "—"}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {row.original.date
              ? new Date(row.original.date).toLocaleTimeString()
              : ""}
          </div>
        </div>
      ),
    },
    {
      id: "type",
      header: t("movements.table.type"),
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMovementTypeColor(row.original.type)}`}
        >
          {t(`movements.types.${row.original.type}`)}
        </span>
      ),
    },
    {
      id: "product",
      header: t("movements.table.product"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {row.original.product && row.original.variant
              ? `${row.original.product} - ${row.original.variant}`
              : row.original.product || row.original.variant || "—"}
          </div>
          <div className="mt-1">
            <span className="flex w-fit items-center rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800">
              <span>SKU: {row.original.sku || "NO-SKU"}</span>
              {row.original.sku && row.original.sku !== "NO-SKU" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-1 size-5 rounded p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={() => handleCopySku(row.original.sku)}
                >
                  <CopyIcon
                    className={`h-3 w-3 ${hasCopied ? "text-green-600" : "text-gray-400"}`}
                  />
                </Button>
              )}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "from",
      header: t("movements.table.from"),
      cell: ({ row }) => (
        <span className="text-gray-900 dark:text-white">
          {row.original.fromLocation || "—"}
        </span>
      ),
    },
    {
      id: "to",
      header: t("movements.table.to"),
      cell: ({ row }) => (
        <span className="text-gray-900 dark:text-white">
          {row.original.toLocation || "—"}
        </span>
      ),
    },
    {
      id: "quantity",
      header: t("movements.table.quantity"),
      cell: ({ row }) => {
        const isDecrease = ["SALE", "DAMAGE", "NEGATIVE_ADJUSTMENT"].includes(
          row.original.type
        );
        return (
          <span
            className={`font-medium ${isDecrease ? "text-red-600" : "text-green-600"}`}
          >
            {isDecrease ? "-" : "+"}
            {Number(row.original.quantity).toFixed(2)}
          </span>
        );
      },
    },
    {
      id: "reference",
      header: t("movements.table.reference"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.reference || "—"}
        </span>
      ),
    },
    {
      id: "createdBy",
      header: t("movements.table.createdBy"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.createdBy || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("movements.table.actions"),
      cell: ({ row }) => {
        // 1. Calculate the global index of the movement based on the current page
        const currentPage = pagination?.currentPage ?? 1;
        const page = currentPage > 0 ? currentPage - 1 : 0;
        const size = pageSize ?? 10;
        const globalIndex = page * size + row.index;

        if (globalIndex % 8 !== 0) return null;

        // 2. Only show the button if the global index is a multiple of 8
        return (
          <Button
            variant="ghost"
            size="sm"
            disabled={exportLoading}
            onClick={() => handleExportMovements(globalIndex)} // Pass the global index
          >
            <BiPrinter className="h-4 w-4 text-blue-600" />
          </Button>
        );
      },
    },
  ];

  const resolvedPageSize = pagination?.pageSize ?? pageSize;

  return (
    <DataTable
      data={data}
      columns={columns}
      loading={isLoading ?? false}
      paginationLabels={{
        showing: t("common:pagination.showing"),
        of: t("common:pagination.of"),
        results: t("common:pagination.results"),
        previous: t("common:pagination.previous"),
        next: t("common:pagination.next"),
        page: t("common:pagination.page"),
        rowsPerPage: t("common:pagination.rowsPerPage"),
      }}
      {...(pagination && {
        pagination: {
          ...pagination,
          ...(resolvedPageSize === undefined
            ? {}
            : { pageSize: resolvedPageSize }),
        },
      })}
    />
  );
}

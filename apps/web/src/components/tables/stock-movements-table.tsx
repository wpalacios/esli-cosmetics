"use client";

import { useTranslation } from "react-i18next";
import {
  StockMovementsPreviewFilters,
  StockMovementWithRelations,
} from "@esli-cosmetics/types";
import { Button, DataTable } from "@esli-cosmetics/ui";
import { ColumnDef } from "@tanstack/react-table";
import { useToast } from "~/hooks/toast/use-toast";
import { useClipboard } from "node_modules/@esli-cosmetics/utils/src/hooks/use-clipboard";
import { CopyIcon } from "@radix-ui/react-icons";
import { BiPrinter } from "react-icons/bi";

import React from "react";
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

interface StockMovementsTableProps {
  data: StockMovementWithRelations[];
  isLoading?: boolean;
  pagination?: PaginationProps;
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

export function StockMovementsTable({
  data,
  isLoading,
  pagination,
}: StockMovementsTableProps) {
  const { t } = useTranslation("stock");
  const { copy, hasCopied } = useClipboard();
  const { toast } = useToast();
  const { exportPdf, loading: exportLoading } = useStockMovementsExport();

  /**
   * HANDLER: Export Batch of 8
   * Grabs the next 8 items from the current row index and triggers PDF.
   */
  const handleExportMovements = async (globalStartIndex: number) => {
    try {
      toast({
        title: t("movements.toast.exporting"),
        description: t("movements.toast.wait"),
        type: "success",
      });

      await exportPdf({
        skip: globalStartIndex,
        take: 8,
      });

      toast({
        title: t("movements.toast.success"), // "Audit Generated"
        description: t("movements.toast.successDesc"), // "The report has been downloaded successfully."
        type: "success",
      });
    } catch (e) {
      console.error("Error exporting movements", e);
      toast({
        title: t("movements.toast.error"),
        description: t("movements.toast.exportFailed"),
        type: "error",
      });
    }
  };

  const handleCopySku = (sku: string | null | undefined) => {
    if (sku) {
      copy(sku);
    }
    toast({
      title: t("movements.toast.copied"),
      description: t("movements.toast.copiedDesc"),
      type: "success",
    });
  };

  const columns: ColumnDef<StockMovementWithRelations, any>[] = [
    {
      id: "date",
      header: t("movements.table.date"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(row.original.createdAt).toLocaleTimeString()}
          </div>
        </div>
      ),
    },
    {
      id: "type",
      header: t("movements.table.type"),
      cell: ({ row }) => (
        <span
          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getMovementTypeColor(row.original.movementType)}`}
        >
          {t(`movements.types.${row.original.movementType}`)}
        </span>
      ),
    },
    {
      id: "product",
      header: t("movements.table.product"),
      cell: ({ row }) => {
        const variant = row.original.productVariant;
        const product = variant?.product || row.original.product;
        const sku = variant?.sku || product?.sku;
        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {/* {variant?.name || product?.name || "—"} */}
              {`${product?.name} - ${variant?.name}`}
            </div>
            <div className="mt-1">
              <span className="flex w-fit items-center rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                <span>SKU: {sku || "NO-SKU"}</span>
                {sku && sku !== "NO-SKU" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="ml-1 size-5 rounded p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={e => {
                      e.stopPropagation();
                      handleCopySku(sku);
                    }}
                    title={
                      hasCopied
                        ? t("table.copied", "¡Copiado!")
                        : t("table.copySku", "Copiar SKU")
                    }
                  >
                    <CopyIcon
                      className={`h-3 w-3 ${
                        hasCopied ? "text-green-600" : "text-gray-400"
                      }`}
                    />
                    <span className="sr-only">
                      {t("table.copySku", "Copiar SKU")}
                    </span>
                  </Button>
                )}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      id: "from",
      header: t("movements.table.from"),
      cell: ({ row }) => (
        <span className="text-gray-900 dark:text-white">
          {row.original.fromLocation?.name || "—"}
        </span>
      ),
    },
    {
      id: "to",
      header: t("movements.table.to"),
      cell: ({ row }) => (
        <span className="text-gray-900 dark:text-white">
          {row.original.toLocation?.name || "—"}
        </span>
      ),
    },
    {
      id: "quantity",
      header: t("movements.table.quantity"),
      cell: ({ row }) => {
        const isDecrease =
          row.original.movementType === "SALE" ||
          row.original.movementType === "DAMAGE" ||
          row.original.movementType === "NEGATIVE_ADJUSTMENT" ||
          (row.original.movementType === "RETURN" &&
            row.original.fromLocationId);
        return (
          <span
            className={`font-medium ${
              isDecrease
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}
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
          {row.original.creator?.email || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("movements.table.actions", "Actions"),
      cell: ({ row }) => {
        const currentPage = pagination?.currentPage ?? 1;
        const pageSize = pagination?.pageSize ?? 10;
        const globalIndex = (currentPage - 1) * pageSize + row.index;

        if (globalIndex % 8 === 0) {
          return (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="ml-1 size-5 rounded p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
              title={t("movements.table.export8", "Export 8 movements")}
              disabled={exportLoading}
              onClick={() => handleExportMovements(globalIndex)}
            >
              <BiPrinter className="h-4 w-4 text-blue-600" />
              <span className="sr-only">
                {t("movements.table.export8", "Export 8 movements")}
              </span>
            </Button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      loading={isLoading ?? false}
      empty={
        <div className="flex flex-col items-center justify-center py-10">
          <div className="mb-4 text-gray-600 dark:text-gray-400">
            {t("movements.table.noData")}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {t("movements.table.noDataDescription")}
          </p>
        </div>
      }
      paginationLabels={{
        showing: t("common:pagination.showing"),
        of: t("common:pagination.of"),
        results: t("common:pagination.results"),
        previous: t("common:pagination.previous"),
        next: t("common:pagination.next"),
        page: t("common:pagination.page"),
        rowsPerPage: t("common:pagination.rowsPerPage"),
      }}
      {...(pagination && { pagination })}
    />
  );
}

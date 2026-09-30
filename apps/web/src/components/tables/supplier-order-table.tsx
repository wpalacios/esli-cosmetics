"use client";

import React, { useMemo, useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { EyeOpenIcon, Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { BiPrinter } from "react-icons/bi";
import { CopyIcon } from "@radix-ui/react-icons";
import { useClipboard } from "@esli-cosmetics/utils";
import type { SupplierOrder } from "@esli-cosmetics/types";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@esli-cosmetics/utils";
import { useSupplier } from "@/hooks/use-suppliers";
import { useToast } from "@/hooks/toast/use-toast";

type Props = {
  data: (SupplierOrder & { supplierName?: string })[];
  loading?: boolean;
  onEdit?: (order: SupplierOrder) => void;
  onDelete?: (order: SupplierOrder) => void;
  onView?: (order: SupplierOrder) => void;
  onExportPdf?: (order: SupplierOrder) => void;
  pagination?: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void | Promise<void>;
    totalItems: number;
    pageLimit?: number;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
  };
  pageSize?: number;
  className?: string;
};

export function SupplierOrderTable({
  data,
  loading,
  onEdit,
  onDelete,
  onView,
  onExportPdf,
  pagination,
  pageSize,
  className,
}: Props) {
  const { t } = useTranslation("supplier-order");
  const { copy, hasCopied } = useClipboard();
  const { toast } = useToast();

  const SupplierNameCell = ({
    supplierId,
    fallbackName,
  }: {
    supplierId: string;
    fallbackName?: string;
  }) => {
    const { data: supplier, isLoading } = useSupplier(supplierId);

    return (
      <span className="font-medium text-gray-700 dark:text-gray-200">
        {isLoading
          ? "..."
          : supplier?.name ||
            fallbackName ||
            t("table.unknownSupplier", "Desconocido")}
      </span>
    );
  };

  const handleCopyOrderId = (orderId: string) => {
    copy(orderId);
    toast({
      title: t("table.copied", "¡Copiado!"),
      description: t(
        "table.copiedDesc",
        "Número de orden copiado al portapapeles"
      ),
      type: "success",
    });
  };

  const columns = useMemo<ColumnDef<SupplierOrder, any>[]>(
    () => [
      {
        id: "orderNumber",
        header: t("table.orderId"),
        cell: ({ row }) => (
          <span className="flex w-fit items-center rounded border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-xs font-medium text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
            <span>{row.original.id}</span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="ml-1 size-5 rounded p-0 hover:bg-blue-100 dark:hover:bg-blue-800/30"
              onClick={e => {
                e.stopPropagation();
                handleCopyOrderId(row.original.id ?? "");
              }}
              title={
                hasCopied
                  ? t("table.copied", "¡Copiado!")
                  : t("table.copyOrderId", "Copiar número de orden")
              }
            >
              <CopyIcon
                className={`h-3 w-3 ${
                  hasCopied ? "text-green-600" : "text-blue-400"
                }`}
              />
              <span className="sr-only">
                {t("table.copyOrderId", "Copiar número de orden")}
              </span>
            </Button>
          </span>
        ),
      },
      {
        id: "supplierName",
        header: t("table.supplier"),
        cell: ({ row }) => (
          <SupplierNameCell
            supplierId={row.original.supplierId ?? ""}
            fallbackName={(row.original as any).supplierName}
          />
        ),
      },
      {
        id: "createdAt",
        header: t("table.createdAt"),
        cell: ({ row }) => {
          const value = row.original.createdAt;
          return (
            <div className="flex flex-col">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {value ? new Date(value).toLocaleDateString() : "N/A"}
              </span>
            </div>
          );
        },
      },
      {
        id: "expectedDate",
        header: t("table.expectedDate"),
        cell: ({ row }) => {
          const date = row.original.expectedDate;

          if (!date) {
            return (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                -
              </span>
            );
          }

          const formattedDate = new Date(date).toLocaleDateString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          });

          return (
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {formattedDate}
            </span>
          );
        },
      },
      {
        id: "total",
        header: t("table.total"),
        cell: ({ row }) => (
          <span className="font-bold text-gray-900 dark:text-white">
            {row.original.total
              ? formatCurrency(Number(row.original.total))
              : "-"}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => (
          <div className="w-full pr-2 text-right">{t("table.actions")}</div>
        ),
        cell: ({ row }) => {
          const order = row.original;
          const isAnnulled =
            order.status === "ANNULLED" || order.status === "CANCELLED";

          const handleEditClick = () => {
            onEdit && onEdit(order);
          };
          const handleDeleteClick = () => {
            onDelete && onDelete(order);
          };

          const handleExportPdfClick = () => {
            onExportPdf && onExportPdf(order);
          };

          return (
            <div className="flex items-center justify-end space-x-1">
              {onExportPdf && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleExportPdfClick}
                  className="h-8 w-8 p-0 text-gray-500 hover:bg-purple-50 hover:text-purple-600 dark:hover:bg-purple-900/20"
                  title={t("table.exportPdf")}
                >
                  <BiPrinter className="h-4 w-4" />
                </Button>
              )}

              {onEdit && !isAnnulled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleEditClick}
                  className="h-8 w-8 p-0 text-gray-500 hover:bg-yellow-50 hover:text-yellow-600 dark:hover:bg-yellow-900/20"
                  title={t("table.edit")}
                >
                  <Pencil1Icon className="h-4 w-4" />
                </Button>
              )}

              {onDelete && !isAnnulled && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="h-8 w-8 p-0 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                  title={t("table.delete")}
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [t, onEdit, onDelete, onView, onExportPdf, hasCopied, toast]
  );

  const resolvedPageSize = pagination?.pageSize ?? pageSize;

  return (
    <div className={className}>
      <DataTable
        data={data}
        columns={columns}
        loading={!!loading}
        title={t("table.title")}
        className="overflow-visible rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-900"
        empty={
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-gray-100 p-3 dark:bg-gray-800">
              <EyeOpenIcon className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
              {t("table.noData")}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("table.noDataDesc", "No se encontraron órdenes para mostrar.")}
            </p>
          </div>
        }
        paginationLabels={{
          showing: t("pagination.showing"),
          of: t("pagination.of"),
          results: t("pagination.results"),
          previous: t("pagination.previous"),
          next: t("pagination.next"),
          page: t("pagination.page"),
          rowsPerPage: t("pagination.rowsPerPage"),
        }}
        {...(pagination && {
          pagination: {
            ...pagination,
            ...(resolvedPageSize === undefined
              ? {}
              : { pageSize: resolvedPageSize }),
            onPageChange: page => {
              return pagination.onPageChange(page);
            },
          },
        })}
      />
    </div>
  );
}

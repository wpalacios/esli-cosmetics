"use client";

import { PriceType } from "@esli-cosmetics/types";
import { Button, DataTable } from "@esli-cosmetics/ui";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { ColumnDef } from "@tanstack/react-table";
import React from "react";
import { useTranslation } from "react-i18next";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface PricesTableProps {
  data: PriceType[];
  onEdit?: (priceType: PriceType) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function PricesTable({
  data,
  onEdit,
  onDelete,
  isLoading,
  pagination,
}: PricesTableProps) {
  const { t } = useTranslation("prices");

  const columns: ColumnDef<PriceType, any>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const description = row.original.description;
        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {row.original.name}
            </div>
            {description && description.trim().length > 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {description}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "minQuantity",
      header: t("table.minQuantity"),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {row.original.minQuantity}
        </span>
      ),
    },
    {
      id: "priority",
      header: t("table.priority"),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {row.original.priority}
        </span>
      ),
    },
    {
      id: "isActive",
      header: t("table.status"),
      cell: ({ row }) => {
        const value = row.original.isActive;
        const isDeleted = row.original.isDeleted;

        let statusText = isDeleted
          ? t("table.deleted")
          : value
            ? t("table.active")
            : t("table.inactive");

        let bgColor = isDeleted
          ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          : value
            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";

        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${bgColor}`}
          >
            {statusText}
          </span>
        );
      },
    },
    {
      id: "createdAt",
      header: t("table.createdAt"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {new Date(row.original.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("table.actions"),
      cell: ({ row }) => {
        const priceType = row.original;
        const isDisabled = priceType.isDeleted;

        return (
          <div className="flex items-center space-x-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(priceType)}
                className="h-8 w-8 p-0 hover:bg-yellow-100"
                disabled={isDisabled}
              >
                {React.createElement(Pencil1Icon as any, {
                  className: "h-4 w-4 text-yellow-600",
                })}
                <span className="sr-only">{t("table.edit")}</span>
              </Button>
            )}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(priceType.id)}
                className="h-8 w-8 p-0 hover:bg-red-100"
                disabled={isDisabled}
              >
                {React.createElement(TrashIcon as any, {
                  className: "h-4 w-4 text-red-600",
                })}
                <span className="sr-only">{t("table.delete")}</span>
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      loading={isLoading ?? false}
      title={t("page.title")}
      empty={
        <div className="py-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            {t("table.noData")}
          </div>
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
      {...(pagination && { pagination })}
    />
  );
}

"use client";

import { TaxRate } from "@esli-cosmetics/types";
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

interface TaxRatesTableProps {
  data: TaxRate[];
  onEdit?: (taxRate: TaxRate) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function TaxRatesTable({
  data,
  onEdit,
  onDelete,
  isLoading,
  pagination,
}: TaxRatesTableProps) {
  const { t } = useTranslation("tax-rates");

  const columns: ColumnDef<TaxRate, any>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const code = row.original.code;
        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {row.original.name}
            </div>
            {code && code.trim().length > 0 && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {t("table.code")}: {code}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "rate",
      header: t("table.rate"),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {row.original.rate}%
        </span>
      ),
    },
    {
      id: "active",
      header: t("table.status"),
      cell: ({ row }) => {
        const isActive = row.original.active;
        const isDeleted = row.original.isDeleted;

        let statusText = isDeleted
          ? t("table.deleted")
          : isActive
            ? t("table.active")
            : t("table.inactive");

        let bgColor = isDeleted
          ? "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
          : isActive
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
        const taxRate = row.original;
        const isDisabled = !!taxRate.isDeleted;

        return (
          <div className="flex items-center space-x-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(taxRate)}
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
                onClick={() => onDelete(taxRate.id)}
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

"use client";

import React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";

import { DiscountCode } from "@esli-cosmetics/types";
import { Button, DataTable, Badge } from "@esli-cosmetics/ui";
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

interface DiscountCodesTableProps {
  data: DiscountCode[];
  onEdit: (discountCode: DiscountCode) => void;
  onDelete: (discountCode: DiscountCode) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function DiscountCodesTable({
  data,
  onEdit,
  onDelete,
  isLoading,
  pagination,
}: DiscountCodesTableProps) {
  const { t } = useTranslation("discount-codes");

  const columns: ColumnDef<DiscountCode, any>[] = [
    {
      id: "code",
      header: t("table.code"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {row.original.code}
          </div>
        </div>
      ),
    },
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.name || "—"}
        </span>
      ),
    },
    {
      id: "discountType",
      header: t("table.type"),
      cell: ({ row }) => {
        const type = row.original.discountType;
        return (
          <Badge
            variant={type === "PERCENTAGE" ? "neutral" : "success"}
            className="text-xs"
          >
            {type === "PERCENTAGE" ? `%` : "$"}
          </Badge>
        );
      },
    },
    {
      id: "value",
      header: t("table.value"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.discountType === "PERCENTAGE"
            ? `${row.original.value}%`
            : `$${row.original.value}`}
        </span>
      ),
    },
    {
      id: "minPurchase",
      header: t("table.minPurchase"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.minPurchase ? `$${row.original.minPurchase}` : "—"}
        </span>
      ),
    },
    {
      id: "usage",
      header: t("table.usage"),
      cell: ({ row }) => {
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {row.original.usageLimit || 0}
          </span>
        );
      },
    },
    {
      id: "isActive",
      header: t("table.status"),
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {isActive ? t("table.active") : t("table.inactive")}
          </span>
        );
      },
    },
    {
      id: "createdAt",
      header: t("table.createdAt"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString()
            : "N/A"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("table.actions"),
      cell: ({ row }) => {
        const discountCode = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(discountCode)}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
            >
              {React.createElement(Pencil1Icon as React.ElementType, {
                className: "h-4 w-4 text-yellow-600",
              })}
              <span className="sr-only">{t("table.edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(discountCode)}
              className="h-8 w-8 p-0 hover:bg-red-100"
            >
              {React.createElement(TrashIcon as React.ElementType, {
                className: "h-4 w-4 text-red-600",
              })}
              <span className="sr-only">{t("table.delete")}</span>
            </Button>
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
      title={t("table.title")}
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

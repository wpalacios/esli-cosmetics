"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";

import { Button, DataTable } from "@esli-cosmetics/ui";
import { SupplierWithRelations } from "@esli-cosmetics/types";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { ColumnDef } from "@tanstack/react-table";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface SuppliersTableProps {
  suppliers: SupplierWithRelations[];
  onEdit: (supplier: SupplierWithRelations) => void;
  onDelete: (supplier: SupplierWithRelations) => void;
  onView: (supplier: SupplierWithRelations) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function SuppliersTable({
  suppliers,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  pagination,
}: SuppliersTableProps) {
  const { t } = useTranslation("suppliers");

  const columns: ColumnDef<SupplierWithRelations>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 font-semibold text-white">
              {supplier.name?.charAt(0) || "?"}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {supplier.name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {supplier.contact_name || "No contact"}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "contact_name",
      header: t("table.contact"),
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {supplier.contact_name || t("table.noContact")}
          </span>
        );
      },
    },
    {
      id: "phone",
      header: t("table.phone"),
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {supplier.phone || t("table.noPhone")}
          </span>
        );
      },
    },
    {
      id: "email",
      header: t("table.email"),
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {supplier.email || t("table.noEmail")}
          </span>
        );
      },
    },
    {
      id: "address",
      header: t("table.address"),
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <span
            className="block max-w-xs truncate text-gray-600 dark:text-gray-300"
            title={supplier.address || undefined}
          >
            {supplier.address || t("table.noAddress")}
          </span>
        );
      },
    },
    {
      id: "brands",
      header: t("table.brands"),
      cell: ({ row }) => {
        const supplier = row.original;
        const brands = supplier.brands || [];

        if (brands.length === 0) {
          return (
            <span className="text-gray-500 dark:text-gray-400">
              {t("table.noBrands")}
            </span>
          );
        }

        return (
          <div className="flex flex-wrap gap-1">
            {brands.slice(0, 3).map(brand => (
              <span
                key={brand.id}
                className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
              >
                {brand.brandName}
              </span>
            ))}
            {brands.length > 3 && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                +{brands.length - 3} más
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "created_at",
      header: t("table.createdAt"),
      cell: ({ row }) => {
        const supplier = row.original;
        // Backend returns created_at (snake_case), but type expects createdAt (camelCase)
        const value = (supplier as any).created_at || supplier.createdAt;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value ? new Date(value).toLocaleDateString() : "N/A"}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: t("table.actions"),
      cell: ({ row }) => {
        const supplier = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(supplier)}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
            >
              <Pencil1Icon className="h-4 w-4 text-yellow-600" />
              <span className="sr-only">{t("table.edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(supplier)}
              className="h-8 w-8 p-0 hover:bg-red-100"
            >
              <TrashIcon className="h-4 w-4 text-red-600" />
              <span className="sr-only">{t("table.delete")}</span>
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={suppliers}
      columns={columns}
      loading={isLoading}
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

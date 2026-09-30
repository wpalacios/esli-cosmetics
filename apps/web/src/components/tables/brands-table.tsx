"use client";

import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";

import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { BrandWithRelations } from "@esli-cosmetics/types";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface BrandsTableProps {
  brands: BrandWithRelations[];
  onEdit: (brand: BrandWithRelations) => void;
  onDelete: (brand: BrandWithRelations) => void;
  onView: (brand: BrandWithRelations) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function BrandsTable({
  brands,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  pagination,
}: BrandsTableProps) {
  const { t } = useTranslation("brands");

  const columns: ColumnDef<BrandWithRelations, any>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const brand = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 font-semibold text-white">
              {brand.name?.charAt(0) || "?"}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {brand.name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {brand.country || "No country"}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "description",
      header: t("table.description"),
      cell: ({ row }) => {
        const value = row.original.description;
        return (
          <span
            className="block max-w-xs truncate text-gray-600 dark:text-gray-300"
            title={value || undefined}
          >
            {value || t("table.noDescription")}
          </span>
        );
      },
    },
    {
      id: "country",
      header: t("table.country"),
      cell: ({ row }) => {
        const value = row.original.country;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value || t("table.noCountry")}
          </span>
        );
      },
    },
    {
      id: "website",
      header: t("table.website"),
      cell: ({ row }) => {
        const value = row.original.websiteUrl;
        return value ? (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-xs truncate text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            title={value}
          >
            {value}
          </a>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">
            {t("table.noWebsite")}
          </span>
        );
      },
    },
    {
      id: "created_at",
      header: t("table.createdAt"),
      cell: ({ row }) => {
        const value = row.original.createdAt;
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
        const brand = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(brand)}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
            >
              <span className="sr-only">{t("table.edit")}</span>
              <Pencil1Icon className="h-4 w-4 text-yellow-600" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(brand)}
              className="h-8 w-8 p-0 hover:bg-red-100"
            >
              <span className="sr-only">{t("table.delete")}</span>
              <TrashIcon className="h-4 w-4 text-red-600" />
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={brands}
      loading={isLoading}
      {...(pagination && { pagination })}
    />
  );
}

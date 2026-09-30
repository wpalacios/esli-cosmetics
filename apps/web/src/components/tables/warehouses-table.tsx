"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";

import { WarehouseWithRelations } from "@esli-cosmetics/types";
import { Button, DataTable } from "@esli-cosmetics/ui";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface WarehousesTableProps {
  warehouses: WarehouseWithRelations[];
  onEdit: (warehouse: WarehouseWithRelations) => void;
  onDelete: (warehouse: WarehouseWithRelations) => void;
  onView: (warehouse: WarehouseWithRelations) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function WarehousesTable({
  warehouses,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  pagination,
}: WarehousesTableProps) {
  const { t } = useTranslation("warehouses");

  // Helper function to translate location type
  const getLocationTypeLabel = (
    locationType: string | null | undefined
  ): string => {
    if (!locationType) {
      return t("table.noLocationType");
    }
    // Try to get translation, fallback to the value itself
    const translationKey = `locationTypes.${locationType}`;
    const translated = t(translationKey);
    // If translation key is returned as-is, it means no translation exists
    return translated === translationKey ? locationType : translated;
  };

  const columns: ColumnDef<WarehouseWithRelations, any>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const warehouse = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 font-semibold text-white">
              {warehouse.name?.charAt(0) || "?"}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {warehouse.name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {getLocationTypeLabel(warehouse.location_type)}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "address",
      header: t("table.address"),
      cell: ({ row }) => {
        const value = row.original.address;
        return (
          <span
            className="block max-w-xs truncate text-gray-600 dark:text-gray-300"
            title={value || undefined}
          >
            {value || t("table.noAddress")}
          </span>
        );
      },
    },
    {
      id: "contact",
      header: t("table.contact"),
      cell: ({ row }) => {
        const value = row.original.contact;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value || t("table.noContact")}
          </span>
        );
      },
    },
    {
      id: "location_type",
      header: t("table.locationType"),
      cell: ({ row }) => {
        const value = row.original.location_type;
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {getLocationTypeLabel(value)}
          </span>
        );
      },
    },
    {
      id: "created_at",
      header: t("table.createdAt"),
      cell: ({ row }) => {
        const warehouse = row.original;
        // Backend returns created_at (snake_case), but type expects createdAt (camelCase)
        const value = (warehouse as any).created_at || warehouse.createdAt;
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
        const warehouse = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(warehouse)}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
            >
              <Pencil1Icon className="h-4 w-4 text-yellow-600" />
              <span className="sr-only">{t("table.edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(warehouse)}
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
      data={warehouses}
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

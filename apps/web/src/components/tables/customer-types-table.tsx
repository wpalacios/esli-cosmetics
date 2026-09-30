"use client";

import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";

import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { CustomerType } from "@esli-cosmetics/types";
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

interface CustomerTypesTableProps {
  customerTypes: CustomerType[];
  onEdit: (customerType: CustomerType) => void;
  onDelete: (customerType: CustomerType) => void;
  isLoading?: boolean;
  pagination?: PaginationProps | undefined;
}

export function CustomerTypesTable({
  customerTypes,
  onEdit,
  onDelete,
  isLoading = false,
  pagination,
}: CustomerTypesTableProps) {
  const { t } = useTranslation("customer-types");

  const columns: ColumnDef<CustomerType, any>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {row.original.name}
        </span>
      ),
    },
    {
      id: "description",
      header: t("table.description"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.description || "-"}
        </span>
      ),
    },
    {
      id: "status",
      header: t("table.status"),
      cell: ({ row }) => (
        <Badge
          variant={row.original.isActive ? "success" : "secondary"}
          className="text-xs"
        >
          {row.original.isActive ? t("table.active") : t("table.inactive")}
        </Badge>
      ),
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
        const ct = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                onEdit(ct);
              }}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
              type="button"
            >
              <Pencil1Icon className="h-4 w-4 text-yellow-600" />
              <span className="sr-only">{t("table.edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation();
                onDelete(ct);
              }}
              className="h-8 w-8 p-0 hover:bg-red-100"
              type="button"
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
      data={customerTypes}
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

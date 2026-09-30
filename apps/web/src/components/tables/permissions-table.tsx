"use client";

import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";

import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { Permission } from "@esli-cosmetics/types";
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

interface PermissionsTableProps {
  permissions: Permission[];
  onEdit: (permission: Permission) => void;
  onDelete: (permission: Permission) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
  showKeyColumn?: boolean;
}

export function PermissionsTable({
  permissions,
  onEdit,
  onDelete,
  isLoading = false,
  pagination,
  showKeyColumn = false,
}: PermissionsTableProps) {
  const { t } = useTranslation("permissions");

  const keyColumn: ColumnDef<Permission, any> = {
    id: "key",
    header: t("table.key"),
    cell: ({ row }) => {
      const value = row.original.key;
      return (
        <span className="font-mono text-sm text-gray-900 dark:text-white">
          {value || "—"}
        </span>
      );
    },
  };

  const columns: ColumnDef<Permission, any>[] = [
    ...(showKeyColumn ? [keyColumn] : []),
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const value = row.original.name;
        return (
          <span className="text-gray-900 dark:text-white">{value || "—"}</span>
        );
      },
    },
    {
      id: "description",
      header: t("table.description"),
      cell: ({ row }) => {
        const value = row.original.description;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value || "—"}
          </span>
        );
      },
    },
    {
      id: "created",
      header: t("table.created"),
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
        const permission = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(permission)}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
            >
              <Pencil1Icon className="h-4 w-4 text-yellow-600" />
              <span className="sr-only">{t("table.edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(permission)}
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
      data={permissions}
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

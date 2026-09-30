"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";

import { BranchWithRelations } from "@esli-cosmetics/types";
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

interface BranchesTableProps {
  branches: BranchWithRelations[];
  onEdit: (branch: BranchWithRelations) => void;
  onDelete: (branch: BranchWithRelations) => void;
  onView: (branch: BranchWithRelations) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function BranchesTable({
  branches,
  onEdit,
  onDelete,
  onView,
  isLoading = false,
  pagination,
}: BranchesTableProps) {
  const { t } = useTranslation("branches");

  const columns: ColumnDef<BranchWithRelations, any>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const branch = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 font-semibold text-white">
              {branch.name?.charAt(0) || "?"}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {branch.name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {branch.code || "No code"}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "code",
      header: t("table.code"),
      cell: ({ row }) => {
        const value = row.original.code;
        return (
          <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
            {value || "N/A"}
          </span>
        );
      },
    },
    {
      id: "manager",
      header: t("table.manager"),
      cell: ({ row }) => {
        const branch = row.original;
        const managerName = branch.manager_employee?.person
          ? `${branch.manager_employee.person.firstName} ${branch.manager_employee.person.lastName || ""}`.trim()
          : t("table.noManager");
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {managerName}
          </span>
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
      id: "phone",
      header: t("table.phone"),
      cell: ({ row }) => {
        const value = row.original.phone;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value || t("table.noPhone")}
          </span>
        );
      },
    },
    {
      id: "is_active",
      header: t("table.status"),
      cell: ({ row }) => {
        const value = row.original.is_active;
        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              value
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
          >
            {value ? t("table.active") : t("table.inactive")}
          </span>
        );
      },
    },
    {
      id: "created_at",
      header: t("table.createdAt"),
      cell: ({ row }) => {
        const branch = row.original;
        const value = (branch as any).created_at || branch.createdAt;
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
        const branch = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(branch)}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
            >
              <Pencil1Icon className="h-4 w-4 text-yellow-600" />
              <span className="sr-only">{t("table.edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(branch)}
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
      data={branches}
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

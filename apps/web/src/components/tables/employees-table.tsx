"use client";

import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";

import { Button, DataTable } from "@esli-cosmetics/ui";
import { EmployeeWithRelations } from "@esli-cosmetics/types";
import React from "react";
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

interface EmployeesTableProps {
  data: EmployeeWithRelations[];
  onEdit?: (employee: EmployeeWithRelations) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function EmployeesTable({
  data,
  onEdit,
  onDelete,
  isLoading,
  pagination,
}: EmployeesTableProps) {
  const { t } = useTranslation("employees");

  const columns: ColumnDef<EmployeeWithRelations, any>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 font-semibold text-white">
              {employee.person?.firstName?.charAt(0) || "?"}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {employee.person?.firstName} {employee.person?.lastName}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {employee.person?.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "employee_code",
      header: t("table.employeeCode"),
      cell: ({ row }) => {
        const value = row.original.employeeCode;
        return (
          <span className="font-mono text-sm text-gray-600 dark:text-gray-300">
            {value || "N/A"}
          </span>
        );
      },
    },
    {
      id: "role_title",
      header: t("table.role"),
      cell: ({ row }) => {
        const value = row.original.roleTitle;
        return (
          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {value || "N/A"}
          </span>
        );
      },
    },
    {
      id: "location",
      header: t("table.location") || "Location",
      cell: ({ row }) => {
        const location = row.original.location;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {location?.name || "N/A"}
          </span>
        );
      },
    },
    {
      id: "hired_at",
      header: t("table.hiredDate"),
      cell: ({ row }) => {
        const value = row.original.hiredAt;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value
              ? (() => {
                  const d = new Date(value);
                  const months = [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec",
                  ];
                  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
                })()
              : "N/A"}
          </span>
        );
      },
    },
    {
      id: "is_active",
      header: t("table.status"),
      cell: ({ row }) => {
        const value = row.original.isActive;
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
      id: "actions",
      header: t("table.actions"),
      cell: ({ row }) => {
        const employee = row.original;
        return (
          <div className="flex items-center space-x-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(employee)}
                className="h-8 w-8 p-0 hover:bg-yellow-100"
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
                onClick={() => onDelete(employee.id)}
                className="h-8 w-8 p-0 hover:bg-red-100"
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

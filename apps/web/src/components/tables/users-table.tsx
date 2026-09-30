"use client";

import { useTranslation } from "react-i18next";
import { ColumnDef } from "@tanstack/react-table";

import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { UserWithRelations } from "@esli-cosmetics/types";
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

interface UsersTableProps {
  users: UserWithRelations[];
  onEdit: (user: UserWithRelations) => void;
  onDelete: (user: UserWithRelations) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function UsersTable({
  users,
  onEdit,
  onDelete,
  isLoading = false,
  pagination,
}: UsersTableProps) {
  const { t } = useTranslation("users");

  const columns: ColumnDef<UserWithRelations, any>[] = [
    {
      id: "user",
      header: t("table.user"),
      cell: ({ row }) => {
        const user = row.original;
        // Prefer employee.person, then person, then email
        const employeePerson = user.employee?.person;
        const person = employeePerson || user.person;
        const userName = person
          ? `${person.firstName} ${person.lastName || ""}`.trim()
          : user.email;
        const displayInitial =
          person?.firstName?.charAt(0) || user.email?.charAt(0) || "?";

        return (
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 font-semibold text-white">
              {displayInitial}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {userName}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {user.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      id: "roles",
      header: t("table.roles"),
      cell: ({ row }) => {
        const roles = row.original.roles;
        if (!roles || roles.length === 0) {
          return (
            <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
          );
        }

        return (
          <div className="min-w-[120px] space-y-1">
            {roles.slice(0, 2).map((role, index) => {
              // Handle both old format (string) and new format (object)
              const roleName =
                typeof role === "string" ? role : role.name || role.key;
              const roleKey = typeof role === "string" ? role : role.key;
              return (
                <div key={roleKey || index} className="text-xs">
                  <Badge variant="success" className="text-xs">
                    {roleName}
                  </Badge>
                </div>
              );
            })}
            {roles.length > 2 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                +{roles.length - 2} {t("table.more")}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      header: t("table.status"),
      cell: ({ row }) => {
        const isActive = row.original.isActive;
        return (
          <Badge
            variant={isActive ? "success" : "secondary"}
            className="text-xs"
          >
            {isActive ? t("table.active") : t("table.inactive")}
          </Badge>
        );
      },
    },
    {
      id: "phone",
      header: t("table.phone"),
      cell: ({ row }) => {
        const value = row.original.person?.phone;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {value || t("table.noPhone")}
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
        const user = row.original;
        return (
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(user)}
              className="h-8 w-8 p-0 hover:bg-yellow-100"
            >
              <Pencil1Icon className="h-4 w-4 text-yellow-600" />
              <span className="sr-only">{t("table.edit")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(user)}
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
      data={users}
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

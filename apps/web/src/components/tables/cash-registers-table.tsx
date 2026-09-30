"use client";

import { ColumnDef } from "@tanstack/react-table";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { CashRegister } from "@esli-cosmetics/types";
import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import { Pencil1Icon, TrashIcon } from "@radix-ui/react-icons";
import { TbReportMoney } from "react-icons/tb";

import { ViewCashSessionModal } from "@/components/modals/view-cash-session-modal";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface CashRegistersTableProps {
  cashRegisters: CashRegister[];
  onEdit: (cashRegister: CashRegister) => void;
  onDelete: (cashRegister: CashRegister) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function CashRegistersTable({
  cashRegisters,
  onEdit,
  onDelete,
  isLoading = false,
  pagination,
  canEdit = true,
  canDelete = true,
}: CashRegistersTableProps) {
  const { t } = useTranslation("cashRegisters");
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  const columns: ColumnDef<CashRegister, any>[] = [
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const cashRegister = row.original;
        return (
          <div className="flex items-center space-x-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-pink-600 font-semibold text-white">
              {cashRegister.name?.charAt(0) || "?"}
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">
                {cashRegister.name}
              </div>
              {cashRegister.code && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {cashRegister.code}
                </div>
              )}
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
      id: "location",
      header: t("table.location"),
      cell: ({ row }) => {
        const location = row.original.location;
        return (
          <span className="text-gray-600 dark:text-gray-300">
            {location?.name || t("table.noLocation")}
          </span>
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
            className={
              isActive
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200"
            }
          >
            {isActive ? t("table.active") : t("table.inactive")}
          </Badge>
        );
      },
    },
    {
      id: "sessionStatus",
      header: t("table.sessionStatus"),
      cell: ({ row }) => {
        const hasSession =
          row.original.openSessionId !== null &&
          row.original.openSessionId !== undefined;

        return (
          <Badge
            variant={hasSession ? "success" : "secondary"}
            className={`${hasSession ? "text-green-800 dark:text-green-200" : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200"}`}
          >
            {hasSession ? t("table.open") : t("table.closed")}
          </Badge>
        );
      },
    },
    {
      id: "created",
      header: t("table.created"),
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
        const cashRegister = row.original;
        const hasOpenSession =
          cashRegister.openSessionId !== null &&
          cashRegister.openSessionId !== undefined;

        return (
          <div className="flex items-center space-x-2">
            {hasOpenSession && cashRegister.openSessionId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setViewingSessionId(cashRegister.openSessionId || null)
                }
                className="h-8 w-8 p-0 hover:bg-blue-100"
              >
                <TbReportMoney className="h-4 w-4 text-blue-600" />
                <span className="sr-only">{t("table.viewSession")}</span>
              </Button>
            )}
            {canEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(cashRegister)}
                className="h-8 w-8 p-0 hover:bg-yellow-100"
              >
                <Pencil1Icon className="h-4 w-4 text-yellow-600" />
                <span className="sr-only">{t("table.edit")}</span>
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(cashRegister)}
                className="h-8 w-8 p-0 hover:bg-red-100"
              >
                <TrashIcon className="h-4 w-4 text-red-600" />
                <span className="sr-only">{t("table.delete")}</span>
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        data={cashRegisters}
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
      {viewingSessionId && (
        <ViewCashSessionModal
          isOpen={!!viewingSessionId}
          onClose={() => setViewingSessionId(null)}
          sessionId={viewingSessionId}
        />
      )}
    </>
  );
}

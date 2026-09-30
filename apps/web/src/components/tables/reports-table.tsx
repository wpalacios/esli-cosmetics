"use client";

import React, { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DownloadIcon } from "@radix-ui/react-icons";
import { Badge, Button, DataTable } from "@esli-cosmetics/ui";
import type { ReportPreviewResponse } from "@esli-cosmetics/types";
import { useTranslation } from "react-i18next";
import { formatCurrency, LOCALE_SETTINGS } from "@esli-cosmetics/utils";

type RowRecord = Record<string, unknown>;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void | Promise<void>;
  totalItems: number;
  pageLimit?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

type Props = {
  preview: ReportPreviewResponse | null;
  loading?: boolean;
  title?: string;
  className?: string;

  onExportRow?: (row: RowRecord) => void | Promise<void>;
  exportRowLabel?: string;
  rowActions?: (row: RowRecord) => React.ReactNode;
  actionsHeader?: string;

  includeHints?: string[];
  includeKeys?: string[];
  includeHeaders?: string[];
  hideTitle?: boolean;

  pagination?: PaginationProps;
  pageSize?: number;
};

function getColKey(col: any, idx: number): string {
  return col?.key ?? col?.id ?? col?.field ?? col?.accessorKey ?? String(idx);
}

function getColHeader(col: any): string {
  return (
    col?.header ??
    col?.title ??
    col?.label ??
    col?.name ??
    col?.key ??
    col?.id ??
    ""
  );
}

function isIsoDate(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value);
}

function formatDateForPreview(value: unknown): string {
  if (typeof value !== "string") return "";

  // Try to parse as ISO date string (with timezone)
  let date: Date | null = null;
  if (value.includes("T") || value.includes("Z") || value.includes("+")) {
    // ISO format with timezone
    date = new Date(value);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // YYYY-MM-DD format - treat as UTC date
    const parts = value.split("-").map(Number);
    if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
      const [y, m, d] = parts;
      if (y && m && d) {
        date = new Date(Date.UTC(y, m - 1, d));
      }
    }
  }

  if (date && !Number.isNaN(date.getTime())) {
    // Convert UTC date to user's local timezone for display
    const localDate = new Date(date);
    const d = localDate.getDate();
    const m = localDate.getMonth() + 1;
    const y = localDate.getFullYear();
    // D/M/YYYY format
    return `${d}/${m}/${y}`;
  }

  // Fallback to original value
  return String(value);
}

function formatCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "string") {
    if (isIsoDate(v)) {
      const d = new Date(v);
      return isNaN(d.getTime()) ? v : d.toLocaleString();
    }
    return v;
  }
  return String(v);
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function shouldIncludeColumn(
  col: any,
  idx: number,
  includeHints?: string[],
  includeKeys?: string[],
  includeHeaders?: string[]
): boolean {
  if (!includeHints && !includeKeys && !includeHeaders) return true;

  const hint: string | undefined = col?.hint;
  const key = getColKey(col, idx);
  const header = getColHeader(col);

  if (includeHints && hint) {
    const set = new Set(includeHints.map(normalize));
    if (set.has(normalize(hint))) return true;
  }
  if (includeKeys) {
    const set = new Set(includeKeys.map(normalize));
    if (set.has(normalize(key))) return true;
  }
  if (includeHeaders) {
    const set = new Set(includeHeaders.map(normalize));
    if (set.has(normalize(header))) return true;
  }
  return false;
}

export function ReportPreviewTable({
  preview,
  loading,
  title,
  className,
  onExportRow,
  exportRowLabel = "Generar Reporte",
  rowActions,
  actionsHeader,
  includeHints,
  includeKeys,
  includeHeaders,
  hideTitle = false,
  pagination,
  pageSize,
}: Props) {
  const { t } = useTranslation("reports");
  const [activeSheet, setActiveSheet] = useState(0);

  const sheet = preview?.sheets?.[activeSheet];

  const includedColumns = useMemo(() => {
    if (!sheet) return [];
    const cols = sheet.columns ?? [];
    return cols.filter((col: any, idx: number) =>
      shouldIncludeColumn(col, idx, includeHints, includeKeys, includeHeaders)
    );
  }, [sheet, includeHints, includeKeys, includeHeaders]);

  const tableData: RowRecord[] = useMemo(() => {
    if (!sheet) return [];
    const columns = sheet.columns ?? [];
    const rows = (sheet.rows ?? []) as any[];
    const usingFilters = !!(includeHints || includeKeys || includeHeaders);

    return rows.map((row: any) => {
      const obj = Array.isArray(row)
        ? columns.reduce<RowRecord>((acc, col, idx) => {
            const key = getColKey(col, idx);
            acc[key] = row[idx];
            return acc;
          }, {})
        : (row as RowRecord);

      if (!usingFilters) return obj;

      const filtered: RowRecord = {};
      (sheet.columns ?? []).forEach((col: any, idx: number) => {
        const key = getColKey(col, idx);
        const include = shouldIncludeColumn(
          col,
          idx,
          includeHints,
          includeKeys,
          includeHeaders
        );
        if (include) filtered[key] = (obj as any)[key];
      });
      return filtered;
    });
  }, [sheet, includeHints, includeKeys, includeHeaders]);

  const baseColumns = useMemo<ColumnDef<RowRecord, any>[]>(() => {
    if (!sheet) return [];
    const sourceCols =
      includeHints || includeKeys || includeHeaders
        ? includedColumns
        : (sheet.columns ?? []);

    return sourceCols.map((col: any, idx: number) => {
      const originalIdx = (sheet.columns ?? []).indexOf(col);
      const key = getColKey(col, originalIdx >= 0 ? originalIdx : idx);
      const header = getColHeader(col);

      const isPrimaryColumn = idx === 0;

      return {
        id: key,
        accessorKey: key,
        header: t(`table.${header}`, { defaultValue: header }),
        cell: ({ row }) => {
          const value = row.original?.[key];

          const className = isPrimaryColumn
            ? "font-medium text-gray-900 dark:text-white"
            : "text-gray-600 dark:text-gray-300";

          // Preview Date → "D/M/YYYY"
          if (key === "date") {
            const display = formatDateForPreview(value);
            return <span className={className}>{display}</span>;
          }

          // Status column with colored badge
          if (key === "status") {
            const status = (value as string) || "COMPLETED";
            const getStatusConfig = () => {
              switch (status.toUpperCase()) {
                case "PENDIENTE":
                  return {
                    label: t("table.pending", "Pendiente"),
                    className:
                      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                  };
                case "APROBADO":
                  return {
                    label: t("table.approved", "Aprobado"),
                    className:
                      "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                  };
                case "COMPLETADO":
                  return {
                    label: t("table.completed", "Completado"),
                    className:
                      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                  };
                case "ANULADO":
                  return {
                    label: t("table.annulled", "Anulado"),
                    className:
                      "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
                  };
                default:
                  return {
                    label: status,
                    className:
                      "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
                  };
              }
            };

            const statusConfig = getStatusConfig();
            return (
              <Badge
                variant={
                  status.toUpperCase() === "ANNULLED" ? "error" : "primary"
                }
                className={statusConfig.className}
              >
                {statusConfig.label}
              </Badge>
            );
          }

          // money-like columns detection
          const moneyKeyRegex =
            /total|price|amount|tax|discount|unitPrice|lineTotal|itemDiscount|itemTax/i;

          if (moneyKeyRegex.test(String(key))) {
            // If it's a number or numeric string, format as currency (display only).
            const num =
              typeof value === "number"
                ? value
                : typeof value === "string"
                  ? Number(value)
                  : NaN;
            if (Number.isFinite(num)) {
              const display = formatCurrency(num, {
                currency: LOCALE_SETTINGS.currency as any,
                locale: LOCALE_SETTINGS.locale,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              });
              return <span className={className}>{display}</span>;
            }
            // fallback to generic formatting (string/non-numeric)
            const fallback = formatCell(value);
            return <span className={className}>{fallback}</span>;
          }

          // default formatting for other types
          const display = formatCell(value);
          return <span className={className}>{display}</span>;
        },
      } as ColumnDef<RowRecord, any>;
    });
  }, [sheet, includedColumns, includeHints, includeKeys, includeHeaders, t]);

  const columns = useMemo<ColumnDef<RowRecord, any>[]>(() => {
    const cols = [...baseColumns];

    if (rowActions || onExportRow) {
      cols.push({
        id: "__actions",
        header: actionsHeader ?? t("table.actions"),
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const r = row.original as RowRecord;

          if (rowActions) {
            return (
              <div className="flex items-center space-x-2">{rowActions(r)}</div>
            );
          }

          if (onExportRow) {
            return (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onExportRow(r)}
                className="h-8 w-8 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
              >
                {React.createElement(DownloadIcon as any, {
                  className: "h-4 w-4 text-blue-600",
                })}
                <span className="sr-only">{exportRowLabel}</span>
              </Button>
            );
          }

          return null;
        },
      } as ColumnDef<RowRecord, any>);
    }

    return cols;
  }, [baseColumns, rowActions, onExportRow, actionsHeader, exportRowLabel, t]);

  const tableTitle = hideTitle
    ? ""
    : (title ??
      (sheet?.name
        ? `${sheet.name} ${t("table.previewSuffix")}`
        : t("table.title")));

  const resolvedPageSize = pagination?.pageSize ?? pageSize;

  return (
    <div className={className}>
      {preview?.sheets && preview.sheets.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {preview.sheets.map((s, i) => (
            <Button
              key={s.name ?? i}
              variant={i === activeSheet ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveSheet(i)}
            >
              {s.name ?? `Sheet ${i + 1}`}
            </Button>
          ))}
        </div>
      )}
      <DataTable
        data={tableData}
        columns={columns}
        loading={!!loading}
        title={tableTitle}
        className="sm:p-7.5 rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none"
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
        {...(pagination && {
          pagination: {
            ...pagination,
            ...(resolvedPageSize === undefined
              ? {}
              : { pageSize: resolvedPageSize }),
          },
        })}
      />
    </div>
  );
}

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { TrashIcon, CopyIcon } from "@radix-ui/react-icons";
import { Button, DataTable } from "@esli-cosmetics/ui";
import { ApiProductVariant, ProductVariant } from "@esli-cosmetics/types";
import { formatCurrency, cn } from "@esli-cosmetics/utils";
import { useTranslation } from "react-i18next";
import { QuantityCell } from "../ui/quantity-cell-select";
import { useClipboard } from "@esli-cosmetics/utils";
import { useToast } from "@/hooks/toast/use-toast";

type SanitizedKeys =
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "name"
  | "sku"
  | "product";

export type SelectedTableVariant = {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  quantity: number;
  isEmpty: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  stockLevel?: { quantity: number } | null;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    brand?: string | null;
  };
} & Omit<Partial<ApiProductVariant>, SanitizedKeys>;

export interface SelectedProduct {
  variant: SelectedTableVariant;
  quantity: number;
  costPrice: number;
  isEmpty?: boolean;
}

type SelectedProductRow =
  | SelectedProduct
  | { variant: null; quantity: number; costPrice: number; isEmpty: true };

interface SupplierOrderSelectedTableProps {
  items: SelectedProduct[];
  onQuantityChange: (variantId: string, quantity: number) => void;
  onCostPriceChange: (variantId: string, cost: number) => void;
  onRemove: (variantId: string) => void;
  localQuantities: Record<string, string>;
  setLocalQuantities: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  className?: string;
  showStockBadge?: boolean;
}

const ROW_MIN_HEIGHT = 110;

export function SupplierOrderSelectedTable({
  items,
  onQuantityChange,
  onRemove,
  onCostPriceChange,
  className,
  localQuantities,
  setLocalQuantities,
  showStockBadge = true,
}: SupplierOrderSelectedTableProps) {
  const { t } = useTranslation("supplier-order");
  const { copy, hasCopied } = useClipboard();
  const { toast } = useToast();
  const PAGE_SIZE_CHOICES = [6, 12, 24, 48];
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [items.length, totalPages, currentPage]);

  const displayedRows = useMemo<SelectedProductRow[]>(() => {
    const start = (currentPage - 1) * pageSize;
    const realRows = items.slice(start, start + pageSize).map(item => ({
      variant: item.variant,
      quantity: item.quantity,
      costPrice: item.costPrice,
      isEmpty: false as const,
    }));
    const emptyCount = Math.max(0, pageSize - realRows.length);
    const emptyRows: SelectedProductRow[] = Array.from({
      length: emptyCount,
    }).map(() => ({
      variant: null,
      quantity: 0,
      costPrice: 0,
      isEmpty: true,
    }));
    return [...realRows, ...emptyRows];
  }, [items, currentPage, pageSize]);

  const columns = useMemo<ColumnDef<SelectedProductRow, any>[]>(
    () => [
      {
        id: "main-content",
        header: () => (
          <div className="w-full pl-2 text-left">{t("table.product")}</div>
        ),
        cell: ({ row }) => {
          if (row.original.isEmpty || !row.original.variant) {
            return (
              <div
                className="gap-4.5 flex w-full flex-col border-b border-gray-100 py-3.5 md:flex-row"
                style={{ minHeight: ROW_MIN_HEIGHT }}
              >
                <div className="flex min-w-0 flex-1 flex-col justify-center">
                  <span className="flex w-full items-center justify-start text-sm font-medium text-gray-400">
                    —
                  </span>
                </div>
                <div className="mt-4 flex w-full flex-row items-end justify-between gap-2 md:mt-0 md:w-auto md:items-center md:justify-end" />
              </div>
            );
          }
          const variant = row.original.variant as SelectedTableVariant;
          const variantId = variant.id;
          const initialValue =
            localQuantities[variantId] ?? String(row.original.quantity);

          const sku = variant.sku ?? "NO-SKU";
          const stock = variant.stockLevel?.quantity ?? variant.quantity ?? 0;
          const handleCopySku = (sku: string | null | undefined) => {
            if (sku) {
              copy(sku);
              toast({
                title: t("table.copied", "¡Copiado!"),
                description: t(
                  "table.copiedDesc",
                  "SKU copiado al portapapeles"
                ),
                type: "success",
              });
            }
          };

          return (
            <div
              className="gap-4.5 flex w-full flex-col border-b border-gray-100 py-3.5 md:flex-row"
              style={{ minHeight: ROW_MIN_HEIGHT }}
            >
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <span
                  className="whitespace-normal break-words text-sm font-medium leading-snug text-gray-900 dark:text-white md:text-base"
                  title={variant.name || ""}
                >
                  {variant.name || "Sin nombre"}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {/* SKU */}
                  <span className="flex w-fit items-center rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                    <span>SKU: {sku}</span>
                    {sku !== "NO-SKU" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        className="ml-1 size-5 rounded p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                        onClick={e => {
                          e.stopPropagation();
                          handleCopySku(variant.sku);
                        }}
                        title={
                          hasCopied
                            ? t("table.copied", "¡Copiado!")
                            : t("table.copySku", "Copiar SKU")
                        }
                      >
                        <CopyIcon
                          className={`h-3 w-3 ${
                            hasCopied ? "text-green-600" : "text-gray-400"
                          }`}
                        />
                        <span className="sr-only">
                          {t("table.copySku", "Copiar SKU")}
                        </span>
                      </Button>
                    )}
                  </span>
                  {/* stock */}
                  {showStockBadge && (
                    <span
                      className={cn(
                        "w-fit rounded border px-2 py-0.5 text-xs font-semibold",
                        stock > 0
                          ? "border-green-200 bg-green-100 text-green-800"
                          : "border-red-200 bg-red-100 text-red-800"
                      )}
                    >
                      {t("table.stock", "Stock")}: {stock}
                    </span>
                  )}
                  {/* cost */}
                  <span className="w-fit rounded border border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    {t("form.unitCost", "Costo")}:{" "}
                    {formatCurrency(row.original.costPrice)}
                  </span>
                </div>
              </div>
              {/* Actions Block */}
              <div className="mt-4 flex w-full flex-row items-end justify-between gap-2 md:mt-0 md:w-auto md:items-center md:justify-end">
                <div
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                >
                  <QuantityCell
                    variantId={variantId}
                    initialValue={initialValue}
                    costPrice={row.original.costPrice}
                    onQuantityChange={onQuantityChange}
                    setLocalQuantities={setLocalQuantities}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(variantId)}
                  className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        },
      },
    ],
    [
      onQuantityChange,
      onRemove,
      setLocalQuantities,
      t,
      copy,
      hasCopied,
      toast,
      showStockBadge,
    ]
  );

  const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  const realRows = displayedRows.filter(
    row => row.variant !== null && row.variant !== undefined && !row.isEmpty
  );
  const hasRealRows = items.length > 0;

  return (
    <div className="flex min-h-[700px] w-full max-w-9xl flex-col rounded-lg border bg-white shadow-sm dark:bg-gray-800">
      <div className="flex w-full flex-col">
        <div className="w-full flex-1">
          <DataTable
            data={displayedRows}
            columns={columns}
            loading={false}
            title={""}
            empty={
              <div className="flex h-full min-h-[300px] w-full flex-col items-center justify-center py-8 text-center text-sm italic text-gray-500">
                {t("table.noProductsSelected", "No se seleccionaron productos")}
              </div>
            }
          />
        </div>
      </div>
      {hasRealRows && (
        <div className="flex flex-col gap-2 border-t border-gray-200 bg-white px-2 py-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between sm:gap-0">
          <div className="mb-2 text-xs text-gray-500 sm:mb-0">
            {t("pagination.showing", "Mostrando")} {startIdx}{" "}
            {t("pagination.of", "a")} {endIdx}{" "}
            {t("pagination.results", "resultados")}
          </div>
          <div className="flex w-full flex-col items-center justify-end gap-2 sm:w-auto sm:flex-row sm:gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                {t("pagination.rowsPerPage", "Filas por página")}
              </span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="h-8 rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {PAGE_SIZE_CHOICES.map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={currentPage <= 1}
              onClick={e => {
                e.preventDefault();
                setCurrentPage(p => Math.max(1, p - 1));
              }}
              className="h-8 w-full text-xs sm:w-auto"
            >
              {t("pagination.previous", "Anterior")}
            </Button>
            <div className="flex w-full items-center justify-center px-2 text-sm font-medium sm:w-auto">
              {t("pagination.page", "Página")} {currentPage}{" "}
              {t("pagination.of", "de")} {totalPages}
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={currentPage >= totalPages}
              onClick={e => {
                e.preventDefault();
                setCurrentPage(p => Math.min(totalPages, p + 1));
              }}
              className="h-8 w-full text-xs sm:w-auto"
            >
              {t("pagination.next", "Siguiente")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useMemo, useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { Checkbox, DataTable, Button } from "@esli-cosmetics/ui";
import {
  ApiProductVariant,
  ProductVariant,
  ApiProduct,
} from "@esli-cosmetics/types";
import { formatCurrency, cn, useClipboard } from "@esli-cosmetics/utils";
import { useTranslation } from "react-i18next";
import { CopyIcon } from "@radix-ui/react-icons";
import { useToast } from "@/hooks/toast/use-toast";
import { QuantityCell } from "../ui/quantity-cell-select";
import { ProductType } from "@esli-cosmetics/types";

export type TableVariant = {
  id: string;
  name: string;
  sku: string;
  costPrice?: number | string;
  stockLevel?: { quantity: number };
  quantity?: number;
  isEmpty?: boolean;
  createdAt?: string;
  updatedAt?: string;
  product?: ApiProduct;
} & Partial<ApiProductVariant> &
  Partial<ProductVariant>;

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}

interface ProductVariantSelectTableProps {
  variants: TableVariant[];
  selectedIds: string[];
  onToggle: (variant: any, checked: boolean) => void;
  loading?: boolean;
  pagination: PaginationProps;
  className?: string;
  localQuantities: Record<string, string>;
  setLocalQuantities: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  onQuantityChange: (variantId: string, quantity: number) => void;
  searchedVariant?: TableVariant | null;
  showStockBadge?: boolean;
}

export function ProductVariantSelectTable({
  variants,
  selectedIds,
  onToggle,
  loading,
  className,
  localQuantities,
  setLocalQuantities,
  onQuantityChange,
  searchedVariant,
  showStockBadge = true,
}: Omit<ProductVariantSelectTableProps, "pagination"> & {
  showStockBadge?: boolean;
}) {
  const { t } = useTranslation("products");
  const { copy, hasCopied } = useClipboard();
  const { toast } = useToast();

  const PAGE_SIZE_CHOICES = [6, 12, 24, 48];
  const [pageSize, setPageSize] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);
  const filteredVariants = useMemo(
    () => variants.filter(v => (v.type ?? v.product?.type) !== ProductType.KIT),
    [variants]
  );

  const isSearching = !!searchedVariant;
  const dataToPaginate = isSearching ? [searchedVariant] : filteredVariants;
  const totalItems = isSearching ? 1 : dataToPaginate.length;
  const totalPages = isSearching
    ? 1
    : Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (isSearching && currentPage !== 1) {
      setCurrentPage(1);
    } else if (!isSearching && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [isSearching, currentPage, totalPages]);

  const displayedRows = useMemo<TableVariant[]>(() => {
    if (isSearching) {
      return [searchedVariant!];
    }
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const realRows = dataToPaginate.slice(start, end);
    const emptyCount = Math.max(0, pageSize - realRows.length);
    const emptyRows: TableVariant[] = Array.from({ length: emptyCount }).map(
      () => ({
        id: "",
        name: "",
        sku: "",
        costPrice: 0,
        stockLevel: { quantity: 0 },
        quantity: 0,
        isEmpty: true,
      })
    );
    return [...realRows, ...emptyRows];
  }, [dataToPaginate, currentPage, isSearching, searchedVariant, pageSize]);

  const startIdx = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const itemsInCurrentPage = isSearching
    ? 1
    : Math.min(pageSize, dataToPaginate.length - (currentPage - 1) * pageSize);
  const endIdx = startIdx + itemsInCurrentPage - 1;

  const hasRealRows = displayedRows.some(row => !row.isEmpty);

  const rowPaddingClass = "py-2";

  const handleCopySku = (sku: string | null | undefined) => {
    if (sku) {
      copy(sku);
      toast({
        title: t("table.copied", "¡Copiado!"),
        description: t("table.copiedDesc", "SKU copiado al portapapeles"),
        type: "success",
      });
    }
  };

  const columns = useMemo<ColumnDef<TableVariant, any>[]>(
    () => [
      {
        id: "select-product",
        header: () => (
          <div className="w-full pl-2 text-left">
            {t("table.product", "Producto")}
          </div>
        ),
        cell: ({ row }) => {
          if (row.original.isEmpty) {
            return (
              <div
                className={cn(
                  rowPaddingClass,
                  "flex min-h-[110px] w-full flex-col items-center justify-center gap-3 border-b border-gray-100 px-2 sm:flex-row"
                )}
                style={{ minHeight: 110 }}
              >
                <span className="flex w-full flex-1 items-center justify-start text-sm font-medium text-gray-400">
                  —
                </span>
              </div>
            );
          }

          const variant = row.original;
          const isSelected = selectedIds.includes(variant.id);
          const stock = variant.stockLevel?.quantity ?? variant.quantity ?? 0;
          const handleRowClick = () => onToggle(variant, !isSelected);

          const initialValue = !isSelected
            ? "0"
            : (localQuantities[variant.id] ?? String(variant.quantity ?? 1));

          return (
            <div
              className={cn(
                rowPaddingClass,
                "flex min-h-[110px] w-full cursor-pointer select-none flex-col gap-3 rounded border-b border-gray-100 px-2 transition hover:bg-pink-50 sm:flex-row"
              )}
              tabIndex={0}
              role="button"
              aria-pressed={isSelected}
              onClick={handleRowClick}
              onKeyDown={e => {
                if (e.key === " " || e.key === "Enter") handleRowClick();
              }}
              style={{ minHeight: 110 }}
            >
              {/* Checkbox */}
              <div
                className="flex items-start pt-1 sm:mr-2 sm:pt-2"
                onClick={e => e.stopPropagation()}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={checked => onToggle(variant, !!checked)}
                  aria-label="Select row"
                  className="translate-y-[2px]"
                />
              </div>
              {/* Product Info */}
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                {/* product name */}
                <span
                  className="whitespace-normal break-words text-sm font-medium leading-snug text-gray-900 dark:text-white sm:text-base"
                  title={variant.name || ""}
                >
                  {variant.name || "Sin nombre"}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {/* SKU */}
                  <span className="flex w-fit items-center rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                    <span>SKU: {variant.sku || "NO-SKU"}</span>{" "}
                    {variant.sku && (
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
                  {showStockBadge && (
                    <span
                      className={
                        stock > 0
                          ? "w-fit rounded border border-green-200 bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800"
                          : "w-fit rounded border border-red-200 bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
                      }
                    >
                      Stock: {stock}
                    </span>
                  )}
                  {/* cost */}
                  <span className="w-fit rounded border border-blue-200 bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    {t("form.unitCost", "Costo")}:{" "}
                    {formatCurrency(Number(variant.costPrice ?? 0))}
                  </span>
                </div>
              </div>
              {/* Quantity Input: always visible but only editable if selected */}
              <div className="ml-2 flex items-center">
                <QuantityCell
                  variantId={variant.id}
                  initialValue={initialValue}
                  costPrice={variant.costPrice ?? 0}
                  onQuantityChange={onQuantityChange}
                  setLocalQuantities={setLocalQuantities}
                  disabled={!isSelected}
                />
              </div>
            </div>
          );
        },
        size: 1200,
        minSize: 800,
        maxSize: 1800,
      },
    ],
    [
      selectedIds,
      onToggle,
      t,
      hasCopied,
      localQuantities,
      onQuantityChange,
      showStockBadge,
    ]
  );

  return (
    <div className="flex min-h-[700px] w-full flex-col rounded-lg border bg-white shadow-sm dark:bg-gray-800">
      <div className="flex w-full flex-col">
        <div className="w-full flex-1">
          <DataTable
            data={displayedRows}
            columns={columns}
            loading={loading ?? false}
            empty={
              <div className="flex h-full min-h-[300px] w-full flex-col items-center justify-center py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {t(
                  "table.noVariants",
                  "No hay productos disponibles para esta selección"
                )}
              </div>
            }
          />
        </div>
      </div>
      {hasRealRows && (
        <div className="flex flex-col border-t border-gray-200 bg-white px-2 py-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:items-center sm:justify-between">
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

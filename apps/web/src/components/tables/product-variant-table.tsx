"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button, DataTable } from "@esli-cosmetics/ui";
import { ApiProductVariant, PriceType } from "@esli-cosmetics/types";
import { Pencil1Icon, TrashIcon, CopyIcon } from "@radix-ui/react-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { useClipboard, CURRENCY_SIGN } from "@esli-cosmetics/utils";
import { useToast } from "@/hooks/toast/use-toast";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface ProductVariantsTableProps {
  data: ApiProductVariant[];
  parentName: string;
  onEdit?: (variant: ApiProductVariant) => void;
  onDelete?: (variant: ApiProductVariant) => void;
  isLoading?: boolean;
  priceTypes: PriceType[];
  pagination?: PaginationProps | undefined;
}

const createColumns = (
  onEdit?: (variant: ApiProductVariant) => void,
  onDelete?: (variant: ApiProductVariant) => void,
  t?: (key: string) => string,
  priceTypes: PriceType[] = [],
  handleCopySku?: (sku: string | null | undefined) => void,
  handleCopyBarcode?: (barcode: string | null | undefined) => void,
  hasCopied?: boolean
): ColumnDef<ApiProductVariant, any>[] => {
  return [
    {
      id: "name-sku",
      header: t?.("variantTable.nameSku") || "Name / SKU",
      cell: ({ row }) => {
        const sku = row.original.sku;
        return (
          <div className="min-w-[120px]">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {row.original.name || "N/A"}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>SKU: {sku || "—"}</span>
              {sku && handleCopySku && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    handleCopySku(sku);
                  }}
                  className="size-5 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title={
                    hasCopied
                      ? t?.("variantTable.copied") || "Copied!"
                      : t?.("variantTable.copySku") || "Copy SKU"
                  }
                >
                  {React.createElement(CopyIcon as any, {
                    className: `h-3 w-3 ${hasCopied ? "text-green-600" : "text-gray-500"}`,
                  })}
                  <span className="sr-only">
                    {t?.("variantTable.copySku") || "Copy SKU"}
                  </span>
                </Button>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <span>
                {t?.("variantTable.barcode") || "Barcode"}:{" "}
                {row.original.barcode || "—"}
              </span>
              {row.original.barcode && handleCopyBarcode && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation();
                    handleCopyBarcode(row.original.barcode);
                  }}
                  className="size-5 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                  title={
                    hasCopied
                      ? t?.("variantTable.copied") || "Copied!"
                      : t?.("variantTable.copyBarcode") || "Copy Barcode"
                  }
                >
                  {React.createElement(CopyIcon as any, {
                    className: `h-3 w-3 ${hasCopied ? "text-green-600" : "text-gray-500"}`,
                  })}
                  <span className="sr-only">
                    {t?.("variantTable.copyBarcode") || "Copy Barcode"}
                  </span>
                </Button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "cost_price",
      header: t?.("variantTable.cost") || "Cost",
      cell: ({ row }) => (
        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
          {Number(row.original.costPrice).toFixed(2)}
        </span>
      ),
    },
    {
      id: "prices",
      header: t?.("variantTable.prices") || "Prices",
      cell: ({ row }) => {
        const prices = row.original.prices;
        if (!prices || !Array.isArray(prices) || prices.length === 0) {
          return (
            <span className="text-sm text-gray-500 dark:text-gray-400">—</span>
          );
        }

        const visiblePrices = prices.slice(0, 2);

        return (
          <div className="min-w-[120px] space-y-1">
            {visiblePrices.map((price, index) => (
              <div key={index} className="text-xs">
                <span className="font-medium text-pink-600 dark:text-pink-400">
                  {CURRENCY_SIGN}
                  {Number(price.price).toFixed(2)}
                </span>
              </div>
            ))}
            {prices.length > 2 && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                +{prices.length - 2} {t?.("variantTable.more") || "more"}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "stock_range",
      header: t?.("variantTable.stock") || "Stock",
      cell: ({ row }) => {
        const min = row.original.minimumStock ?? 0;
        const max = row.original.maximumStock ?? "Max";
        return (
          <span className="text-xs text-gray-600 dark:text-gray-300">
            {min}-{max}
          </span>
        );
      },
    },
    {
      id: "attributes",
      header: t?.("variantTable.attributes") || "Attributes",
      cell: ({ row }) => {
        const attributes = row.original.attributes;
        if (!attributes || Object.keys(attributes).length === 0) {
          return (
            <span className="text-xs text-gray-500 dark:text-gray-400">—</span>
          );
        }
        return (
          <div className="max-w-[100px] space-y-0.5 text-xs">
            {Object.entries(attributes)
              .slice(0, 2)
              .map(([key, value]) => (
                <div key={key} className="truncate">
                  <span className="font-semibold capitalize text-gray-700 dark:text-gray-300">
                    {key}:
                  </span>{" "}
                  <span className="text-gray-600 dark:text-gray-400">
                    {value}
                  </span>
                </div>
              ))}
            {Object.keys(attributes).length > 2 && (
              <div className="text-gray-500 dark:text-gray-400">
                +{Object.keys(attributes).length - 2}{" "}
                {t?.("variantTable.more") || "more"}
              </div>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: t?.("variantTable.actions") || "Actions",
      cell: ({ row }) => (
        <div className="flex space-x-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(row.original)}
              className="h-7 w-7 p-0"
              title={t?.("variantTable.editVariant") || "Edit variant"}
            >
              {React.createElement(Pencil1Icon as any, {
                className: "h-3 w-3",
              })}
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(row.original)}
              className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
              title={t?.("variantTable.deleteVariant") || "Delete variant"}
            >
              {React.createElement(TrashIcon as any, {
                className: "h-3 w-3",
              })}
            </Button>
          )}
        </div>
      ),
    },
  ];
};

export function ProductVariantsTable({
  data,
  parentName,
  onEdit,
  onDelete,
  isLoading = false,
  priceTypes,
  pagination,
}: ProductVariantsTableProps) {
  const { t } = useTranslation("products");
  const { copy, hasCopied } = useClipboard();
  const { toast } = useToast();

  const handleCopySku = (sku: string | null | undefined) => {
    if (sku) {
      copy(sku);
      toast({
        title: t("table.copied"),
        description: t("table.copiedDesc"),
        type: "success",
      });
    }
  };

  const handleCopyBarcode = (barcode: string | null | undefined) => {
    if (barcode) {
      copy(barcode);
      toast({
        title: t("table.copied"),
        description: t("table.copiedBarcodeDesc"),
        type: "success",
      });
    }
  };

  const columns = createColumns(
    onEdit,
    onDelete,
    t,
    priceTypes,
    handleCopySku,
    handleCopyBarcode,
    hasCopied
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none sm:p-4">
      <h3 className="mb-3 text-base font-medium text-black dark:text-white sm:mb-4 sm:text-lg">
        {t("variantTable.title")}
      </h3>

      {/* Mobile Card View */}
      <div className="block space-y-3 sm:hidden">
        {isLoading ? (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("variantTable.loadingVariants")}
          </div>
        ) : data.length > 0 ? (
          data.map(variant => (
            <div
              key={variant.id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                    {variant.name || "N/A"}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>SKU: {variant.sku || "—"}</span>
                    {variant.sku && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => {
                          e.stopPropagation();
                          handleCopySku(variant.sku);
                        }}
                        className="h-4 w-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                        title={
                          hasCopied
                            ? t("variantTable.copied") || "Copied!"
                            : t("variantTable.copySku") || "Copy SKU"
                        }
                      >
                        {React.createElement(CopyIcon as any, {
                          className: `h-3 w-3 ${hasCopied ? "text-green-600" : "text-gray-500"}`,
                        })}
                        <span className="sr-only">
                          {t("variantTable.copySku") || "Copy SKU"}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>
                <div className="ml-2 flex space-x-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(variant)}
                      className="h-6 w-6 p-0"
                      title={t("variantTable.editVariant")}
                    >
                      {React.createElement(Pencil1Icon as any, {
                        className: "h-3 w-3",
                      })}
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(variant)}
                      className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                      title={t("variantTable.deleteVariant")}
                    >
                      {React.createElement(TrashIcon as any, {
                        className: "h-3 w-3",
                      })}
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("variantTable.cost")}:
                  </span>
                  <span className="ml-1 font-medium text-blue-600 dark:text-blue-400">
                    {CURRENCY_SIGN}
                    {Number(variant.costPrice).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("variantTable.prices")}:
                  </span>
                  <div className="ml-1">
                    {variant.prices && variant.prices.length > 0 && (
                      <div className="space-y-0.5">
                        {variant.prices.slice(0, 2).map((price, index) => (
                          <div key={index} className="text-xs">
                            <span className="font-medium text-pink-600 dark:text-pink-400">
                              ${Number(price.price).toFixed(2)}
                            </span>
                          </div>
                        ))}
                        {variant.prices.length > 2 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            +{variant.prices.length - 2}{" "}
                            {t("variantTable.more")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("variantTable.stock")}:
                  </span>
                  <span className="ml-1 text-gray-600 dark:text-gray-300">
                    {variant.minimumStock ?? 0}-{variant.maximumStock ?? "Max"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-gray-500 dark:text-gray-400">
                    {t("variantTable.barcode")}:
                  </span>
                  <span className="ml-1 truncate text-gray-600 dark:text-gray-300">
                    {variant.barcode || "—"}
                  </span>
                  {variant.barcode && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={e => {
                        e.stopPropagation();
                        handleCopyBarcode(variant.barcode);
                      }}
                      className="h-4 w-4 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                      title={
                        hasCopied
                          ? t("variantTable.copied") || "Copied!"
                          : t("variantTable.copyBarcode") || "Copy Barcode"
                      }
                    >
                      {React.createElement(CopyIcon as any, {
                        className: `h-3 w-3 ${hasCopied ? "text-green-600" : "text-gray-500"}`,
                      })}
                      <span className="sr-only">
                        {t("variantTable.copyBarcode") || "Copy Barcode"}
                      </span>
                    </Button>
                  )}
                </div>
              </div>

              {variant.attributes &&
                Object.keys(variant.attributes).length > 0 && (
                  <div className="mt-2 border-t border-gray-200 pt-2 dark:border-gray-700">
                    <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">
                      {t("variantTable.attributesLabel")}
                    </div>
                    <div className="space-y-0.5">
                      {Object.entries(variant.attributes)
                        .slice(0, 2)
                        .map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-semibold capitalize text-gray-700 dark:text-gray-300">
                              {key}:
                            </span>{" "}
                            <span className="text-gray-600 dark:text-gray-400">
                              {value}
                            </span>
                          </div>
                        ))}
                      {Object.keys(variant.attributes).length > 2 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          +{Object.keys(variant.attributes).length - 2}{" "}
                          {t("variantTable.more")}
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-gray-500 dark:text-gray-400">
            {t("variantTable.noVariants")}
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block">
        <DataTable
          data={data}
          columns={columns}
          loading={isLoading ?? false}
          empty={
            <div className="py-8 text-center text-gray-500 dark:text-gray-400">
              {t("variantTable.noVariants")}
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
      </div>
    </div>
  );
}

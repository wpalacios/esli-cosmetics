"use client";

import React from "react";
import Image from "next/image";
import { ColumnDef } from "@tanstack/react-table";
import { Pencil1Icon, TrashIcon, CopyIcon } from "@radix-ui/react-icons";

import { ProductWithRelations } from "@esli-cosmetics/types";
import { Button, DataTable } from "@esli-cosmetics/ui";
import { useTranslation } from "react-i18next";
import { useClipboard } from "@esli-cosmetics/utils";
import { useToast } from "@/hooks/toast/use-toast";
import { getProductImageSrc } from "@/lib/product-image-url";
import { BiPackage } from "react-icons/bi";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface ProductsTableProps {
  data: ProductWithRelations[];
  onEdit?: (product: ProductWithRelations) => void;
  onDelete?: (id: string) => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

export function ProductsTable({
  data,
  onEdit,
  onDelete,
  isLoading,
  pagination,
}: ProductsTableProps) {
  const { t } = useTranslation("products");
  const { copy, hasCopied } = useClipboard();
  const { toast } = useToast();
  const handleCopySku = (sku: string | null | undefined) => {
    if (sku) {
      copy(sku);
    }
    toast({
      title: t("table.copied"),
      description: t("table.copiedDesc"),
      type: "success",
    });
  };

  const columns: ColumnDef<ProductWithRelations, any>[] = [
    {
      id: "image",
      header: "",
      cell: ({ row }) => {
        const product = row.original as ProductWithRelations & {
          primaryImageUrl?: string;
          images?: { url: string }[];
        };
        const src = product.primaryImageUrl ?? product.images?.[0]?.url;
        return (
          <div className="flex size-12 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30">
            {src ? (
              src.includes("supabase") ? (
                // eslint-disable-next-line @next/next/no-img-element -- Proxied to avoid ERR_BLOCKED_BY_ORB
                <img
                  src={getProductImageSrc(src)}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={src}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              )
            ) : (
              <BiPackage className="h-6 w-6 text-gray-400" />
            )}
          </div>
        );
      },
      size: 64,
    },
    {
      id: "name",
      header: t("table.name"),
      cell: ({ row }) => {
        const sku = row.original.sku ?? "NO-SKU";
        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {row.original.name}
            </div>
            <div className="mt-1">
              <span className="flex w-fit items-center rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                <span>SKU: {sku}</span>{" "}
                {sku !== "NO-SKU" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="ml-1 size-5 rounded p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                    onClick={e => {
                      e.stopPropagation();
                      handleCopySku(sku);
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
            </div>
          </div>
        );
      },
    },
    {
      id: "brand",
      header: t("table.brand"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.brand?.name || "—"}
        </span>
      ),
    },
    {
      id: "category",
      header: t("table.category"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.category?.name || "-"}
        </span>
      ),
    },
    {
      id: "isActive",
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
      id: "createdAt",
      header: t("table.createdAt"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString()
            : "N/A"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("table.actions"),
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center space-x-2">
            {onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(product)}
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
                onClick={() => onDelete(product.id)}
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

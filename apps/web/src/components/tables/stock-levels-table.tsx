"use client";

import {
  StockLevelWithRelations,
  StockMovementType,
} from "@esli-cosmetics/types";
import { Button, DataTable } from "@esli-cosmetics/ui";
import { ColumnDef } from "@tanstack/react-table";
import { AiOutlineEye } from "react-icons/ai";
import {
  DotsHorizontalIcon,
  ActivityLogIcon,
  UpdateIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  CopyIcon,
} from "@radix-ui/react-icons";
import { StockMovementModal } from "@/components/modals/stock-movement-modal";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "~/hooks/toast/use-toast";
import { useClipboard } from "node_modules/@esli-cosmetics/utils/src/hooks/use-clipboard";
import React from "react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

interface StockLevelsTableProps {
  data: StockLevelWithRelations[];
  onViewAllMovements?: (id: string) => void;
  onStockMovementSuccess?: () => void;
  isLoading?: boolean;
  pagination?: PaginationProps;
}

interface DropdownMenuProps {
  row: StockLevelWithRelations;
  onViewHistory?: ((id: string) => void) | undefined;
  onStockMovementSuccess?: (() => void) | undefined;
}

function DropdownMenu({
  row,
  onViewHistory,
  onStockMovementSuccess,
}: DropdownMenuProps) {
  const { t } = useTranslation("stock");
  const [isOpen, setIsOpen] = useState(false);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementType, setMovementType] = useState<StockMovementType | null>(
    null
  );
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 224,
    placement: "bottom-right",
  });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || !buttonRef.current) {
      return;
    }

    const calculatePosition = () => {
      if (!buttonRef.current) return;

      const buttonRect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Responsive dropdown width - smaller on mobile
      const dropdownWidth = Math.min(224, viewportWidth - 32); // w-56 = 224px, min 16px padding on each side
      const dropdownHeight = onViewHistory ? 200 : 160; // Approximate height
      const padding = 16; // Space from viewport edge

      // Calculate available space in all directions
      const spaceRight = viewportWidth - buttonRect.right;
      const spaceLeft = buttonRect.left;
      const spaceBelow = viewportHeight - buttonRect.bottom;
      const spaceAbove = buttonRect.top;

      let top = 0;
      let left = 0;
      let placement = "bottom-right";

      // Determine vertical position
      if (spaceBelow >= dropdownHeight) {
        // Open below
        top = buttonRect.bottom + padding;
        placement = "bottom";
      } else if (spaceAbove >= dropdownHeight) {
        // Open above
        top = buttonRect.top - dropdownHeight - padding;
        placement = "top";
      } else {
        // Not enough space either way, position to fit best
        if (spaceBelow > spaceAbove) {
          top = buttonRect.bottom + padding;
          placement = "bottom";
        } else {
          top = buttonRect.top - dropdownHeight - padding;
          placement = "top";
        }
      }

      // Ensure dropdown stays within vertical viewport bounds
      const minTop = padding;
      const maxTop = viewportHeight - dropdownHeight - padding;
      top = Math.max(minTop, Math.min(top, maxTop));

      // Determine horizontal position
      // Try to align to the right edge of button first
      let idealLeft = buttonRect.right - dropdownWidth;

      // Ensure dropdown stays within viewport bounds
      const minLeft = padding;
      const maxLeft = viewportWidth - dropdownWidth - padding;

      // Clamp the position to stay within viewport
      left = Math.max(minLeft, Math.min(idealLeft, maxLeft));

      // Determine placement based on final position
      if (left + dropdownWidth <= buttonRect.left) {
        placement += "-left";
      } else if (left >= buttonRect.right) {
        placement += "-right";
      } else {
        placement += "-aligned";
      }

      setDropdownPosition({ top, left, width: dropdownWidth, placement });
    };

    calculatePosition();

    // Recalculate on scroll or resize
    window.addEventListener("scroll", calculatePosition, true);
    window.addEventListener("resize", calculatePosition);

    return () => {
      window.removeEventListener("scroll", calculatePosition, true);
      window.removeEventListener("resize", calculatePosition);
    };
  }, [isOpen, onViewHistory]);

  const handleAction = (type: StockMovementType) => {
    setMovementType(type);
    setMovementModalOpen(true);
    setIsOpen(false);
  };

  // Extract the correct product ID, variant ID, and location based on movement type
  const getInitialDataForMovementType = (type: StockMovementType) => {
    const variant = row.productVariant;
    const product = variant?.product || row.product;

    const productId = product?.id || row.productId || undefined;
    const productVariantId = row.productVariantId || undefined;

    // Determine which location field to use based on movement type
    let locationData = {};
    if (row.locationId) {
      if (type === StockMovementType.POSITIVE_ADJUSTMENT) {
        // For positive adjustments, location is the "to" location (receiving)
        locationData = { toLocationId: row.locationId };
      } else if (
        type === StockMovementType.TRANSFER ||
        type === StockMovementType.DAMAGE
      ) {
        // For transfers and damage, location is the "from" location (source)
        locationData = { fromLocationId: row.locationId };
      }
    }

    return {
      ...(productId && { productId }),
      ...(productVariantId && { productVariantId }),
      ...locationData,
      movementType: type,
    };
  };

  const dropdownContent = isOpen && (
    <>
      <div
        className="fixed inset-0 z-[9998]"
        onClick={() => setIsOpen(false)}
      />
      <div
        ref={dropdownRef}
        className="fixed z-[9999] rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        style={{
          top: `${dropdownPosition.top}px`,
          left: `${dropdownPosition.left}px`,
          width: `${dropdownPosition.width}px`,
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        <div className="overflow-hidden py-1">
          <button
            onClick={() => handleAction(StockMovementType.POSITIVE_ADJUSTMENT)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <UpdateIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{t("levels.table.adjustStock")}</span>
          </button>
          <button
            onClick={() => handleAction(StockMovementType.TRANSFER)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ArrowRightIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{t("levels.table.transfer")}</span>
          </button>
          <button
            onClick={() => handleAction(StockMovementType.DAMAGE)}
            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">{t("levels.table.reportDamage")}</span>
          </button>
          {onViewHistory && (
            <>
              <div className="my-1 border-t border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => {
                  onViewHistory(row.id);
                  setIsOpen(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <ActivityLogIcon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {t("levels.table.viewHistory")}
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <div ref={buttonRef}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="h-8 w-8 p-0"
        >
          <DotsHorizontalIcon className="h-4 w-4" />
        </Button>
      </div>

      {typeof document !== "undefined" &&
        createPortal(dropdownContent, document.body)}

      {movementModalOpen && movementType && (
        <StockMovementModal
          isOpen={movementModalOpen}
          onClose={() => {
            setMovementModalOpen(false);
            setMovementType(null);
          }}
          onSuccess={() => {
            onStockMovementSuccess?.();
          }}
          initialData={getInitialDataForMovementType(movementType)}
        />
      )}
    </>
  );
}

export function StockLevelsTable({
  data,
  isLoading,
  pagination,
  onViewAllMovements,
  onStockMovementSuccess,
}: StockLevelsTableProps) {
  const { t } = useTranslation("stock");
  const { copy, hasCopied } = useClipboard();
  const { toast } = useToast();

  const handleCopySku = (sku: string | null | undefined) => {
    if (sku) {
      copy(sku);
    }
    toast({
      title: t("movements.toast.copied"),
      description: t("movements.toast.copiedDesc"),
      type: "success",
    });
  };

  const columns: ColumnDef<StockLevelWithRelations, any>[] = [
    {
      id: "product",
      header: t("levels.table.product"),
      cell: ({ row }) => {
        const variant = row.original.productVariant;
        const product = variant?.product || row.original.product;
        const sku = variant?.sku || product?.sku;
        return (
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {`${product?.name} - ${variant?.name}`}
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
              <span>
                {t("levels.table.sku")}: {sku || "—"}
              </span>
              {sku && (
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
                      ? t("movements.toast.copied") || "Copied!"
                      : "Copy SKU"
                  }
                >
                  {React.createElement(CopyIcon as any, {
                    className: `h-3 w-3 ${hasCopied ? "text-green-600" : "text-gray-500"}`,
                  })}
                  <span className="sr-only">Copy SKU</span>
                </Button>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "location",
      header: t("levels.table.location"),
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {row.original.location?.name || "—"}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {row.original.location?.locationType || ""}
          </div>
        </div>
      ),
    },
    {
      id: "quantity",
      header: t("levels.table.quantity"),
      cell: ({ row }) => (
        <span className="font-medium text-gray-900 dark:text-white">
          {Number(row.original.quantity).toFixed(2)}
        </span>
      ),
    },
    {
      id: "reserved",
      header: t("levels.table.reserved"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {Number(row.original.reserved).toFixed(2)}
        </span>
      ),
    },
    {
      id: "available",
      header: t("levels.table.available"),
      cell: ({ row }) => {
        const available =
          Number(row.original.quantity) - Number(row.original.reserved);
        return (
          <span
            className={`font-medium ${
              available > 0
                ? "text-green-600 dark:text-green-400"
                : available === 0
                  ? "text-gray-600 dark:text-gray-400"
                  : "text-red-600 dark:text-red-400"
            }`}
          >
            {available.toFixed(2)}
          </span>
        );
      },
    },
    {
      id: "updatedAt",
      header: t("levels.table.lastUpdated"),
      cell: ({ row }) => (
        <span className="text-gray-600 dark:text-gray-300">
          {new Date(row.original.updatedAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("levels.table.actions"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <DropdownMenu
            row={row.original}
            onViewHistory={onViewAllMovements}
            onStockMovementSuccess={onStockMovementSuccess}
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={data}
      columns={columns}
      loading={isLoading ?? false}
      empty={
        <div className="flex items-center justify-center py-10">
          <div className="text-gray-600 dark:text-gray-400">
            {t("levels.table.noData")}
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

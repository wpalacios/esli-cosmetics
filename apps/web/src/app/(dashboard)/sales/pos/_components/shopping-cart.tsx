"use client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/toast/use-toast";
import { useValidateDiscountCode } from "@/hooks/use-discount-codes";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmationDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  useConfirmationDialog,
} from "@esli-cosmetics/ui";
import { getProductImageSrc } from "@/lib/product-image-url";
import { CURRENCY_SIGN, useIsMobile } from "@esli-cosmetics/utils";
import Image from "next/image";
import React, { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  BiCart,
  BiCheckShield,
  BiChevronDown,
  BiChevronUp,
  BiErrorCircle,
  BiInfoCircle,
  BiMoney,
  BiPackage,
  BiSave,
  BiTag,
  BiTrash,
  BiX,
} from "react-icons/bi";
import { PiPercent } from "react-icons/pi";
import type { CartItem } from "../pos-page-client";

// Helper function to filter prices by customer's active price types
const filterPricesByCustomer = (
  prices: Array<{
    priceTypeId: string;
    priceTypeName: string;
    price: number;
    minQuantity: number;
    priority: number;
  }>,
  selectedCustomer?: ShoppingCartProps["selectedCustomer"]
): Array<{
  priceTypeId: string;
  priceTypeName: string;
  price: number;
  minQuantity: number;
  priority: number;
}> => {
  if (
    !selectedCustomer?.priceTypes ||
    selectedCustomer.priceTypes.length === 0
  ) {
    // If no customer or no price types, return all prices
    return prices;
  }

  // Get active price type IDs from customer
  const activePriceTypeIds = selectedCustomer.priceTypes
    .filter(pt => pt.isActive)
    .map(pt => pt.id);

  if (activePriceTypeIds.length === 0) {
    // If no active price types, return all prices
    return prices;
  }

  // Filter prices to only include those available to the customer
  return prices.filter(price => activePriceTypeIds.includes(price.priceTypeId));
};

interface ShoppingCartProps {
  items: CartItem[];
  onUpdateQuantity: (productVariantId: string, quantity: number) => void;
  onRemoveItem: (productVariantId: string) => void;
  onUpdateItemDiscount: (
    productVariantId: string,
    discountAmount: number
  ) => void;
  onUpdateItemDiscountPercentage: (
    productVariantId: string,
    discountPercentage: number
  ) => void;
  onUpdatePriceType?: (productVariantId: string, priceTypeId: string) => void;
  onCheckout: () => void;
  discountCode: string;
  onDiscountCodeChange: (code: string) => void;
  discountCodeInfo: {
    id: string;
    discountType: "PERCENTAGE" | "FIXED";
    value: number;
    maxDiscount?: number;
  } | null;
  onDiscountCodeInfoChange: (
    info: {
      id: string;
      discountType: "PERCENTAGE" | "FIXED";
      value: number;
      maxDiscount?: number;
    } | null
  ) => void;
  manualOrderDiscount: number;
  onManualOrderDiscountChange: (amount: number) => void;
  manualOrderDiscountPercentage: number;
  onManualOrderDiscountPercentageChange: (percentage: number) => void;
  includeTax: boolean;
  onIncludeTaxChange: (include: boolean) => void;
  totals: {
    subtotal: number;
    itemsDiscountTotal: number;
    orderDiscount: number;
    discountCodeValue: number;
    manualOrderDiscount: number;
    discountAmount: number;
    taxes: number;
    totalAmount: number;
  };
  customerId?: string;
  selectedCustomer?: {
    id: string;
    priceTypes?: Array<{
      id: string;
      name: string;
      minQuantity: number;
      priority: number;
      isActive: boolean;
    }>;
  } | null;
  onResetCart: () => void;
  checkoutButtonText?: string;
  showCancelButton?: boolean;
  isSubmitting?: boolean;
  /** When set, checkout / quote save actions stay disabled (e.g. insufficient stock). */
  stockValidationBlocked?: boolean;
  isQuoteMode?: boolean;
  quoteStatus?: string;
  onApproveQuote?: () => void;
}

const KitContentPopover = ({ item }: { item: CartItem }) => {
  const isMobile = useIsMobile();
  const [showQuoteOptions, setShowQuoteOptions] = useState(false);
  const [open, setOpen] = React.useState(false);
  const kitItems = item.kitItems || [];
  const { t } = useTranslation("pos");

  if (item.type !== "KIT" || kitItems.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="inline-flex cursor-pointer items-center gap-1"
          tabIndex={0}
          onClick={e => {
            e.stopPropagation();
            setOpen(prev => !prev);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen(prev => !prev);
            }
          }}
          aria-label={t("shoppingCart.kitContent") || "Contenido del Kit"}
        >
          <Badge
            variant="outline"
            className="h-5 border-gray-300 bg-gray-50 text-[10px] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <BiPackage className="mr-1 h-3 w-3 text-gray-400" />
            {t("shoppingCart.kitContent") || "KIT"}
          </Badge>
          <BiInfoCircle className="ml-1 h-4 w-4 text-gray-400" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        side={isMobile ? "bottom" : "right"}
        className="max-w-xs border border-purple-100 bg-white p-3 text-slate-800 shadow-xl dark:border-purple-800 dark:bg-gray-800 dark:text-gray-200"
        onClick={e => e.stopPropagation()}
      >
        <p
          className="mb-2 border-b border-purple-100 pb-1 text-xs font-semibold dark:border-purple-800"
          style={{ color: "#ff48b0" }}
        >
          {t("shoppingCart.kitContentDetails") || "Contenido del Kit:"}
        </p>
        <ul className="space-y-1">
          {kitItems.map((kitItem, idx) => (
            <li
              key={idx}
              className={`flex justify-between gap-4 text-xs ${
                kitItem.stockError ? "font-bold text-red-600" : ""
              }`}
              title={kitItem.stockError || ""}
            >
              <span>
                {kitItem.productVariant?.name || "Item"}
                {kitItem.stockError && (
                  <span
                    className="ml-1 text-red-500"
                    title={kitItem.stockError}
                  >
                    •
                  </span>
                )}
              </span>
              <span className="font-mono font-bold text-slate-500">
                x{kitItem.quantity}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

export function ShoppingCart({
  items,
  onUpdateQuantity,
  onRemoveItem,
  onUpdateItemDiscount,
  onUpdateItemDiscountPercentage,
  onUpdatePriceType,
  onCheckout,
  discountCode,
  onDiscountCodeChange,
  discountCodeInfo,
  onDiscountCodeInfoChange,
  manualOrderDiscount,
  onManualOrderDiscountChange,
  manualOrderDiscountPercentage,
  onManualOrderDiscountPercentageChange,
  includeTax,
  onIncludeTaxChange,
  totals,
  customerId,
  selectedCustomer,
  onResetCart,
  checkoutButtonText,
  showCancelButton = true,
  isSubmitting = false,
  stockValidationBlocked = false,
  isQuoteMode = false,
  quoteStatus,
  onApproveQuote,
}: ShoppingCartProps) {
  const { t } = useTranslation("pos");
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const confirmationDialog = useConfirmationDialog();

  /**
   * Determine if the quote is already approved.
   * If so, the "Save as Draft" action should not be available.
   */
  const isQuoteApproved = isQuoteMode && quoteStatus === "APPROVED";

  // Track which items have their discount section expanded (collapsed by default)
  const [expandedDiscountItems, setExpandedDiscountItems] = useState<
    Set<string>
  >(new Set());

  const toggleDiscountSection = (productVariantId: string) => {
    setExpandedDiscountItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productVariantId)) {
        newSet.delete(productVariantId);
      } else {
        newSet.add(productVariantId);
      }
      return newSet;
    });
  };
  const validateDiscountCodeMutation = useValidateDiscountCode();

  const handleValidateDiscountCode = async () => {
    if (!discountCode.trim()) {
      return;
    }

    try {
      const data = await validateDiscountCodeMutation.mutateAsync({
        code: discountCode,
        ...(customerId && { customerId }),
        orderAmount: totals.subtotal,
      });

      if (data.valid && data.discountCode) {
        // Store discount code info for dynamic calculation (including ID)
        onDiscountCodeInfoChange({
          id: data.discountCode.id,
          discountType: data.discountCode.discountType,
          value: data.discountCode.value,
          ...(data.discountCode.maxDiscount !== undefined && {
            maxDiscount: data.discountCode.maxDiscount,
          }),
        });
        toast({
          title: t("toast.discountCodeApplied"),
          description:
            data.discountCode.discountType === "PERCENTAGE"
              ? t("toast.discountCodeAppliedPercentage", {
                  value: data.discountCode.value,
                })
              : t("toast.discountCodeAppliedFixed", {
                  amount: (data.calculatedDiscount || 0).toFixed(2),
                }),
          type: "success",
        });
      } else {
        // Check if it's a usage limit exceeded error
        const isUsageLimitExceeded =
          data.message?.toLowerCase().includes("usage limit exceeded") ||
          data.message?.toLowerCase().includes("usage limit");

        if (isUsageLimitExceeded) {
          toast({
            title: t("toast.discountCodeUsageLimitExceeded"),
            description:
              t("toast.discountCodeUsageLimitExceededDescription") ||
              data.message ||
              t("toast.invalidDiscountCodeDescription"),
            type: "error",
          });
        } else {
          toast({
            title: t("toast.invalidDiscountCode"),
            description: t("toast.invalidDiscountCodeDescription"),
            type: "error",
          });
        }
      }
    } catch (error: any) {
      // Handle network errors or other exceptions
      const errorMessage = error?.message || "";
      const isUsageLimitExceeded =
        errorMessage.toLowerCase().includes("usage limit exceeded") ||
        errorMessage.toLowerCase().includes("usage limit");

      if (isUsageLimitExceeded) {
        // Clear the discount code input when usage limit is exceeded
        onDiscountCodeChange("");
        onDiscountCodeInfoChange(null);
        toast({
          title: t("toast.discountCodeUsageLimitExceeded"),
          description:
            t("toast.discountCodeUsageLimitExceededDescription") ||
            errorMessage ||
            t("toast.invalidDiscountCodeDescription"),
          type: "error",
        });
      } else {
        toast({
          title: t("toast.error"),
          description: errorMessage || t("toast.failedToValidateDiscountCode"),
          type: "error",
        });
      }
    }
  };

  const renderCheckoutFooterActions = (): ReactNode => {
    if (!isQuoteMode) {
      return (
        <Button
          className="h-12 w-full bg-gradient-to-r from-[#ff48b0] to-[#f5b1cc] text-lg font-bold shadow-md hover:opacity-90"
          onClick={onCheckout}
          disabled={
            items.length === 0 ||
            !customerId ||
            isSubmitting ||
            stockValidationBlocked
          }
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {t("shoppingCart.processing")}
            </div>
          ) : (
            checkoutButtonText || t("shoppingCart.checkout")
          )}
        </Button>
      );
    }

    if (quoteStatus === "APPROVED" || quoteStatus === "CONVERTED") {
      return (
        <Button
          onClick={onCheckout}
          disabled={
            items.length === 0 ||
            !customerId ||
            isSubmitting ||
            stockValidationBlocked ||
            quoteStatus === "CONVERTED"
          }
          className="flex h-12 w-full items-center justify-center gap-2 bg-gradient-to-r from-[#ff48b0] to-[#f5b1cc] text-lg font-bold shadow-md transition-all hover:opacity-90 active:scale-[0.95]"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {t("shoppingCart.processing")}
            </div>
          ) : (
            <>
              <BiSave className="h-5 w-5" />
              {t("quoteActions.save") || "Guardar Cambios"}
            </>
          )}
        </Button>
      );
    }

    // if (isMobile) {
    //   return (
    //     <Button
    //       onClick={onCheckout}
    //       disabled={
    //         items.length === 0 ||
    //         !customerId ||
    //         isSubmitting ||
    //         stockValidationBlocked
    //       }
    //       className="flex h-12 w-full items-center justify-center gap-2 bg-blue-600 text-base font-bold text-white shadow-md transition-all hover:bg-blue-700 active:scale-95"
    //     >
    //       <BiSave className="h-5 w-5" />
    //       {t("quoteActions.saveDraft")}
    //     </Button>
    //   );
    // }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={
              items.length === 0 ||
              !customerId ||
              isSubmitting ||
              stockValidationBlocked
            }
            className="flex h-12 w-full items-center justify-center gap-2 bg-gradient-to-r from-[#ff48b0] to-[#f5b1cc] text-lg font-bold shadow-md hover:opacity-90"
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                {t("quoteActions.save") || "Opciones"}
                <BiChevronDown className="ml-1 h-6 w-6 border-l border-white/20 pl-1" />
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[var(--radix-dropdown-menu-trigger-width)] border-gray-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-800"
        >
          <DropdownMenuItem
            onClick={onCheckout}
            className="flex cursor-pointer items-center gap-3 p-3"
          >
            <BiSave className="h-5 w-5 text-blue-500" />{" "}
            {t("quoteActions.saveDraft")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={async () => {
              const confirmed = await confirmationDialog.openDialog({
                title: t("quoteActions.approveAndReserveDialogTitle"),
                description: t(
                  "quoteActions.approveAndReserveDialogDescription"
                ),
                confirmText: t("quoteActions.approveAndReserveConfirm"),
                cancelText: t("common.cancel"),
                variant: "info",
              });
              if (confirmed) onApproveQuote?.();
            }}
            className="flex cursor-pointer items-center gap-3 p-3"
          >
            <BiCheckShield className="h-5 w-5 text-green-600" />{" "}
            {t("quoteActions.approveAndReserve")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b bg-white/80 px-6 pt-4 backdrop-blur-sm dark:bg-gray-800/80">
        <div className="mb-1 flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <BiCart className="h-5 w-5 text-[#ff48b0]" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("shoppingCart.title")}
            </h2>
          </div>
          <Badge variant="secondary" className="text-md">
            {items.length}{" "}
            {items.length === 1
              ? t("shoppingCart.item")
              : t("shoppingCart.items")}
          </Badge>
        </div>
      </div>

      {/* Scrollable Content - Cart Items and Totals/Checkout */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <BiCart className="mb-4 h-16 w-16 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                {t("shoppingCart.empty")}
              </h3>
              <p className="text-md text-muted-foreground">
                {t("shoppingCart.emptyDescription")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map(item => {
                const hasStockError =
                  item.quantity > item.availableStock || item.stockError;
                const itemSubtotal = item.price * item.quantity;
                const finalPrice = itemSubtotal - (item.discountAmount || 0);
                const hasDiscount =
                  (item.discountAmount || 0) > 0 ||
                  (item.discountPercentage || 0) > 0;

                // Detect if this item is a KIT
                const isKit =
                  item.type === "KIT" &&
                  Array.isArray(item.kitItems) &&
                  item.kitItems.length > 0;

                return (
                  <div
                    key={item.productVariantId}
                    className={`group relative rounded-xl border bg-white transition-all duration-200 hover:shadow-md dark:bg-gray-800 ${
                      hasStockError
                        ? "border-2 border-red-500 bg-red-50/50 shadow-red-500/10 dark:bg-red-950/30"
                        : "border-gray-200 shadow-sm hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                    }`}
                  >
                    {/* Stock Error Badge */}
                    {hasStockError && (
                      <div className="absolute -right-2.5 -top-2.5 z-10">
                        <div className="flex animate-pulse items-center gap-1.5 rounded-full bg-red-500 px-3 py-1.5 text-sm font-semibold text-white shadow-lg">
                          <BiErrorCircle className="h-3.5 w-3.5" />
                          <span>
                            {t("errors.insufficientStockAtCheckout")} -{" "}
                            {t("shoppingCart.available")}: {item.availableStock}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Header Section */}
                    <div className="border-b border-gray-100 p-4 pb-3 dark:border-gray-700">
                      <div className="flex items-start justify-between gap-3">
                        {item.image && (
                          <div className="relative flex size-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-pink-50/80 to-purple-50/80 p-1.5 dark:from-pink-900/20 dark:to-purple-900/20">
                            {/* eslint-disable-next-line @next/next/no-img-element -- Proxied to avoid ERR_BLOCKED_BY_ORB */}
                            <img
                              src={getProductImageSrc(item.image)}
                              alt=""
                              className="max-h-full max-w-full rounded-lg object-contain"
                            />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4
                              className={`mb-1 text-base font-semibold leading-tight ${
                                hasStockError
                                  ? "text-red-700 dark:text-red-400"
                                  : "text-gray-900 dark:text-gray-100"
                              }`}
                            >
                              {item.name} {""}
                              {/* KIT POPOVER INTEGRATION */}
                              {isKit && <KitContentPopover item={item} />}
                            </h4>
                          </div>
                          {item.brand && (
                            <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                              {typeof item.brand === "object"
                                ? (item.brand as any).name
                                : item.brand}
                              {item.sku && ` • ${item.sku}`}
                              {item.barcode && ` • ${item.barcode}`}
                            </p>
                          )}
                          {item.multiple && item.multiple > 0 && (
                            <Badge
                              variant="secondary"
                              className="mt-2 border-blue-200 bg-blue-50 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                            >
                              {t("shoppingCart.soldInMultiples", {
                                multiple: item.multiple,
                              })}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 flex-shrink-0 p-0 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                          onClick={() => onRemoveItem(item.productVariantId)}
                          aria-label="Remove item"
                        >
                          <BiTrash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className="space-y-4 p-4">
                      {/* Quantity and Price Type Selector Row */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {t("shoppingCart.quantity") || "Quantity"}
                          </label>
                          <NumberInput
                            value={item.quantity}
                            onChange={value =>
                              onUpdateQuantity(item.productVariantId, value)
                            }
                            className="w-full"
                            min={
                              item.multiple && item.multiple > 0
                                ? item.multiple
                                : 1
                            }
                            max={item.availableStock}
                            step={
                              item.multiple && item.multiple > 0
                                ? item.multiple
                                : 1
                            }
                            placeholder={item.quantity.toString()}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">
                            {t("productSearch.priceType") || "Price Type"}
                          </label>
                          {(() => {
                            const availablePrices = item.productPrices
                              ? filterPricesByCustomer(
                                  item.productPrices,
                                  selectedCustomer
                                )
                              : [];
                            return availablePrices.length > 0 &&
                              onUpdatePriceType ? (
                              <Select
                                value={
                                  item.priceTypeId ||
                                  availablePrices[0]?.priceTypeId ||
                                  ""
                                }
                                onValueChange={value => {
                                  onUpdatePriceType(
                                    item.productVariantId,
                                    value
                                  );
                                }}
                              >
                                <SelectTrigger className="h-10 w-full rounded-xl border-gray-300 bg-white text-sm text-gray-900 hover:border-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:border-gray-500">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
                                  {availablePrices
                                    .sort(
                                      (a, b) =>
                                        (a.priority || 999) -
                                        (b.priority || 999)
                                    )
                                    .map(price => (
                                      <SelectItem
                                        key={price.priceTypeId}
                                        value={price.priceTypeId}
                                        className="text-sm text-gray-900 dark:text-gray-100"
                                      >
                                        {price.priceTypeName}
                                        {price.minQuantity > 1 &&
                                          ` (${t("header.minQuantity", { quantity: price.minQuantity })})`}
                                        {" - "}
                                        {CURRENCY_SIGN}
                                        {price.price?.toFixed(2) || "0.00"}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            ) : item.priceTypeId && item.productPrices ? (
                              <div className="flex h-9 items-center">
                                <Badge
                                  variant="secondary"
                                  className="border-[#ff48b0]/20 bg-[#ff48b0]/10 text-sm text-[#ff48b0]"
                                >
                                  {item.productPrices.find(
                                    p => p.priceTypeId === item.priceTypeId
                                  )?.priceTypeName || "Price"}
                                </Badge>
                              </div>
                            ) : (
                              <div className="h-9" />
                            );
                          })()}
                        </div>
                      </div>

                      {/* Unit Price and Total Price Row */}
                      <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-2 dark:border-gray-700">
                        <div>
                          <p className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
                            {t("shoppingCart.unitPrice") || "Unit Price"}
                          </p>
                          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {CURRENCY_SIGN}
                            {item.price?.toFixed(2) || "0.00"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="mb-1.5 text-sm font-medium text-gray-500 dark:text-gray-400">
                            {t("shoppingCart.total") || "Total"}
                          </p>
                          <div className="space-y-0.5">
                            {hasDiscount ? (
                              <>
                                <p className="text-sm text-gray-400 line-through dark:text-gray-500">
                                  {CURRENCY_SIGN}
                                  {itemSubtotal.toFixed(2)}
                                </p>
                                <p className="text-lg font-bold text-[#ff48b0]">
                                  {CURRENCY_SIGN}
                                  {finalPrice.toFixed(2)}
                                </p>
                              </>
                            ) : (
                              <p className="text-lg font-bold text-[#ff48b0]">
                                {CURRENCY_SIGN}
                                {itemSubtotal.toFixed(2)}
                              </p>
                            )}
                          </div>
                          {item.quantity >= item.availableStock &&
                            !hasStockError && (
                              <p className="mt-1 text-sm font-medium text-amber-600 dark:text-amber-400">
                                {t("shoppingCart.maxStock")}
                              </p>
                            )}
                        </div>
                      </div>

                      {/* Item Discount Section */}
                      <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() =>
                            toggleDiscountSection(item.productVariantId)
                          }
                          className="mb-3 flex w-full items-center justify-between gap-2 text-sm font-semibold text-gray-700 transition-colors hover:text-[#ff48b0] dark:text-gray-300"
                        >
                          <div className="flex items-center gap-2">
                            <BiTag className="h-4 w-4 text-[#ff48b0]" />
                            {t("shoppingCart.itemDiscount")}
                          </div>
                          {expandedDiscountItems.has(item.productVariantId) ? (
                            <BiChevronUp className="h-4 w-4" />
                          ) : (
                            <BiChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        {expandedDiscountItems.has(item.productVariantId) && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <PiPercent className="h-4 w-4 text-gray-400" />
                                <label className="text-sm text-gray-500 dark:text-gray-400">
                                  {t("shoppingCart.itemDiscountPercent") || "%"}
                                </label>
                              </div>
                              <NumberInput
                                placeholder="0"
                                value={item.discountPercentage || 0}
                                onChange={value =>
                                  onUpdateItemDiscountPercentage(
                                    item.productVariantId,
                                    value
                                  )
                                }
                                className="h-9"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <BiMoney className="h-4 w-4 text-gray-400" />
                                <label className="text-sm text-gray-500 dark:text-gray-400">
                                  {t("shoppingCart.itemDiscountAmount") ||
                                    "Amount"}
                                </label>
                              </div>
                              <NumberInput
                                placeholder="0.00"
                                value={item.discountAmount || 0}
                                onChange={value =>
                                  onUpdateItemDiscount(
                                    item.productVariantId,
                                    value
                                  )
                                }
                                className="h-9"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer - Totals and Checkout - Below items */}
        <div className="space-y-4 border-t bg-white/90 p-6 backdrop-blur-sm dark:bg-gray-800/90">
          {/* Discount Code */}
          <div className="space-y-2">
            <Label className="text-md flex items-center gap-2 font-medium">
              <BiTag className="h-4 w-4" />
              {t("shoppingCart.discountCode")}
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder={t("shoppingCart.enterCode")}
                value={discountCode}
                onChange={e => {
                  onDiscountCodeChange(e.target.value);
                  // Clear discount code info when code is cleared
                  if (!e.target.value.trim()) {
                    onDiscountCodeInfoChange(null);
                  }
                }}
                className="h-9"
              />
              {discountCodeInfo ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onDiscountCodeInfoChange(null);
                    onDiscountCodeChange("");
                  }}
                  className="whitespace-nowrap text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <BiX className="mr-1 h-4 w-4" />
                  {t("shoppingCart.remove")}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleValidateDiscountCode}
                  disabled={
                    !discountCode.trim() ||
                    validateDiscountCodeMutation.isPending
                  }
                  className="whitespace-nowrap"
                >
                  {validateDiscountCodeMutation.isPending
                    ? t("shoppingCart.validating")
                    : t("shoppingCart.apply")}
                </Button>
              )}
            </div>
            {discountCodeInfo && totals.orderDiscount > manualOrderDiscount && (
              <p className="text-sm text-green-600">
                {t("shoppingCart.codeDiscount")}{" "}
                {discountCodeInfo.discountType === "PERCENTAGE"
                  ? `${discountCodeInfo.value}% (${CURRENCY_SIGN}${(
                      totals.orderDiscount - manualOrderDiscount
                    ).toFixed(2)})`
                  : `${CURRENCY_SIGN}${(
                      totals.orderDiscount - manualOrderDiscount
                    ).toFixed(2)}`}
              </p>
            )}
          </div>

          {/* Manual Discount */}
          <div className="space-y-2">
            <Label className="text-md flex items-center gap-2 font-medium">
              <BiTag className="h-4 w-4" />
              {t("shoppingCart.manualDiscount")}
            </Label>
            <div className="flex items-center gap-2">
              <PiPercent className="size-4 text-muted-foreground" />
              <NumberInput
                placeholder="0.00"
                value={manualOrderDiscountPercentage || 0}
                onChange={onManualOrderDiscountPercentageChange}
                className="h-9 flex-1"
              />
              <BiMoney className="size-4 text-muted-foreground" />
              <NumberInput
                placeholder="0.00"
                value={manualOrderDiscount || 0}
                onChange={onManualOrderDiscountChange}
                className="h-9 flex-1"
              />
            </div>
          </div>

          {/* Include Tax */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="include-tax"
              checked={includeTax}
              onCheckedChange={onIncludeTaxChange}
            />
            <Label htmlFor="include-tax" className="text-md cursor-pointer">
              {t("shoppingCart.includeTax")}
            </Label>
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="text-md flex justify-between text-gray-900 dark:text-gray-100">
              <span className="text-muted-foreground">
                {t("shoppingCart.subtotal")}
              </span>
              <span>
                {CURRENCY_SIGN}
                {totals.subtotal.toFixed(2)}
              </span>
            </div>

            {/* Items Discount Total */}
            {totals.itemsDiscountTotal > 0 && (
              <div className="text-md flex justify-between text-green-600">
                <span>{t("shoppingCart.itemsDiscountTotal")}</span>
                <span>
                  -{CURRENCY_SIGN}
                  {totals.itemsDiscountTotal.toFixed(2)}
                </span>
              </div>
            )}

            {/* Discount Code Value */}
            {totals.discountCodeValue !== undefined &&
              totals.discountCodeValue !== null &&
              totals.discountCodeValue > 0 && (
                <div className="text-md flex justify-between text-green-600">
                  <span>{t("shoppingCart.discountCodeValue")}</span>
                  <span>
                    -{CURRENCY_SIGN}
                    {totals.discountCodeValue.toFixed(2)}
                  </span>
                </div>
              )}

            {/* Manual Order Discount */}
            {totals.manualOrderDiscount !== undefined &&
              totals.manualOrderDiscount !== null &&
              totals.manualOrderDiscount > 0 && (
                <div className="text-md flex justify-between text-green-600">
                  <span>{t("shoppingCart.manualOrderDiscount")}</span>
                  <span>
                    -{CURRENCY_SIGN}
                    {totals.manualOrderDiscount.toFixed(2)}
                  </span>
                </div>
              )}

            {/* Total Discount */}
            {totals.discountAmount > 0 && (
              <div className="text-md flex justify-between font-semibold text-green-700">
                <span>{t("shoppingCart.totalDiscount")}</span>
                <span>
                  -{CURRENCY_SIGN}
                  {totals.discountAmount.toFixed(2)}
                </span>
              </div>
            )}

            {includeTax && (
              <div className="text-md flex justify-between text-gray-900 dark:text-gray-100">
                <span className="text-muted-foreground">
                  {t("shoppingCart.tax")}
                </span>
                <span>
                  {CURRENCY_SIGN}
                  {totals.taxes.toFixed(2)}
                </span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-gray-100">
              <span>{t("shoppingCart.total")}</span>
              <span className="text-[#ff48b0]">
                {CURRENCY_SIGN}
                {totals.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Checkout Button */}
          {!customerId && (
            <p className="text-md text-red-500">
              {t("shoppingCart.pleaseSelectCustomer")}
            </p>
          )}
          {/* Show warning if items have insufficient stock */}
          {items.some(
            item => item.quantity > item.availableStock || item.stockError
          ) && (
            <p className="text-md mb-2 text-red-500">
              {t("errors.insufficientStockAtCheckoutGeneric") ||
                "One or more items have insufficient stock. Please adjust quantities before checkout."}
            </p>
          )}
          {/* Footer - Totals and Checkout */}
          <div className="space-y-3">
            {renderCheckoutFooterActions()}

            {/* CANCEL BUTTON for POS mode */}
            {showCancelButton && !isQuoteMode && (
              <Button
                variant="outline"
                className="h-12 w-full border-red-500 text-lg font-semibold text-red-600 transition-all hover:bg-red-50 active:scale-95 dark:hover:bg-red-950/30"
                onClick={onResetCart}
                disabled={items.length === 0 || isSubmitting}
              >
                {t("shoppingCart.cancelSale")}
              </Button>
            )}

            <ConfirmationDialog
              {...confirmationDialog.dialogProps}
              description={confirmationDialog.dialogProps.description || ""}
              confirmText={
                confirmationDialog.dialogProps.confirmText ||
                t("common.confirm") ||
                "Confirmar"
              }
              cancelText={
                confirmationDialog.dialogProps.cancelText ||
                t("common.cancel") ||
                "Cancelar"
              }
              variant={
                (confirmationDialog.dialogProps.variant as
                  | "warning"
                  | "destructive"
                  | "info") || "info"
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

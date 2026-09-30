"use client";

import Image from "next/image";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSearchProductVariants } from "@/hooks/use-product-variants";
import {
  useKitStockByLocation,
  useStockLevelsByProductVariant,
} from "@/hooks/use-stock-levels";
import type {
  POSKitItem,
  POSProductVariant,
  POSProductVariantPrice,
  POSStockLevel,
  StockStatus,
} from "@esli-cosmetics/types";
import {
  Badge,
  Button,
  ConfirmationDialog,
  SearchInput,
} from "@esli-cosmetics/ui";
import { NumberInput } from "@/components/ui/number-input";
import { getProductImageSrc } from "@/lib/product-image-url";
import {
  cn,
  selectPriceForQuantity,
  CURRENCY_SIGN,
  useIsMobile,
} from "@esli-cosmetics/utils";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BiBarcode,
  BiGridAlt,
  BiListUl,
  BiPackage,
  BiSearch,
  BiStore,
} from "react-icons/bi";
import { FaSearchLocation } from "react-icons/fa";
import { ProductType } from "@esli-cosmetics/types";
import { BiInfoCircle } from "react-icons/bi";
import { CartItem, normalizeProductWithMetadata } from "../pos-page-client";

interface ProductSearchProps {
  onAddToCart: (
    product: POSProductVariant,
    quantity?: number,
    priceTypeId?: string
  ) => void;
  locationId: string | undefined;
  selectedCustomer: {
    id: string;
    priceTypes?: Array<{
      id: string;
      name: string;
      minQuantity: number;
      priority: number;
      isActive: boolean;
    }>;
  } | null;
  hasCashSession?: boolean;
  cartItems: CartItem[];
}

type ViewMode = "grid" | "list";

type ExtendedCartItem = CartItem & {
  kitItems?: POSKitItem[];
  product?: {
    type?: string | ProductType;
    kitItems?: POSKitItem[];
  };
};

// calculate kit available stock per item
export function getKitAvailableStock(
  product: POSProductVariant,
  cartItems: CartItem[] = [],
  stockMap?: Map<string, number>
): number | null {
  const productType = product.product?.type as string;

  if (productType !== ProductType.KIT && productType !== "KIT") return null;
  if (!product.product?.kitItems || product.product.kitItems.length === 0)
    return null;

  const stocks = product.product.kitItems.map(targetComponent => {
    const componentId = targetComponent.productVariantId;
    const qtyPerTargetKit = Math.max(1, Number(targetComponent.quantity || 1));

    const totalComponentUsedInCart = cartItems.reduce((sum, cartItem) => {
      const itemData = cartItem as ExtendedCartItem;

      if (itemData.productVariantId === componentId) {
        return sum + Number(itemData.quantity || 0);
      }

      const itemType = itemData.product?.type;
      const isItemKit = itemType === ProductType.KIT || itemType === "KIT";
      const itemKitItems = itemData.kitItems || itemData.product?.kitItems;

      if (isItemKit && itemKitItems?.length) {
        const componentInKit = itemKitItems.find(
          k => k.productVariantId === componentId
        );

        if (componentInKit) {
          return (
            sum +
            Number(itemData.quantity || 0) *
              Number(componentInKit.quantity || 1)
          );
        }
      }

      return sum;
    }, 0);

    const fromMap = stockMap?.get(componentId);
    const dbStockAvailable =
      typeof fromMap === "number"
        ? fromMap
        : (targetComponent.productVariant?.stockLevel?.available ?? 0);

    const remainingComponentStock = Math.max(
      0,
      Number(dbStockAvailable || 0) - totalComponentUsedInCart
    );

    return Math.floor(remainingComponentStock / qtyPerTargetKit);
  });

  if (stocks.length === 0) return null;
  return Math.max(0, Math.min(...stocks));
}

// Stock Availability Component
const StockAvailabilityPopover = ({
  product,
}: {
  product: POSProductVariant;
}) => {
  const { t } = useTranslation("pos");
  const [isOpen, setIsOpen] = useState(false);
  const productType = product.product?.type;
  const isKit = productType === ProductType.KIT;

  const { kitsPerLocation = [], isLoading: isKitLoading } =
    useKitStockByLocation(isKit ? product.id : null, isKit && isOpen);

  const { data: stockLevels = [], isLoading: isStandardLoading } =
    useStockLevelsByProductVariant(!isKit && isOpen ? product.id : null);

  const isLoading = isKit ? isKitLoading : isStandardLoading;

  // Only show "Location" and "Available" for kits
  const TableHeader = () =>
    isKit ? (
      <div className="-mx-4 grid grid-cols-2 gap-1 px-4 pb-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:text-[10px]">
        <div>{t("productSearch.location") || "Ubicación"}</div>
        <div className="text-center">
          {t("productSearch.available") || "Disponible."}
        </div>
      </div>
    ) : (
      <div className="-mx-4 grid grid-cols-12 gap-2 border-b px-4 pb-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground sm:gap-3 sm:text-[10px]">
        <div className="col-span-5 sm:col-span-6">
          {t("productSearch.location") || "Ubicación"}
        </div>
        <div className="col-span-2 text-center">
          {t("productSearch.total") || "Total"}
        </div>
        <div className="col-span-2 text-center">
          {t("productSearch.reserved") || "Reservado."}
        </div>
        <div className="col-span-3 text-center sm:col-span-2">
          {t("productSearch.available") || "Disponible."}
        </div>
      </div>
    );

  let stockContent: React.ReactNode;

  if (isLoading) {
    stockContent = (
      <div className="flex items-center justify-center py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-[#ff48b0]" />
      </div>
    );
  } else {
    const displayData = isKit
      ? kitsPerLocation.map(k => ({
          id: k.locationId,
          name: k.locationName,
          available: k.kitsAvailable,
        }))
      : stockLevels.map(sl => ({
          id: sl.id,
          name: sl.location?.name,
          total: Number(sl.quantity || 0),
          reserved: Number(sl.reserved || 0),
          available: Number(sl.quantity || 0) - Number(sl.reserved || 0),
        }));

    if (displayData.length === 0) {
      stockContent = (
        <p className="py-6 text-center text-sm italic text-muted-foreground">
          {t("productSearch.noStockInLocations")}
        </p>
      );
    } else {
      stockContent = (
        <div className="space-y-1">
          <TableHeader />
          <div className="custom-scrollbar max-h-60 overflow-y-auto pr-1 pt-1 sm:max-h-80">
            {displayData.map(item =>
              isKit ? (
                <div
                  key={item.id}
                  className="grid grid-cols-2 items-center gap-1 rounded-sm border-b border-slate-100 py-2 text-[11px] transition-colors last:border-0 hover:bg-slate-50/50 dark:border-gray-700 dark:hover:bg-gray-800/50 sm:text-xs"
                >
                  <div
                    className="truncate font-medium text-slate-700 dark:text-gray-300"
                    title={item.name}
                  >
                    {item.name || t("productSearch.unknownLocation")}
                  </div>
                  <div className="flex justify-center">
                    <div className="min-w-[28px] rounded-md bg-green-500 px-2 py-0.5 text-center font-bold text-white">
                      {item.available}
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="grid grid-cols-12 items-center gap-2 rounded-sm border-b border-slate-100 py-2.5 text-[11px] transition-colors last:border-0 hover:bg-slate-50/50 dark:border-gray-700 dark:hover:bg-gray-800/50 sm:gap-3 sm:text-xs"
                >
                  <div
                    className="col-span-5 truncate font-medium text-slate-700 dark:text-gray-300 sm:col-span-6"
                    title={item.name}
                  >
                    {item.name || t("productSearch.unknownLocation")}
                  </div>
                  {/* STANDARD ONLY */}
                  {!isKit && (
                    <>
                      <div className="col-span-2 flex flex-col items-center">
                        <div className="min-w-[20px] rounded-md bg-gray-100 px-1.5 py-0.5 text-center font-semibold text-black dark:bg-gray-700 dark:text-white sm:min-w-[24px] sm:px-2">
                          {"total" in item ? item.total : "-"}
                        </div>
                      </div>
                      <div className="col-span-2 flex flex-col items-center">
                        <div className="min-w-[20px] rounded-md bg-amber-50 px-1.5 py-0.5 text-center font-semibold text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 sm:min-w-[24px] sm:px-2">
                          {"reserved" in item ? item.reserved : "-"}
                        </div>
                      </div>
                    </>
                  )}
                  <div className="col-span-3 flex justify-center sm:col-span-2">
                    <div className="min-w-[20px] rounded-md bg-green-500 px-1.5 py-0.5 text-center font-bold text-white sm:min-w-[24px] sm:px-2">
                      {item.available}
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      );
    }
  }

  return (
    <TooltipProvider>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="xs"
                leftIcon={
                  <FaSearchLocation className="h-4 w-4 text-gray-500 hover:text-[#ff48b0]" />
                }
                onClick={e => e.stopPropagation()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border-[#ff48b0]/20 p-0 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              />
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t("productSearch.seeAvailabilityInAllLocations")}</p>
          </TooltipContent>
        </Tooltip>

        <PopoverContent
          className="w-[92vw] max-w-[450px] border-slate-200 p-4 shadow-2xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800"
          align="center"
          side="bottom"
          onClick={e => e.stopPropagation()}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 pb-2">
                <div className="h-5 w-1.5 rounded-full bg-[#ff48b0]" />
                <h4 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                  {t("productSearch.inventory") || "Inventario"}
                </h4>
              </div>
            </div>
            {stockContent}
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
};

// Helper function to get stock status
const getStockStatus = (
  stockLevel: POSStockLevel | null | undefined,
  minimumStock: number | null | undefined,
  t: ReturnType<typeof useTranslation<"pos">>["t"]
): StockStatus => {
  if (!stockLevel) {
    return {
      status: "out",
      color: "bg-red-500",
      text: t("productSearch.outOfStock"),
    };
  }

  const available = stockLevel.available || 0;
  if (available === 0) {
    return {
      status: "out",
      color: "bg-red-500",
      text: t("productSearch.outOfStock"),
    };
  }

  // Use minimumStock from ProductVariant, fallback to 10 if not set
  const minStockThreshold = minimumStock ?? 10;

  if (available < minStockThreshold) {
    return {
      status: "low",
      color: "bg-yellow-500",
      text: t("productSearch.lowStock", { quantity: available }),
    };
  } else {
    return {
      status: "in",
      color: "bg-green-500",
      text: t("productSearch.inStock", { quantity: available }),
    };
  }
};

// Function to select the appropriate price based on customer price types and quantity
// Uses shared utility function for consistent logic across POS and Quotes
const selectPrice = (
  product: POSProductVariant,
  selectedCustomer: {
    id: string;
    priceTypes?: Array<{
      id: string;
      name: string;
      minQuantity: number;
      priority: number;
      isActive: boolean;
    }>;
  } | null,
  quantity: number = 1
): POSProductVariantPrice | null => {
  if (!product.prices || product.prices.length === 0) {
    return null;
  }

  // Use shared utility function for consistent price selection logic
  return selectPriceForQuantity(
    product.prices,
    quantity,
    selectedCustomer
  ) as POSProductVariantPrice | null;
};

interface ProductGridItemProps {
  product: POSProductVariant;
  onAddToCart: (
    product: POSProductVariant,
    quantity?: number,
    priceTypeId?: string
  ) => void;
  selectedCustomer: {
    id: string;
    priceTypes?: Array<{
      id: string;
      name: string;
      minQuantity: number;
      priority: number;
      isActive: boolean;
    }>;
  } | null;
  isMobile?: boolean;
  cartItems: CartItem[];
}

// Helper function to filter prices by customer's active price types
const filterPricesByCustomer = (
  prices: POSProductVariantPrice[],
  selectedCustomer: ProductSearchProps["selectedCustomer"]
): POSProductVariantPrice[] => {
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

// [KIT INTEGRATION] tooltip to show kit contents
const KitContentPopover = ({ product }: { product: POSProductVariant }) => {
  const { t } = useTranslation("pos");
  const kitItems = product.product?.kitItems || [];
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (kitItems.length === 0) return null;

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
          aria-label={t("productSearch.kitContents") || "Contenido del Kit"}
        >
          <Badge
            variant="outline"
            className="h-5 border-gray-300 bg-gray-50 text-[10px] text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
          >
            <BiPackage className="mr-1 h-3 w-3 text-gray-400" />
            KIT
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
          {t("productSearch.kitContents") || "Contenido del Kit:"}
        </p>
        <ul className="space-y-1">
          {kitItems.map((item, idx) => (
            <li key={idx} className="flex justify-between gap-4 text-xs">
              <span>{item.productVariant?.name || "Item"}</span>
              <span className="font-mono font-bold text-slate-500">
                x{item.quantity}
              </span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

const ProductGridItem = ({
  product,
  onAddToCart,
  selectedCustomer,
  isMobile = false,
  cartItems,
}: ProductGridItemProps) => {
  const { t } = useTranslation("pos");

  const productType = product.product?.type as string;
  const isKit = productType === ProductType.KIT || productType === "KIT";

  const kitAvailableStock = isKit
    ? getKitAvailableStock(product, cartItems)
    : null;

  // Use a single const for availableStock, choosing between kit stock or regular stock
  const availableStock = isKit
    ? (kitAvailableStock ?? 0)
    : (product.stockLevel?.available ?? 0);

  const stockStatus = isKit
    ? getStockStatus(
        kitAvailableStock !== null
          ? {
              available: kitAvailableStock,
              quantity: kitAvailableStock,
              reserved: 0,
            }
          : null,
        product.minimumStock,
        t
      )
    : getStockStatus(product.stockLevel, product.minimumStock, t);

  const productMultiple = (product as any).multiple as
    | number
    | null
    | undefined;
  const [quantity, setQuantity] = useState<number>(() => {
    // Initialize with product multiple if available, otherwise 1
    return productMultiple && productMultiple > 0 ? productMultiple : 1;
  });

  // Get initial selected price type
  const initialSelectedPrice = selectPrice(product, selectedCustomer, quantity);
  const [selectedPriceTypeId, setSelectedPriceTypeId] = useState<
    string | undefined
  >(
    () => initialSelectedPrice?.priceTypeId || product.prices?.[0]?.priceTypeId
  );

  const handleQuantityChange = (value: number) => {
    let newQuantity = value;

    // Validate against available stock
    if (newQuantity > availableStock) {
      newQuantity = availableStock;
    }

    // Validate against product multiple
    if (productMultiple && productMultiple > 0) {
      // Round down to nearest multiple
      newQuantity = Math.floor(newQuantity / productMultiple) * productMultiple;
      // Ensure at least one multiple
      if (newQuantity < productMultiple) {
        newQuantity = productMultiple;
      }
    }

    // Ensure minimum of 1
    if (newQuantity < 1) {
      newQuantity = 1;
    }

    setQuantity(newQuantity);
  };

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      onAddToCart(product, quantity, selectedPriceTypeId);
    } else {
      onAddToCart(product);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isMobile) {
        onAddToCart(product, quantity, selectedPriceTypeId);
      } else {
        onAddToCart(product);
      }
    }
  };

  // Update selected price when quantity changes
  useEffect(() => {
    if (isMobile && product.prices && product.prices.length > 0) {
      const newSelectedPrice = selectPrice(product, selectedCustomer, quantity);
      if (newSelectedPrice) {
        setSelectedPriceTypeId(newSelectedPrice.priceTypeId);
      }
    }
  }, [quantity, product, selectedCustomer, isMobile]);

  return (
    <div
      role={isMobile ? undefined : "button"}
      tabIndex={isMobile ? undefined : 0}
      className={cn(
        "group overflow-hidden rounded-xl border bg-white transition-shadow dark:border-gray-700 dark:bg-gray-800",
        !isMobile &&
          "cursor-pointer hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#ff48b0]/50"
      )}
      onClick={!isMobile ? () => onAddToCart(product) : undefined}
      onKeyDown={!isMobile ? handleKeyDown : undefined}
    >
      <div className="px-3 py-3 md:px-6 md:py-4">
        {/* Product Image - e-commerce style: square, contained so full product is visible */}
        <div className="relative mb-3 flex aspect-square min-h-0 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-pink-50/90 to-purple-50/90 p-4 dark:from-pink-900/20 dark:to-purple-900/20">
          {(product.product as any)?.primaryImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- Proxied to avoid ERR_BLOCKED_BY_ORB
            <img
              src={getProductImageSrc((product.product as any).primaryImageUrl)}
              alt={product.name || ""}
              className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain"
            />
          ) : (product.product as any)?.images?.[0]?.url ? (
            // eslint-disable-next-line @next/next/no-img-element -- Proxied to avoid ERR_BLOCKED_BY_ORB
            <img
              src={getProductImageSrc((product.product as any).images[0].url)}
              alt={product.name || ""}
              className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain"
            />
          ) : isKit ? (
            <BiPackage className="h-12 w-12 text-gray-400 md:h-14 md:w-14" />
          ) : (
            <BiPackage className="h-10 w-10 text-gray-400 md:h-12 md:w-12" />
          )}
          {/* [KIT INTEGRATION] Kit Badge overlaid on image */}
          {isKit && (
            <div className="absolute right-1.5 top-1.5">
              <Badge className="h-5 bg-[#ff48b0] px-1.5 text-[10px] font-semibold text-white shadow">
                KIT
              </Badge>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-1.5 md:space-y-2">
          <div className="flex items-start justify-between gap-1">
            <h3 className="md:text-md flex-1 truncate text-sm font-semibold text-gray-900 group-hover:text-[#ff48b0] dark:text-white">
              {product.name || product.product.name}
            </h3>
            {/* [KIT INTEGRATION] Tooltip trigger */}
            {isKit && <KitContentPopover product={product} />}
          </div>
          <p className="truncate text-xs text-muted-foreground md:text-sm">
            {product.product?.brand?.name || "Unknown Brand"}
          </p>
          {/* [KIT INTEGRATION] show kit item count */}
          {isKit && (
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Incluye {product.product?.kitItems?.length || 0} items
            </p>
          )}

          {/* Prices Display */}
          <div className="space-y-0.5 pt-1">
            <p className="text-xs font-semibold text-muted-foreground md:text-sm">
              {t("productSearch.prices")}:
            </p>
            {product.prices && product.prices.length > 0 ? (
              <div className="space-y-0.5">
                {product.prices
                  .sort(
                    (a: POSProductVariantPrice, b: POSProductVariantPrice) =>
                      (a.priority || 999) - (b.priority || 999)
                  )
                  .map((price: POSProductVariantPrice, index: number) => {
                    const isCustomerPrice = selectedCustomer?.priceTypes?.some(
                      pt => pt.id === price.priceTypeId && pt.isActive
                    );
                    const selectedPrice = selectPrice(
                      product,
                      selectedCustomer,
                      1
                    );
                    const isSelected =
                      selectedPrice?.priceTypeId === price.priceTypeId;

                    return (
                      <div
                        key={`${price.priceTypeId}-${index}`}
                        className={cn(
                          "flex items-start justify-between gap-1 text-xs md:text-sm",
                          isSelected && "font-bold"
                        )}
                      >
                        <span
                          className={cn(
                            "min-w-0 flex-1 break-words text-xs text-gray-700 dark:text-gray-300 md:text-sm",
                            isSelected && "font-semibold text-[#ff48b0]"
                          )}
                        >
                          <span className="block truncate">
                            {price.priceTypeName}
                            {price.minQuantity > 1 &&
                              ` (${t("header.minQuantity", { quantity: price.minQuantity })})`}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "ml-1 flex-shrink-0",
                            isSelected
                              ? "font-bold text-[#ff48b0]"
                              : "text-gray-600 dark:text-gray-400"
                          )}
                        >
                          {CURRENCY_SIGN}
                          {price.price?.toFixed(2) || "0.00"}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-base font-bold text-[#ff48b0] md:text-lg">
                {CURRENCY_SIGN}0.00
              </div>
            )}
          </div>

          {/* Stock Badge and Availability Button */}
          <div className="flex flex-wrap items-center gap-2 pt-1 md:pt-2">
            <Badge
              variant="secondary"
              className={cn(
                "text-xs md:text-sm",
                stockStatus.color,
                "text-white"
              )}
            >
              {availableStock > 0 ? availableStock : stockStatus.text}
            </Badge>
            <StockAvailabilityPopover product={product} />
            {productMultiple && productMultiple > 0 && (
              <Badge
                variant="secondary"
                className="border-blue-200 bg-blue-100 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400 md:text-sm"
              >
                {t("shoppingCart.soldInMultiples", {
                  multiple: productMultiple,
                })}
              </Badge>
            )}
          </div>

          {product.sku && (
            <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">
              {t("productSearch.sku")}: {product.sku}
            </p>
          )}
          {product.barcode && (
            <p className="truncate text-xs font-medium text-muted-foreground md:text-sm">
              {t("productSearch.barcode")}: {product.barcode}
            </p>
          )}

          {/* Mobile Quantity Input and Price Type Selection */}
          {isMobile && (
            <div className="space-y-2 pt-2">
              {/* Price Type Selection */}
              {(() => {
                const availablePrices = filterPricesByCustomer(
                  product.prices || [],
                  selectedCustomer
                );
                return availablePrices.length > 1 ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("productSearch.priceType") || "Price Type"}:
                    </label>
                    <Select
                      value={
                        selectedPriceTypeId ||
                        availablePrices[0]?.priceTypeId ||
                        ""
                      }
                      onValueChange={value => {
                        setSelectedPriceTypeId(value);
                        // Recalculate price based on selected price type and quantity
                        const selectedPrice = availablePrices.find(
                          p => p.priceTypeId === value
                        );
                        if (selectedPrice) {
                          // Update quantity if needed based on minQuantity
                          if (selectedPrice.minQuantity > quantity) {
                            handleQuantityChange(selectedPrice.minQuantity);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 border border-gray-300 bg-white text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
                        {availablePrices
                          .sort(
                            (a, b) => (a.priority || 999) - (b.priority || 999)
                          )
                          .map(price => (
                            <SelectItem
                              key={price.priceTypeId}
                              value={price.priceTypeId}
                              className="text-xs text-gray-900 dark:text-gray-100"
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
                  </div>
                ) : null;
              })()}

              {/* Quantity and Add to Cart */}
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("productSearch.quantity") || "Quantity"}:
                  </label>
                  <NumberInput
                    min={1}
                    max={availableStock}
                    value={quantity}
                    onChange={value => {
                      handleQuantityChange(value);
                    }}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        handleAddToCartClick(e as any);
                      }
                    }}
                    className="w-full text-sm"
                    step={
                      productMultiple && productMultiple > 0
                        ? productMultiple
                        : 1
                    }
                  />
                </div>
                <div className="flex-1 pt-5">
                  <Button
                    onClick={handleAddToCartClick}
                    size="md"
                    variant="primary"
                    className="w-full"
                  >
                    {t("productSearch.addToCart")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProductListItem = ({
  product,
  onAddToCart,
  selectedCustomer,
  isMobile = false,
  cartItems,
}: ProductGridItemProps) => {
  const { t } = useTranslation("pos");

  // [KIT INTEGRATION] Check if product is a kit
  const productType = product.product?.type as string;
  const isKit = productType === ProductType.KIT || productType === "KIT";

  const kitAvailableStock = isKit
    ? getKitAvailableStock(product, cartItems)
    : null;

  const availableStock = isKit
    ? (kitAvailableStock ?? 0)
    : (product.stockLevel?.available ?? 0);

  const stockStatus = isKit
    ? getStockStatus(
        kitAvailableStock !== null
          ? {
              available: kitAvailableStock,
              quantity: kitAvailableStock,
              reserved: 0,
            }
          : null,
        product.minimumStock,
        t
      )
    : getStockStatus(product.stockLevel, product.minimumStock, t);

  const selectedPrice = selectPrice(product, selectedCustomer, 1);
  const productMultiple = (product as any).multiple as
    | number
    | null
    | undefined;
  const [quantity, setQuantity] = useState<number>(() => {
    // Initialize with product multiple if available, otherwise 1
    return productMultiple && productMultiple > 0 ? productMultiple : 1;
  });

  // Get initial selected price type
  const initialSelectedPrice = selectPrice(product, selectedCustomer, quantity);
  const [selectedPriceTypeId, setSelectedPriceTypeId] = useState<
    string | undefined
  >(
    () => initialSelectedPrice?.priceTypeId || product.prices?.[0]?.priceTypeId
  );

  const handleQuantityChange = (value: number) => {
    let newQuantity = value;

    // Validate against available stock
    if (newQuantity > availableStock) {
      newQuantity = availableStock;
    }

    // Validate against product multiple
    if (productMultiple && productMultiple > 0) {
      // Round down to nearest multiple
      newQuantity = Math.floor(newQuantity / productMultiple) * productMultiple;
      // Ensure at least one multiple
      if (newQuantity < productMultiple) {
        newQuantity = productMultiple;
      }
    }

    // Ensure minimum of 1
    if (newQuantity < 1) {
      newQuantity = 1;
    }

    setQuantity(newQuantity);
  };

  const handleAddToCartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMobile) {
      onAddToCart(product, quantity, selectedPriceTypeId);
    } else {
      onAddToCart(product);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (isMobile) {
        onAddToCart(product, quantity, selectedPriceTypeId);
      } else {
        onAddToCart(product);
      }
    }
  };

  // Update selected price when quantity changes
  useEffect(() => {
    if (isMobile && product.prices && product.prices.length > 0) {
      const newSelectedPrice = selectPrice(product, selectedCustomer, quantity);
      if (newSelectedPrice) {
        setSelectedPriceTypeId(newSelectedPrice.priceTypeId);
      }
    }
  }, [quantity, product, selectedCustomer, isMobile]);

  return (
    <div
      role={isMobile ? undefined : "button"}
      tabIndex={isMobile ? undefined : 0}
      className={cn(
        "group overflow-hidden rounded-lg border bg-white transition-all dark:border-gray-700 dark:bg-gray-800",
        !isMobile &&
          "cursor-pointer hover:border-[#ff48b0]/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#ff48b0]/50"
      )}
      onClick={!isMobile ? () => onAddToCart(product) : undefined}
      onKeyDown={!isMobile ? handleKeyDown : undefined}
    >
      <div className="p-2.5 md:p-3">
        <div className="flex items-center gap-3 md:gap-4">
          {/* Product Image - larger thumbnail, object-contain so full product visible */}
          <div className="relative flex size-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-pink-50/90 to-purple-50/90 p-1.5 dark:from-pink-900/20 dark:to-purple-900/20 md:size-20">
            {(product.product as any)?.primaryImageUrl ? (
              (product.product as any).primaryImageUrl?.includes("supabase") ? (
                // eslint-disable-next-line @next/next/no-img-element -- Proxied to avoid ERR_BLOCKED_BY_ORB
                <img
                  src={getProductImageSrc(
                    (product.product as any).primaryImageUrl
                  )}
                  alt={product.name || ""}
                  className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain"
                />
              ) : (
                <Image
                  src={(product.product as any).primaryImageUrl}
                  alt={product.name || ""}
                  width={80}
                  height={80}
                  className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain"
                />
              )
            ) : (product.product as any)?.images?.[0]?.url ? (
              (product.product as any).images[0].url?.includes("supabase") ? (
                // eslint-disable-next-line @next/next/no-img-element -- Proxied to avoid ERR_BLOCKED_BY_ORB
                <img
                  src={getProductImageSrc(
                    (product.product as any).images[0].url
                  )}
                  alt={product.name || ""}
                  className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain"
                />
              ) : (
                <Image
                  src={(product.product as any).images[0].url}
                  alt={product.name || ""}
                  width={80}
                  height={80}
                  className="h-auto max-h-full w-auto max-w-full rounded-lg object-contain"
                />
              )
            ) : product.product?.brand?.logoUrl ? (
              <Image
                src={product.product.brand.logoUrl}
                alt={product.name || ""}
                width={80}
                height={80}
                className="max-h-full w-auto max-w-full rounded-lg object-contain"
              />
            ) : isKit ? (
              <BiPackage className="h-8 w-8 text-gray-400 md:h-9 md:w-9" />
            ) : (
              <BiPackage className="h-7 w-7 text-gray-400 md:h-8 md:w-8" />
            )}
          </div>

          {/* Product Info - Optimized spacing */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-gray-900 transition-colors group-hover:text-[#ff48b0] dark:text-white md:text-base">
                    {product.name || product.product.name}
                  </h3>
                  {/* [KIT INTEGRATION]  trigger in List View */}
                  {isKit && <KitContentPopover product={product} />}
                </div>
                {/* [KIT INTEGRATION] kit items quantity */}
                {isKit && (
                  <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Incluye {product.product?.kitItems?.length || 0} items
                  </p>
                )}
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm text-muted-foreground">
                    {product.product?.brand?.name || "Unknown Brand"}
                  </p>
                  {product.sku && (
                    <>
                      <span className="text-sm text-muted-foreground">•</span>
                      <p className="truncate text-sm text-muted-foreground">
                        {t("productSearch.sku")}: {product.sku}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Prices - Compact horizontal layout */}
            {product.prices && product.prices.length > 0 ? (
              <div className="mt-1 flex flex-wrap items-center gap-2 md:gap-3">
                {product.prices
                  .sort(
                    (a: POSProductVariantPrice, b: POSProductVariantPrice) =>
                      (a.priority || 999) - (b.priority || 999)
                  )
                  .slice(0, 3) // Show max 3 prices to save space
                  .map((price: POSProductVariantPrice, index: number) => {
                    const isSelected =
                      selectedPrice?.priceTypeId === price.priceTypeId;

                    return (
                      <div
                        key={`${price.priceTypeId}-${index}`}
                        className={cn(
                          "flex items-center gap-1 text-sm md:text-sm",
                          isSelected && "font-semibold"
                        )}
                      >
                        <span
                          className={cn(
                            isSelected
                              ? "font-bold text-[#ff48b0]"
                              : "text-gray-700 dark:text-gray-400"
                          )}
                        >
                          {CURRENCY_SIGN}
                          {price.price?.toFixed(2) || "0.00"}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] md:text-sm",
                            isSelected
                              ? "text-[#ff48b0]"
                              : "text-muted-foreground"
                          )}
                        >
                          ({price.priceTypeName}
                          {price.minQuantity > 1 &&
                            ` ${t("header.minQuantity", { quantity: price.minQuantity })}`}
                          )
                        </span>
                      </div>
                    );
                  })}
                {product.prices.length > 3 && (
                  <span className="text-sm text-muted-foreground">
                    +{product.prices.length - 3} more
                  </span>
                )}
              </div>
            ) : (
              <div className="mt-1 text-sm font-bold text-[#ff48b0] md:text-base">
                {CURRENCY_SIGN}0.00
              </div>
            )}
          </div>

          {/* Right Side - Stock & Actions - Compact */}
          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs md:text-sm",
                  stockStatus.color,
                  "text-white"
                )}
              >
                {availableStock > 0 ? availableStock : stockStatus.text}
              </Badge>
              <StockAvailabilityPopover product={product} />
            </div>
            {productMultiple && productMultiple > 0 && (
              <Badge
                variant="secondary"
                className="border-blue-200 bg-blue-100 px-1.5 py-0.5 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
              >
                {t("shoppingCart.soldInMultiples", {
                  multiple: productMultiple,
                })}
              </Badge>
            )}
          </div>

          {/* Mobile Quantity Input and Price Type Selection */}
          {isMobile && (
            <div className="space-y-2 pt-2">
              {/* Price Type Selection */}
              {(() => {
                const availablePrices = filterPricesByCustomer(
                  product.prices || [],
                  selectedCustomer
                );
                return availablePrices.length > 1 ? (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      {t("productSearch.priceType") || "Price Type"}:
                    </label>
                    <Select
                      value={
                        selectedPriceTypeId ||
                        availablePrices[0]?.priceTypeId ||
                        ""
                      }
                      onValueChange={value => {
                        setSelectedPriceTypeId(value);
                        // Recalculate price based on selected price type and quantity
                        const selectedPrice = availablePrices.find(
                          p => p.priceTypeId === value
                        );
                        if (selectedPrice) {
                          // Update quantity if needed based on minQuantity
                          if (selectedPrice.minQuantity > quantity) {
                            handleQuantityChange(selectedPrice.minQuantity);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 border border-gray-300 bg-white text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800">
                        {availablePrices
                          .sort(
                            (a, b) => (a.priority || 999) - (b.priority || 999)
                          )
                          .map(price => (
                            <SelectItem
                              key={price.priceTypeId}
                              value={price.priceTypeId}
                              className="text-xs text-gray-900 dark:text-gray-100"
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
                  </div>
                ) : null;
              })()}

              {/* Quantity and Add to Cart */}
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("productSearch.quantity") || "Quantity"}:
                  </label>
                  <NumberInput
                    min={1}
                    max={availableStock}
                    value={quantity}
                    onChange={value => {
                      handleQuantityChange(value);
                    }}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        handleAddToCartClick(e as any);
                      }
                    }}
                    className="w-full text-sm"
                    step={
                      productMultiple && productMultiple > 0
                        ? productMultiple
                        : 1
                    }
                  />
                </div>
                <div className="flex-1 pt-5">
                  <Button
                    onClick={handleAddToCartClick}
                    size="sm"
                    variant="primary"
                    className="w-full"
                  >
                    {t("productSearch.addToCart")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export function ProductSearch({
  onAddToCart,
  locationId,
  selectedCustomer,
  hasCashSession = true,
  cartItems = [],
}: ProductSearchProps) {
  const { t } = useTranslation("pos");
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "",
    message: "",
  });

  // Search products using React Query hook
  const { data: products = [], isLoading } = useSearchProductVariants(
    activeSearchQuery,
    locationId,
    {
      enabled: activeSearchQuery.trim().length >= 2 && !!locationId,
    }
  );

  const handleAddToCart = (
    product: POSProductVariant,
    quantity?: number,
    priceTypeId?: string
  ) => {
    // Normalize the product to ensure all required metadata is present
    const normalizedProduct = normalizeProductWithMetadata(product);

    // Determine if the product is a KIT
    const productType = normalizedProduct.product?.type as string;
    const isKit = productType === ProductType.KIT || productType === "KIT";

    // Calculate available stock for kits considering items already in the cart
    const kitAvailableStock = isKit
      ? getKitAvailableStock(normalizedProduct, cartItems)
      : null;

    // For kits, use the calculated kitAvailableStock; for regular products, use stockLevel.available
    const availableStock = isKit
      ? (kitAvailableStock ?? 0)
      : (normalizedProduct.stockLevel?.available ?? 0);

    // Use provided quantity or default to 1
    const qty = quantity ?? 1;

    // Prevent adding to cart if out of stock or requested quantity exceeds available
    if (availableStock === 0 || qty > availableStock) {
      setErrorDialog({
        open: true,
        title: t("productSearch.outOfStock"),
        message: t("productSearch.outOfStockMessage"),
      });
      return;
    }

    // Select the price based on priceTypeId if provided, otherwise use the best price for the quantity and customer
    let selectedPrice: POSProductVariantPrice | null = null;
    if (priceTypeId && normalizedProduct.prices) {
      selectedPrice =
        normalizedProduct.prices.find(
          (p: { priceTypeId: string }) => p.priceTypeId === priceTypeId
        ) || null;
    }

    if (!selectedPrice) {
      selectedPrice = selectPrice(normalizedProduct, selectedCustomer, qty);
    }

    // If no price is available, show an error dialog
    if (!selectedPrice) {
      setErrorDialog({
        open: true,
        title: t("productSearch.noPriceAvailable"),
        message: t("productSearch.noPriceAvailableMessage"),
      });
      return;
    }

    // For kits, prepare kitItems with available stock for each component
    let kitItems: any[] | undefined = undefined;
    if (isKit && normalizedProduct.product?.kitItems) {
      kitItems = normalizedProduct.product.kitItems.map(
        (item: { productVariant: { stockLevel: { available: any } } }) => ({
          ...item,
          availableStock: item.productVariant?.stockLevel?.available ?? 0,
          productVariant: item.productVariant,
        })
      );
    }

    // Prepare the product object to send to the cart
    let productToSend = { ...normalizedProduct };

    if (isKit) {
      // For kits, set the stockLevel and availableStock to the total kit stock limit (ignoring cart)
      const totalKitStockLimit =
        getKitAvailableStock(normalizedProduct, []) ?? 0;
      productToSend = {
        ...normalizedProduct,
        stockLevel: {
          quantity: totalKitStockLimit,
          available: totalKitStockLimit,
          reserved: 0,
        } as POSStockLevel,
        availableStock: totalKitStockLimit,
      };
    } else {
      // For regular products, just set availableStock
      productToSend = {
        ...normalizedProduct,
        availableStock: normalizedProduct.stockLevel?.available ?? 0,
      };
    }

    // Always attach selectedPrice and kitItems (if kit) before passing to onAddToCart
    onAddToCart(
      {
        ...productToSend,
        selectedPrice,
        kitItems,
      } as POSProductVariant & { selectedPrice: POSProductVariantPrice },
      qty,
      priceTypeId
    );
  };

  const handleSearch = (query: string) => {
    setActiveSearchQuery(query);
  };

  // Auto-add to cart when barcode exactly matches a product variant
  useEffect(() => {
    // Only proceed if:
    // 1. Search is not loading
    // 2. We have exactly one product result
    // 3. The search query exactly matches the product's barcode (case-insensitive)
    // 4. We have a location selected
    if (
      !isLoading &&
      products.length === 1 &&
      locationId &&
      activeSearchQuery.trim().length > 0
    ) {
      const product = products[0];
      const searchQueryTrimmed = activeSearchQuery.trim();
      const productBarcode = product.barcode?.trim();

      // Check if the search query exactly matches the barcode (case-insensitive)
      if (
        productBarcode &&
        searchQueryTrimmed.toLowerCase() === productBarcode.toLowerCase()
      ) {
        // Automatically add to cart
        handleAddToCart(product);
        // Clear the search input after adding
        setSearchQuery("");
        setActiveSearchQuery("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, isLoading, activeSearchQuery, locationId]);

  return (
    <div className="flex h-full flex-col rounded-xl bg-white shadow-md dark:bg-gray-800">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <SearchInput
              ref={searchInputRef}
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
              placeholder={
                !hasCashSession
                  ? t("productSearch.pleaseOpenCashSession") ||
                    t("errors.selectCashRegisterToOpen")
                  : !selectedCustomer
                    ? t("shoppingCart.pleaseSelectCustomer")
                    : t("productSearch.searchPlaceholder")
              }
              disabled={isLoading || !selectedCustomer || !hasCashSession}
              minLength={2}
            />
          </div>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
            <Button
              variant={viewMode === "grid" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <BiGridAlt className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <BiListUl className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Products Grid/List */}
      <div className="flex-1 overflow-auto p-2 md:p-4">
        {isLoading && (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-[#ff48b0]" />
          </div>
        )}

        {!isLoading && !locationId && (
          <div className="flex h-full flex-col items-center justify-center text-gray-500">
            <BiStore className="mb-4 h-16 w-16" />
            <p className="text-lg font-medium">
              {t("productSearch.pleaseSelectBranch")}
            </p>
          </div>
        )}

        {!isLoading &&
          locationId &&
          products.length === 0 &&
          activeSearchQuery.trim().length > 0 && (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <BiSearch className="mb-4 h-16 w-16" />
              <p className="text-lg font-medium">
                {t("productSearch.noProductsFound")}
              </p>
              <p className="text-md">{t("productSearch.tryDifferentTerm")}</p>
            </div>
          )}

        {!isLoading &&
          locationId &&
          products.length === 0 &&
          activeSearchQuery.trim().length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <BiBarcode className="mb-4 h-16 w-16" />
              <p className="text-lg font-medium">
                {t("productSearch.startTyping")}
              </p>
              <p className="text-md">{t("productSearch.searchByBarcode")}</p>
            </div>
          )}

        {!isLoading && products.length > 0 && (
          <div className="w-full">
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:gap-4">
                {products.map(product => (
                  <ProductGridItem
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    selectedCustomer={selectedCustomer}
                    isMobile={isMobile}
                    cartItems={cartItems}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2 md:space-y-2">
                {products.map(product => (
                  <ProductListItem
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    selectedCustomer={selectedCustomer}
                    isMobile={isMobile}
                    cartItems={cartItems}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmationDialog
        open={errorDialog.open}
        onOpenChange={open => setErrorDialog(prev => ({ ...prev, open }))}
        title={errorDialog.title}
        description={errorDialog.message}
        variant="destructive"
        confirmText="OK"
        onConfirm={() => setErrorDialog(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}

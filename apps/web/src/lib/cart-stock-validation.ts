/**
 * Shared cart stock validation using batch stock levels (aligned with POS).
 */
import type { POSKitItem, ProductType } from "@esli-cosmetics/types";

export type StockLevelRow = {
  productVariantId?: string | null;
  quantity?: unknown;
  reserved?: unknown;
  productVariant?: unknown;
};

export type CartLineForStockValidation = {
  productVariantId: string;
  name: string;
  quantity: number;
  price: number;
  productPrices?: Array<{
    priceTypeId: string;
    priceTypeName: string;
    price: number;
    minQuantity: number;
    priority: number;
  }>;
  priceTypeId?: string;
  type?: ProductType;
  kitItems?: POSKitItem[];
  [key: string]: unknown;
};

export type ValidateCartStockOptions<T extends CartLineForStockValidation> = {
  normalizeProduct: (item: T) => Record<string, unknown>;
  selectPriceForQuantity: (
    prices: T["productPrices"] | undefined,
    quantity: number
  ) => { price: number; priceTypeId?: string } | null | undefined;
  /**
   * When true, never remove lines or change quantities; only attach
   * `availableStock` (and kit component availability) so the UI can flag errors.
   */
  annotateOnly?: boolean;
  /**
   * Approved-quote edit: units of this variant already reserved for this cart line
   * on the server. Effective availability = (qty - reserved) + boost.
   * For a kit line, return (parent line reserved kit qty) × (units of this variant per kit).
   */
  approvedQuoteReservedBoost?: (item: T, productVariantId: string) => number;
};

export type ValidateCartStockResult<T extends CartLineForStockValidation> = {
  updatedItems: T[];
  removedItems: string[];
  adjustedItems: Array<{ name: string; oldQty: number; newQty: number }>;
};

/**
 * After stock validation, pick unit price: if the line had a manual price type,
 * stay on that type (best tier for the effective quantity) instead of re-running
 * automatic customer/quantity ladder selection — which would revert e.g. mayorista → emprendedor.
 */
function resolveLinePriceAfterStockChange<T extends CartLineForStockValidation>(
  item: T,
  productPrices: T["productPrices"] | undefined,
  quantity: number,
  selectPriceForQuantity: ValidateCartStockOptions<T>["selectPriceForQuantity"]
): { price: number; priceTypeId?: string } {
  const manual =
    (item as Record<string, unknown>).manualPriceTypeSelection === true;
  const prices = productPrices ?? [];

  if (manual && item.priceTypeId && prices.length > 0) {
    const tiers = prices.filter(
      p =>
        p.priceTypeId === item.priceTypeId && quantity >= (p.minQuantity ?? 1)
    );
    if (tiers.length > 0) {
      tiers.sort((a, b) => (b.minQuantity ?? 0) - (a.minQuantity ?? 0));
      const best = tiers[0]!;
      return { price: best.price, priceTypeId: best.priceTypeId };
    }
    return {
      price: item.price,
      ...(item.priceTypeId ? { priceTypeId: item.priceTypeId } : {}),
    };
  }

  const selected = selectPriceForQuantity(prices, quantity);
  if (selected) {
    return {
      price: selected.price,
      ...(selected.priceTypeId ? { priceTypeId: selected.priceTypeId } : {}),
    };
  }
  return {
    price: item.price,
    ...(item.priceTypeId ? { priceTypeId: item.priceTypeId } : {}),
  };
}

export async function validateCartItemsAgainstStockLevels<
  T extends CartLineForStockValidation,
>(
  cartItems: T[],
  locationId: string,
  fetchStockLevels: (
    productVariantIds: string[],
    locId: string
  ) => Promise<StockLevelRow[]>,
  options: ValidateCartStockOptions<T>
): Promise<ValidateCartStockResult<T>> {
  const {
    normalizeProduct,
    selectPriceForQuantity,
    annotateOnly = false,
    approvedQuoteReservedBoost,
  } = options;
  const removedItems: string[] = [];
  const adjustedItems: Array<{
    name: string;
    oldQty: number;
    newQty: number;
  }> = [];

  const allRequiredVariantIds = new Set<string>();
  cartItems.forEach(item => {
    const normalized = normalizeProduct(item) as {
      type?: string;
      kitItems?: Array<{ productVariantId: string }>;
    };
    allRequiredVariantIds.add(item.productVariantId);
    if (normalized.type === "KIT" && Array.isArray(normalized.kitItems)) {
      normalized.kitItems.forEach(ki => {
        allRequiredVariantIds.add(ki.productVariantId);
      });
    }
  });

  const stockLevels = await fetchStockLevels(
    Array.from(allRequiredVariantIds),
    locationId
  );

  const stockMap = new Map(
    stockLevels.map(sl => [
      sl.productVariantId || "",
      {
        available: Number(sl.quantity || 0) - Number(sl.reserved || 0),
        variant: sl.productVariant,
      },
    ])
  );

  const validationResults = cartItems.map(item => {
    const normalized = normalizeProduct(item) as {
      type?: string;
      kitItems?: Array<{
        productVariantId: string;
        quantity?: number;
        productVariant?: { name?: string };
        name?: string;
      }>;
    };

    if (normalized.type === "KIT" && Array.isArray(normalized.kitItems)) {
      let minBuildable = Infinity;
      let insufficientComponent: (typeof normalized.kitItems)[0] | undefined;

      const kitComponentResults = normalized.kitItems.map(kitItem => {
        const stockData = stockMap.get(kitItem.productVariantId);
        const baseAvailable = stockData?.available ?? 0;
        const boost =
          approvedQuoteReservedBoost?.(item, kitItem.productVariantId) ?? 0;
        const physicalAvailable = baseAvailable + boost;
        const buildableWithThis = Math.floor(
          physicalAvailable / (kitItem.quantity || 1)
        );

        if (buildableWithThis < minBuildable) {
          minBuildable = buildableWithThis;
          insufficientComponent = {
            ...kitItem,
            name:
              kitItem.productVariant?.name ||
              kitItem.name ||
              kitItem.productVariantId,
          };
        }

        return {
          ...kitItem,
          availableStock: physicalAvailable,
          name:
            kitItem.productVariant?.name ||
            kitItem.name ||
            kitItem.productVariantId,
        } as POSKitItem;
      });

      const finalKitStock = minBuildable === Infinity ? 0 : minBuildable;

      if (finalKitStock === 0) {
        if (annotateOnly) {
          return {
            item,
            action: "update" as const,
            availableStock: 0,
            productPrices: item.productPrices,
            type: "KIT" as ProductType,
            kitItems: kitComponentResults,
          };
        }
        const ic = insufficientComponent ??
          normalized.kitItems[0] ?? { name: item.name };
        return {
          item,
          action: "remove" as const,
          insufficientComponent: ic,
        };
      }

      if (item.quantity > finalKitStock) {
        if (annotateOnly) {
          return {
            item,
            action: "update" as const,
            availableStock: finalKitStock,
            productPrices: item.productPrices,
            type: "KIT" as ProductType,
            kitItems: kitComponentResults,
          };
        }
        return {
          item,
          action: "adjust" as const,
          newQuantity: finalKitStock,
          availableStock: finalKitStock,
          productPrices: item.productPrices,
          type: "KIT" as ProductType,
          kitItems: kitComponentResults,
        };
      }

      return {
        item,
        action: "update" as const,
        availableStock: finalKitStock,
        productPrices: item.productPrices,
        type: "KIT" as ProductType,
        kitItems: kitComponentResults,
      };
    }

    const stockInfo = stockMap.get(item.productVariantId);
    const baseAvailable = stockInfo?.available ?? 0;
    const boost =
      approvedQuoteReservedBoost?.(item, item.productVariantId) ?? 0;
    const availableStock = baseAvailable + boost;

    if (!stockInfo || availableStock <= 0) {
      if (annotateOnly) {
        return {
          item,
          action: "update" as const,
          availableStock: 0,
          productPrices: item.productPrices,
        };
      }
      return { item, action: "remove" as const };
    }

    if (item.quantity > availableStock) {
      if (annotateOnly) {
        return {
          item,
          action: "update" as const,
          availableStock,
          productPrices: item.productPrices,
        };
      }
      return {
        item,
        action: "adjust" as const,
        newQuantity: availableStock,
        availableStock,
        productPrices: item.productPrices,
      };
    }

    return {
      item,
      action: "update" as const,
      availableStock,
      productPrices: item.productPrices,
    };
  });

  const updatedItems: T[] = [];
  for (const result of validationResults) {
    if (!result) continue;
    const { item } = result;

    if (
      result.action === "remove" &&
      "insufficientComponent" in result &&
      result.insufficientComponent
    ) {
      const ic = result.insufficientComponent as {
        name?: string;
        productVariantId?: string;
      };
      removedItems.push(`${item.name} (${ic.name || ic.productVariantId})`);
      continue;
    }

    if (result.action === "remove") {
      removedItems.push(item.name);
      continue;
    }

    if (result.action === "adjust") {
      adjustedItems.push({
        name: item.name,
        oldQty: item.quantity,
        newQty: result.newQuantity,
      });
      const { price: nextPrice, priceTypeId: nextPriceTypeId } =
        resolveLinePriceAfterStockChange(
          item,
          result.productPrices,
          result.newQuantity,
          selectPriceForQuantity
        );
      const adjustedItem = {
        ...item,
        quantity: result.newQuantity,
        availableStock: result.availableStock,
        price: nextPrice,
        ...(nextPriceTypeId ? { priceTypeId: nextPriceTypeId } : {}),
        ...("type" in result && result.type ? { type: result.type } : {}),
        ...("kitItems" in result && result.kitItems
          ? { kitItems: result.kitItems }
          : {}),
      } as T;
      if (result.productPrices) {
        (
          adjustedItem as { productPrices?: typeof result.productPrices }
        ).productPrices = result.productPrices;
      }
      updatedItems.push(adjustedItem);
      continue;
    }

    if (result.action === "update") {
      const { price: nextPrice, priceTypeId: nextPriceTypeId } =
        resolveLinePriceAfterStockChange(
          item,
          result.productPrices,
          item.quantity,
          selectPriceForQuantity
        );
      const updatedItem = {
        ...item,
        availableStock: result.availableStock,
        price: nextPrice,
        ...(nextPriceTypeId ? { priceTypeId: nextPriceTypeId } : {}),
        ...("type" in result && result.type ? { type: result.type } : {}),
        ...("kitItems" in result && result.kitItems
          ? { kitItems: result.kitItems }
          : {}),
      } as T;
      if (result.productPrices) {
        (
          updatedItem as { productPrices?: typeof result.productPrices }
        ).productPrices = result.productPrices;
      }
      updatedItems.push(updatedItem);
      continue;
    }
    updatedItems.push(item);
  }

  return { updatedItems, removedItems, adjustedItems };
}

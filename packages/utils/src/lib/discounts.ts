/**
 * Discount validation and calculation utilities for POS and Quotes
 */

export type DiscountCodeInfo = {
  id: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  maxDiscount?: number;
};

/**
 * Minimal cart item interface for discount calculations
 * Only includes fields needed for discount validation
 */
export type CartItemForDiscount = {
  productVariantId: string;
  price: number;
  quantity: number;
  discountAmount?: number | null;
  discountPercentage?: number | null;
};

/**
 * Per-line discount for totals, validation, and API payloads (quotes/orders).
 * Matches POS/quote reducers: explicit discountAmount wins; otherwise derive from %.
 */
export function lineDiscountAmountForCartItem(
  item: Pick<
    CartItemForDiscount,
    "price" | "quantity" | "discountAmount" | "discountPercentage"
  >
): number {
  const itemSubtotal = item.price * item.quantity;
  if (item.discountAmount != null) {
    return Number(Number(item.discountAmount).toFixed(2));
  }
  if (item.discountPercentage != null && item.discountPercentage > 0) {
    return Number(((itemSubtotal * item.discountPercentage) / 100).toFixed(2));
  }
  return 0;
}

/**
 * Calculate the discount code value based on subtotal
 */
export function calculateDiscountCodeValue(
  discountCodeInfo: DiscountCodeInfo | null | undefined,
  itemsSubtotal: number
): number {
  if (!discountCodeInfo) {
    return 0;
  }

  if (discountCodeInfo.discountType === "PERCENTAGE") {
    const calculatedValue = (itemsSubtotal * discountCodeInfo.value) / 100;
    // Apply max discount if set
    if (
      discountCodeInfo.maxDiscount &&
      calculatedValue > discountCodeInfo.maxDiscount
    ) {
      return discountCodeInfo.maxDiscount;
    }
    return calculatedValue;
  } else {
    // FIXED discount
    return discountCodeInfo.value;
  }
}

/**
 * Calculate the total discount from all items
 */
export function calculateItemsDiscountTotal(
  items: CartItemForDiscount[]
): number {
  return Number(
    items
      .reduce((sum, item) => sum + lineDiscountAmountForCartItem(item), 0)
      .toFixed(2)
  );
}

/**
 * Calculate the maximum allowed manual discount
 */
export function calculateMaxManualDiscount(
  itemsSubtotal: number,
  itemsDiscountTotal: number,
  discountCodeValue: number
): number {
  return Math.max(0, itemsSubtotal - itemsDiscountTotal - discountCodeValue);
}

/**
 * Calculate the maximum allowed discount for a specific item
 */
export function calculateMaxItemDiscount(
  itemsSubtotal: number,
  otherItemsDiscountTotal: number,
  discountCodeValue: number,
  manualOrderDiscount: number,
  itemSubtotal: number
): number {
  const maxOrderDiscount = itemsSubtotal - otherItemsDiscountTotal;
  const maxItemDiscount = Math.max(
    0,
    maxOrderDiscount - discountCodeValue - manualOrderDiscount
  );
  // Don't allow discount to exceed the item's own subtotal
  return Math.min(maxItemDiscount, itemSubtotal);
}

/**
 * Validate and clamp manual discount amount
 */
export function validateManualDiscountAmount(
  amount: number,
  itemsSubtotal: number,
  itemsDiscountTotal: number,
  discountCodeInfo: DiscountCodeInfo | null | undefined
): { clampedAmount: number; shouldShowWarning: boolean } {
  const discountCodeValue = calculateDiscountCodeValue(
    discountCodeInfo,
    itemsSubtotal
  );
  const maxManualDiscount = calculateMaxManualDiscount(
    itemsSubtotal,
    itemsDiscountTotal,
    discountCodeValue
  );

  const clampedAmount = Math.max(0, Math.min(amount, maxManualDiscount));
  const shouldShowWarning = clampedAmount < amount;

  return { clampedAmount, shouldShowWarning };
}

/**
 * Validate and clamp manual discount percentage
 */
export function validateManualDiscountPercentage(
  percentage: number,
  itemsSubtotal: number,
  itemsDiscountTotal: number,
  discountCodeInfo: DiscountCodeInfo | null | undefined
): {
  clampedPercentage: number;
  clampedAmount: number;
  shouldShowWarning: boolean;
} {
  const discountCodeValue = calculateDiscountCodeValue(
    discountCodeInfo,
    itemsSubtotal
  );
  const maxManualDiscount = calculateMaxManualDiscount(
    itemsSubtotal,
    itemsDiscountTotal,
    discountCodeValue
  );
  const maxPercentage =
    itemsSubtotal > 0 ? (maxManualDiscount / itemsSubtotal) * 100 : 0;

  const clampedPercentage = Math.max(0, Math.min(percentage, maxPercentage));
  const clampedAmount = Number(
    ((itemsSubtotal * clampedPercentage) / 100).toFixed(2)
  );
  const shouldShowWarning = clampedPercentage < percentage;

  return { clampedPercentage, clampedAmount, shouldShowWarning };
}

/**
 * Validate and clamp item discount amount
 */
export function validateItemDiscountAmount(
  discountAmount: number,
  items: CartItemForDiscount[],
  targetProductVariantId: string,
  discountCodeInfo: DiscountCodeInfo | null | undefined,
  manualOrderDiscount: number
): { clampedDiscountAmount: number; shouldShowWarning: boolean } {
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const otherItemsDiscountTotal = items.reduce(
    (sum, item) =>
      item.productVariantId !== targetProductVariantId
        ? sum + lineDiscountAmountForCartItem(item)
        : sum,
    0
  );

  const item = items.find(
    item => item.productVariantId === targetProductVariantId
  );
  if (!item) {
    return { clampedDiscountAmount: discountAmount, shouldShowWarning: false };
  }

  const itemSubtotal = item.price * item.quantity;
  const discountCodeValue = calculateDiscountCodeValue(
    discountCodeInfo,
    itemsSubtotal
  );

  const maxItemDiscount = calculateMaxItemDiscount(
    itemsSubtotal,
    otherItemsDiscountTotal,
    discountCodeValue,
    manualOrderDiscount,
    itemSubtotal
  );

  const clampedDiscountAmount = Math.max(
    0,
    Math.min(discountAmount, itemSubtotal, maxItemDiscount)
  );
  const shouldShowWarning = clampedDiscountAmount < discountAmount;

  return { clampedDiscountAmount, shouldShowWarning };
}

/**
 * Validate and clamp item discount percentage
 */
export function validateItemDiscountPercentage(
  discountPercentage: number,
  items: CartItemForDiscount[],
  targetProductVariantId: string,
  discountCodeInfo: DiscountCodeInfo | null | undefined,
  manualOrderDiscount: number
): {
  clampedPercentage: number;
  clampedDiscountAmount: number;
  shouldShowWarning: boolean;
} {
  const itemsSubtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const otherItemsDiscountTotal = items.reduce(
    (sum, item) =>
      item.productVariantId !== targetProductVariantId
        ? sum + lineDiscountAmountForCartItem(item)
        : sum,
    0
  );

  const item = items.find(
    item => item.productVariantId === targetProductVariantId
  );
  if (!item) {
    return {
      clampedPercentage: discountPercentage,
      clampedDiscountAmount: 0,
      shouldShowWarning: false,
    };
  }

  const itemSubtotal = item.price * item.quantity;
  const discountAmount = Number(
    ((itemSubtotal * discountPercentage) / 100).toFixed(2)
  );

  const discountCodeValue = calculateDiscountCodeValue(
    discountCodeInfo,
    itemsSubtotal
  );

  const maxItemDiscount = calculateMaxItemDiscount(
    itemsSubtotal,
    otherItemsDiscountTotal,
    discountCodeValue,
    manualOrderDiscount,
    itemSubtotal
  );

  const clampedDiscountAmount = Math.max(
    0,
    Math.min(discountAmount, itemSubtotal, maxItemDiscount)
  );
  const clampedPercentage =
    itemSubtotal > 0
      ? Number(((clampedDiscountAmount / itemSubtotal) * 100).toFixed(2))
      : 0;
  const shouldShowWarning = clampedDiscountAmount < discountAmount;

  return { clampedPercentage, clampedDiscountAmount, shouldShowWarning };
}

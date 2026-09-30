/**
 * Price selection utility for POS and Quotes
 *
 * Selects the appropriate price based on:
 * 1. Customer's available price types (if customer is selected)
 * 2. Quantity requirements (quantity >= minQuantity)
 * 3. Highest tier (highest minQuantity) that qualifies
 * 4. Priority as tiebreaker when multiple prices have the same minQuantity
 */

export type PriceWithMetadata = {
  priceTypeId: string;
  price: number;
  minQuantity: number;
  priority: number;
  priceTypeName?: string;
};

export type CustomerPriceType = {
  id: string;
  name: string;
  minQuantity: number;
  priority: number;
  isActive: boolean;
};

export type SelectedCustomer = {
  id: string;
  priceTypes?: CustomerPriceType[];
};

/**
 * Selects the price tier with the highest minQuantity that the quantity qualifies for.
 * Priority is used as a tiebreaker when multiple prices have the same minQuantity.
 *
 * @param prices - Array of available prices for the product
 * @param quantity - Current quantity being purchased
 * @param selectedCustomer - Optional customer with their available price types
 * @returns The selected price or null if no eligible price is found
 *
 * @example
 * // Example prices:
 * // - unitario: minQuantity: 1, priority: 1
 * // - emprendedor: minQuantity: 45, priority: 2
 * // - mayorista: minQuantity: 50, priority: 3
 * // - distribuidor: minQuantity: 60, priority: 4
 *
 * // quantity = 1 → returns unitario (only one that qualifies)
 * // quantity = 45 → returns emprendedor (highest minQuantity that qualifies)
 * // quantity = 50 → returns mayorista (highest minQuantity that qualifies)
 * // quantity = 60 → returns distribuidor (highest minQuantity that qualifies)
 */
export function selectPriceForQuantity(
  prices: PriceWithMetadata[] | null | undefined,
  quantity: number,
  selectedCustomer?: SelectedCustomer | null
): PriceWithMetadata | null {
  // Return null if no prices available
  if (!prices || prices.length === 0) {
    return null;
  }

  // Get customer's available price type IDs (if customer is selected)
  const customerPriceTypeIds =
    selectedCustomer?.priceTypes && selectedCustomer.priceTypes.length > 0
      ? new Set(
          selectedCustomer.priceTypes.filter(pt => pt.isActive).map(pt => pt.id)
        )
      : null;

  // Filter prices based on customer access and quantity requirements
  let eligiblePrices = prices.filter(p => {
    // If customer is selected, check if they have access to this price type
    if (customerPriceTypeIds && !customerPriceTypeIds.has(p.priceTypeId)) {
      return false;
    }
    // Check if quantity meets minimum requirement
    return quantity >= (p.minQuantity || 1);
  });

  // If customer has no eligible prices, use product's prices only (fallback)
  if (eligiblePrices.length === 0) {
    eligiblePrices = prices;
  }

  // Sort by minQuantity DESCENDING (highest tier first), then by priority ASCENDING (lower number = higher priority)
  eligiblePrices.sort((a, b) => {
    const minQtyA = a.minQuantity || 0;
    const minQtyB = b.minQuantity || 0;

    // First sort by minQuantity descending (highest first)
    if (minQtyA !== minQtyB) {
      return minQtyB - minQtyA;
    }

    // If minQuantity is the same, use priority as tiebreaker (lower number = higher priority)
    const priorityA = a.priority || 999;
    const priorityB = b.priority || 999;
    return priorityA - priorityB;
  });

  // Return the price with the highest minQuantity (first in sorted array)
  return eligiblePrices[0] || null;
}

// POS (Point of Sale) specific types

import {
  VariantPrice,
  ApiProduct,
  ApiProductVariant,
  ProductType,
} from "./api-products";
import { Brand } from "./brands";

/**
 * Stock level information for POS display
 */
export interface POSStockLevel {
  quantity: number;
  reserved: number;
  available: number;
}

/**
 * Price information for POS display
 */
export interface POSProductVariantPrice extends VariantPrice {
  priceTypeName: string;
  priority: number;
  minQuantity: number;
}

/**
 * Stock status for display purposes
 */
export interface StockStatus {
  status: "out" | "low" | "in";
  color: string;
  text: string;
}

export interface POSKitItem {
  id: string;
  name: string;
  productVariantId: string;
  quantity: number;
  availableStock?: number;
  productVariant?: Pick<
    ApiProductVariant,
    "id" | "name" | "sku" | "barcode"
  > & {
    product?: { name: string };
    stockLevel?: POSStockLevel | null;
  };
  stockError?: string;
}

/**
 * Simplified product information for POS
 */
export interface POSProduct extends Pick<ApiProduct, "id" | "name" | "sku"> {
  brand?: Pick<Brand, "id" | "name" | "logoUrl"> | null;
  category?: {
    id: string;
    name: string;
  } | null;

  // [KIT INTEGRATION]
  type: ProductType;
  kitItems?: POSKitItem[];
}

/**
 * Product variant information for POS
 */
export interface POSProductVariant
  extends Pick<
    ApiProductVariant,
    | "id"
    | "productId"
    | "sku"
    | "barcode"
    | "name"
    | "costPrice"
    | "minimumStock"
    | "maximumStock"
    | "appliesToDiscounts"
    | "attributes"
  > {
  prices: POSProductVariantPrice[];
  product: POSProduct;
  stockLevel: POSStockLevel | null;

  kitItems?: POSKitItem[];
}

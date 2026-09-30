// API types for frontend consumption - using camelCase

import { Brand } from "./brands";

export enum ProductType {
  STANDARD = "STANDARD",
  KIT = "KIT",
}

export interface ApiCategory {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  // Relations
  parent?: ApiCategory;
  children?: ApiCategory[];
}

export interface ApiProductVariant {
  id: string;
  productId: string;
  type: ProductType;
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
  costPrice: number;
  prices: VariantPrice[];
  minimumStock?: number | null;
  maximumStock?: number | null;
  multiple?: number | null;
  appliesToDiscounts?: boolean | null;
  attributes?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  /** Variant-level images. If empty, use product images. */
  images?: ApiProductVariantImage[];
  /** Primary image URL (from variant images or product fallback). */
  primaryImageUrl?: string | null;
  // Relations
  product?: ApiProduct;
}

export interface VariantPrice {
  priceTypeId: string;
  price: number;
  minQuantity?: number;
}

export interface ApiProductKitItem {
  id: string;
  productKitId: string;
  productVariantId: string;
  quantity: number;
  productVariant?: ApiProductVariant;
}

export interface ApiProductImage {
  id: string;
  productId: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
}

export interface ApiProductVariantImage {
  id: string;
  productVariantId: string;
  url: string;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
}

export interface ApiProduct {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  description?: string | null;
  brandId?: string | null;
  brand?: Brand | null;
  categoryId?: string | null;
  taxRateId?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  metadata: Record<string, any>;

  type: ProductType;
  expirationDate?: Date | null;
  kitItems?: ApiProductKitItem[];

  /** Product images (Supabase Storage URLs). Sorted by sortOrder. */
  images?: ApiProductImage[];
  /** URL of the primary/featured image. */
  primaryImageUrl?: string | null;

  // Relations
  category?: ApiCategory;
  variants?: ApiProductVariant[];
  productSupplier?: ApiProductSupplier[];
  stockLevels?: ApiStockLevel[];
  stockMovements?: ApiStockMovement[];
  orderItems?: ApiOrderItem[];
}

export interface ApiProductSupplier {
  id: string;
  productId: string;
  supplierId: string;
  costPrice: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  // Relations
  product?: ApiProduct;
  supplier?: ApiSupplier;
}

export interface ApiSupplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ApiStockLevel {
  id: string;
  productId: string;
  variantId?: string | null;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  // Relations
  product?: ApiProduct;
  variant?: ApiProductVariant;
  location?: ApiLocation;
}

export interface ApiLocation {
  id: string;
  name: string;
  type: "STORE" | "WAREHOUSE" | "DISTRIBUTION_CENTER" | "POPUP_STORE";
  address?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ApiStockMovement {
  id: string;
  productId: string;
  variantId?: string | null;
  locationId: string;
  userId: string;
  type:
    | "PURCHASE"
    | "SALE"
    | "POSITIVE_ADJUSTMENT"
    | "NEGATIVE_ADJUSTMENT"
    | "TRANSFER"
    | "ANNULMENT"
    | "DAMAGE"
    | "RETURN"
    | "RESTOCK";
  quantity: number;
  reason?: string | null;
  reference?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  // Relations
  product?: ApiProduct;
  variant?: ApiProductVariant;
  productType?: ProductType;
  location?: ApiLocation;
  user?: ApiUser;
}

export interface ApiUser {
  id: string;
  email: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ApiOrderItem {
  id: string;
  orderId: string;
  productId: string;
  variantId?: string | null;
  productType?: ProductType;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  // Relations
  order?: ApiOrder;
  product?: ApiProduct;
  variant?: ApiProductVariant;
}

export interface ApiOrder {
  id: string;
  customerId: string;
  userId: string;
  status:
    | "draft"
    | "pending"
    | "confirmed"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refunded";
  totalAmount: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  // Relations
  customer?: ApiCustomer;
  user?: ApiUser;
  items?: ApiOrderItem[];
}

export interface ApiCustomer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ApiTaxRate {
  id: string;
  name: string;
  rate: number;
  description?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

// Request/Response types
export interface CreateProductRequest {
  name: string;
  barcode: string;
  type: ProductType;
  description?: string | null;
  sku?: string | null;
  brandId?: string | null;
  categoryId?: string | null;
  taxRateId?: string | null;
  isActive?: boolean;
  attributes?: Record<string, any> | null;
  defaultVariantOnly?: boolean;
  expirationDate?: Date | string | null;
  kitItems?: {
    productVariantId: string;
    quantity: number;
  }[];

  defaultVariant?: {
    type?: ProductType;
    costPrice: number;
    prices: VariantPrice[];
    minimumStock?: number | null;
    maximumStock?: number | null;
    appliesToDiscounts?: boolean | null;
    attributes?: Record<string, any> | null;
  };
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {}

export interface CreateProductVariantRequest {
  type?: ProductType;
  sku?: string | null;
  barcode?: string | null;
  name?: string | null;
  costPrice: number;
  prices: VariantPrice[];
  minimumStock?: number | null;
  maximumStock?: number | null;
  appliesToDiscounts?: boolean | null;
  attributes?: Record<string, any> | null;
}

export interface UpdateProductVariantRequest
  extends Partial<CreateProductVariantRequest> {}

export interface ProductsResponse {
  products: ApiProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductVariantsResponse {
  variants: ApiProductVariant[];
  total: number;
  page: number;
  limit: number;
}

export interface ProductsFilters {
  name?: string;
  sku?: string;
  barcode?: string;
  categoryId?: string;
  isActive?: string;
  type?: ProductType;
  isDeleted?: string;
  page?: number;
  limit?: number;
}

export interface ProductSearchIndexStatus {
  totalVariants: number;
  variantsWithAliases: number;
  variantsWithoutAliases: number;
  variantsWithEmbeddings: number;
  pendingEmbeddings: number;
  embeddingsEnabled: boolean;
}

export interface ProductSearchIndexRebuildResult {
  processed: number;
  aliases?: number;
  failed: number;
  skipped?: number;
}

import {
  ApiCategory,
  ApiOrderItem,
  ApiProductImage,
  ApiProductSupplier,
  ApiProductVariant,
  ApiStockLevel,
  ApiStockMovement,
  ApiTaxRate,
  ProductType,
  ApiProductKitItem,
} from "./api-products";
import { Brand } from "./brands";

//Extended product type with nested relations for API responses
export interface ProductWithRelations {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  name: string;
  description?: string | null;
  brandId?: string | null;
  brand?: Brand | null;
  categoryId?: string | null;
  type: ProductType;
  kitItems?: ApiProductKitItem[];
  expirationDate?: Date | null;
  taxRateId?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  metadata: Record<string, any>;
  category?: ApiCategory;
  taxRate?: ApiTaxRate;
  variants?: ApiProductVariant[];
  productSupplier?: ApiProductSupplier[];
  stockLevels?: ApiStockLevel[];
  stockMovements?: ApiStockMovement[];
  orderItems?: ApiOrderItem[];
  defaultVariantOnly?: boolean | null;
  /** Product images (Supabase Storage URLs). */
  images?: ApiProductImage[];
  /** URL of the primary/featured image. */
  primaryImageUrl?: string | null;
}

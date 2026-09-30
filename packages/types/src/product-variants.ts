import {
  ApiProduct,
  ApiProductVariant,
  VariantPrice,
  ProductType,
} from "./api-products";

export interface CreateApiProductVariantRequest {
  type?: ProductType;
  sku?: string | undefined;
  barcode?: string | undefined;
  name?: string | undefined;
  costPrice: number;
  prices: VariantPrice[];
  minimumStock?: number | undefined;
  maximumStock?: number | undefined;
  multiple?: number | undefined;
  appliesToDiscounts?: boolean | undefined;
  attributes?: Record<string, any> | undefined;
  metadata?: Record<string, any> | undefined;
}

export interface UpdateApiProductVariantRequest
  extends Partial<CreateApiProductVariantRequest> {}

export interface ApiProductVariantsResponse {
  variants: ApiProductVariant[];
  total: number;
  page: number;
  limit: number;
}

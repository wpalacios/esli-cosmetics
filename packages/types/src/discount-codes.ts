import { UUID } from "./index";

export type DiscountType = "PERCENTAGE" | "FIXED";

export type DiscountCode = {
  id: UUID;
  code: string;
  name?: string;
  discountType: DiscountType;
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateDiscountCodeDto = {
  code: string;
  name?: string;
  discountType: DiscountType;
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
};

export type UpdateDiscountCodeDto = Partial<CreateDiscountCodeDto>;

export type DiscountCodeWithRelations = DiscountCode;

export type PaginatedDiscountCodes = {
  data: DiscountCode[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
};

// API request/response types
export type CreateDiscountCodeRequest = {
  code: string;
  name?: string;
  discountType: DiscountType;
  value: number;
  minPurchase?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startDate?: string;
  endDate?: string;
  isActive?: boolean;
};

export type UpdateDiscountCodeRequest = Partial<CreateDiscountCodeRequest>;

export type DiscountCodeResponse = DiscountCodeWithRelations;

export type DiscountCodesResponse = PaginatedDiscountCodes;

// Quote types

import { StockLevelInfo } from "./stock";
import { ApiProductKitItem, ProductType } from "./api-products";

export type QuoteStatus =
  | "DRAFT"
  | "APPROVED"
  | "EXPIRED"
  | "CONVERTED"
  | "ANNULLED";

export interface QuoteItem {
  id: string;
  quoteId: string;
  productId?: string;
  productVariantId?: string;
  priceTypeId?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxAmount?: number;
  lineTotal: number;
  metadata?: Record<string, unknown>;
  type?: ProductType;
  kitItems?: ApiProductKitItem[];
  product?: {
    id: string;
    name: string;
    sku?: string;
    brand?: {
      id: string;
      name: string;
    };
  };
  productVariant?: {
    id: string;
    name?: string;
    sku?: string;
    barcode?: string;
    product: {
      id: string;
      name: string;
      brand?: {
        id: string;
        name: string;
      };
    };
    prices?: Array<{
      priceTypeId: string;
      priceTypeName?: string;
      priceType?: {
        id: string;
        name: string;
        priority?: number;
      };
      price: number;
      minQuantity: number;
      priority?: number;
    }>;
    stockLevels?: StockLevelInfo[];
  };
}

export interface Quote {
  id: string;
  quoteNumber?: string;
  customerId?: string;
  branchId?: string;
  locationId?: string;
  sellerId?: string;
  cashierId?: string;
  createdBy?: string;
  status: QuoteStatus;
  validUntil?: string;
  discountCodeId?: string;
  discountCodeValue?: number;
  manualDiscount?: number;
  itemsDiscountTotal?: number;
  discountAmount?: number;
  subtotal?: number;
  taxes?: number;
  totalAmount?: number;
  includeTax: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  items?: QuoteItem[];
  customer?: {
    id: string;
    person?: {
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    customerType?: {
      id: string;
      name: string;
    };
  };
  seller?: {
    id: string;
    person?: {
      firstName: string;
      lastName?: string;
    };
  };
  cashier?: {
    id: string;
    person?: {
      firstName: string;
      lastName?: string;
    };
  };
  location?: {
    id: string;
    name: string;
    branchId?: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  creator?: {
    id: string;
    email: string;
  };
  discountCode?: {
    id: string;
    code: string;
    name?: string;
    discountType: "PERCENTAGE" | "FIXED";
    value: number;
  };
  orderId?: string;
}

export interface CreateQuoteItem {
  productVariantId: string;
  priceTypeId?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  type?: ProductType;
  kitItems?: ApiProductKitItem[];
}

export interface CreateQuote {
  customerId?: string;
  branchId?: string;
  locationId: string;
  sellerId: string;
  cashierId: string;
  discountCodeId?: string;
  discountCodeValue?: number;
  manualDiscount?: number;
  itemsDiscountTotal?: number;
  discountAmount?: number;
  includeTax: boolean;
  status?: QuoteStatus;
  validUntil?: string;
  items: CreateQuoteItem[];
}

export interface UpdateQuote extends Partial<CreateQuote> {}

export interface PaginatedQuotes {
  data: Quote[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConvertQuoteToOrder {
  cashSessionId?: string;
  paymentMethod?: "CASH" | "CREDIT";
  payments: Array<{
    paymentType: string;
    provider?: string | undefined;
    amount: number;
    transactionReference?: string | undefined;
  }>;
  items?: Array<{
    productVariantId: string;
    quantity: number;
    unitPrice: number;
    discountAmount?: number;
    type?: ProductType;
    kitItems?: Array<{
      productVariantId: string;
      quantity: number;
    }>;
    priceTypeId?: string;
    metadata?: Record<string, any>;
  }>;
  discountCodeValue?: number;
  manualDiscount?: number;
  includeTax?: boolean;
  creditType?: "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL";
  paymentFrequency?: "WEEKLY" | "BI_WEEKLY" | "MONTHLY";
  durationDays?: number;
  firstDueDate?: string;
  initialPayment?: number;
}

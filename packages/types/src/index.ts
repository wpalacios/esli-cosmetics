// Re-export all types from different modules
export * from "./database";
export * from "./auth";
export * from "./api";
export * from "./api-products";
export * from "./stock";
export * from "./ui";
export * from "./utils";
export * from "./employees";
export * from "./customers";
export * from "./customer-types";
export * from "./categories";
export * from "./products";
export * from "./product-variants";
export * from "./prices";
export * from "./brands";
export * from "./supplier-brands";
export * from "./discount-codes";
export * from "./tax-rates";
export * from "./report-preview";
export * from "./pos";
export * from "./permissions";
export * from "./roles";
export * from "./users";
export * from "./cash-register";
export * from "./supplier-order";
export * from "./credits";
export * from "./credit-notes";
export * from "./quotes";
export * from "./notifications";

// Common utility types
export type UUID = string;

export type BaseEntity = {
  id: UUID;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
};

export type SoftDeleteEntity = BaseEntity;

export type PaginationParams = {
  page: number;
  limit: number;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
};

export type PaginationResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
};

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

// Filter and search types
export type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "not_in";

export type Filter = {
  field: string;
  operator: FilterOperator;
  value: unknown;
};

export type SearchParams = {
  filters?: Filter[];
  search?: string;
  sort?: {
    field: string;
    direction: "asc" | "desc";
  }[];
  pagination?: {
    page: number;
    limit: number;
  };
};

// Status enums commonly used across the app
export type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "refunded";

export type PaymentType =
  | "cash"
  | "card"
  | "bank_transfer"
  | "digital_wallet"
  | "check"
  | "store_credit";

// StockMovementType and LocationType are now exported as enums from ./stock

export type UserRole =
  | "admin"
  | "store_manager"
  | "sales_rep"
  | "cashier"
  | "inventory_manager";

// Common metadata types
export type Metadata = Record<string, unknown>;

export type Address = {
  address: string;
  country_id?: UUID;
  department_id?: UUID;
  municipality_id?: UUID;
  postal_code?: string;
  geo?: {
    lat: number;
    lng: number;
  };
};

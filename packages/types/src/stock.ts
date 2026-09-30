// Stock Movement Types
export enum StockMovementType {
  PURCHASE = "PURCHASE",
  SALE = "SALE",
  POSITIVE_ADJUSTMENT = "POSITIVE_ADJUSTMENT",
  NEGATIVE_ADJUSTMENT = "NEGATIVE_ADJUSTMENT",
  TRANSFER = "TRANSFER",
  ANNULMENT = "ANNULMENT",
  DAMAGE = "DAMAGE",
  RETURN = "RETURN",
  RESTOCK = "RESTOCK",
}

export enum LocationType {
  STORE = "STORE",
  WAREHOUSE = "WAREHOUSE",
  DISTRIBUTION_CENTER = "DISTRIBUTION_CENTER",
  POPUP_STORE = "POPUP_STORE",
}

// Location interface for stock management
export interface LocationInfo {
  id: string;
  branchId?: string | null;
  name: string;
  locationType: string;
  address?: string | null;
  contact?: string | null;
  isDeleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  deletedAt?: Date | string | null;
}

// Stock Level - basic interface
export interface StockLevelInfo {
  id: string;
  productVariantId?: string | null;
  productId?: string | null;
  locationId?: string | null;
  quantity: number;
  reserved: number;
  updatedAt: Date | string;
}

export interface StockLevelWithRelations extends StockLevelInfo {
  productVariant?: {
    id: string;
    name?: string | null;
    sku?: string | null;
    product?: {
      id: string;
      name: string;
      sku?: string | null;
    };
  } | null;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
  } | null;
  location?: LocationInfo | null;
}

// Stock Movement - basic interface
export interface StockMovementInfo {
  id: string;
  productVariantId?: string | null;
  productId?: string | null;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  movementType: StockMovementType;
  quantity: number;
  reference?: string | null;
  createdBy?: string | null;
  createdAt: Date | string;
  note?: string | null;
  metadata?: Record<string, any>;
}

export interface StockMovementWithRelations extends StockMovementInfo {
  productVariant?: {
    id: string;
    name?: string | null;
    sku?: string | null;
    product?: {
      id: string;
      name: string;
      sku?: string | null;
    };
  } | null;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
  } | null;
  fromLocation?: LocationInfo | null;
  toLocation?: LocationInfo | null;
  creator?: {
    id: string;
    email: string;
  } | null;
}

// API Request Types
export interface CreateStockLevelRequest {
  productVariantId?: string;
  productId?: string;
  locationId: string;
  quantity?: number;
  reserved?: number;
}

export interface UpdateStockLevelRequest {
  quantity?: number;
  reserved?: number;
}

export interface CreateStockMovementRequest {
  productVariantId?: string;
  productId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  movementType: StockMovementType;
  quantity: number;
  reference?: string;
  note?: string;
  metadata?: Record<string, any>;
}

export interface UpdateStockMovementRequest {
  reference?: string;
  note?: string;
  metadata?: Record<string, any>;
}

// API Response Types
export interface StockLevelsResponse {
  stockLevels: StockLevelWithRelations[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StockMovementsResponse {
  stockMovements: StockMovementWithRelations[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Excel / bulk purchase import (aligned with backend DTOs) */
export type VariantDisplayNameResolveStatus =
  | "unique"
  | "not_found"
  | "ambiguous";

export interface VariantDisplayNameResolveEntry {
  normalizedName: string;
  status: VariantDisplayNameResolveStatus;
  productVariantId?: string;
  productId?: string;
  candidateCount?: number;
}

export interface ResolveVariantDisplayNamesRequest {
  names: string[];
}

export interface ResolveVariantDisplayNamesResponse {
  results: VariantDisplayNameResolveEntry[];
}

export interface BulkPurchaseImportLocationQuantity {
  locationId: string;
  quantity: number;
}

export interface BulkPurchaseImportPrice {
  priceTypeId: string;
  price: number;
}

export interface BulkPurchaseImportRow {
  productVariantId: string;
  productId: string;
  locationQuantities: BulkPurchaseImportLocationQuantity[];
  costPrice: number;
  prices: BulkPurchaseImportPrice[];
}

export interface BulkPurchaseImportRequest {
  dryRun: boolean;
  reference: string;
  note?: string;
  batchIndex?: number;
  batchCount?: number;
  rows: BulkPurchaseImportRow[];
}

export interface BulkPurchaseImportRowError {
  rowIndex: number;
  message: string;
}

export interface BulkPurchaseImportResponse {
  dryRun: boolean;
  ok: boolean;
  rowsProcessed: number;
  movementsCreated: number;
  errors: BulkPurchaseImportRowError[];
}

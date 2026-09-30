import type { UUID } from "./index";
import type { PurchaseOrderItem } from "./api";

// --- ITEM DTOs ---
export type CreatePurchaseOrderItem = {
  productVariantId: UUID | null;
  quantity: number;
  unitCost: number;
};

export type UpdatePurchaseOrderItem = Partial<CreatePurchaseOrderItem> & {
  id?: UUID;
};

// --- CREATE/UPDATE DTOs ---
export type CreateSupplierOrderRequest = {
  supplierId: UUID | null;
  branchId: UUID | null;
  brandId?: UUID | null;
  status?: string;
  expectedDate?: string;
  items: CreatePurchaseOrderItem[];
};

export type UpdateSupplierOrderRequest = Partial<
  Omit<CreateSupplierOrderRequest, "items">
> & {
  items?: UpdatePurchaseOrderItem[];
};

// --- PRODUCT DTOs ---
export type SupplierProduct = {
  id: UUID | null;
  productId: UUID | null;
  productName: string;
  items: PurchaseOrderItem[];
  productVariantId?: UUID | null;
  productVariantName?: string;
  brandId: UUID | null;
  brandName: string;
  supplierSku?: string;
  purchasePrice?: string;
};

// --- ORDER ITEM DTO ---
// export type PurchaseOrderItem = {
//   id: UUID;
//   purchaseOrderId: UUID;
//   productVariantId: UUID;
//   quantity: number;
//   unitCost?: string;
//   lineTotal?: string;
//   // Puedes agregar productVariantName si lo necesitas en frontend
//   productVariantName?: string;
// };

// --- ORDER DTO ---
export type SupplierOrder = {
  id: UUID | null;
  supplierId: UUID | null;
  branchId: UUID | null;
  brandId?: UUID | null;
  orderNumber: string;
  status?: string;
  expectedDate?: string | Date;
  total?: string;
  purchaseOrderItems: PurchaseOrderItem[];
  items: PurchaseOrderItem[];
  isDeleted?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  deletedAt?: string | Date;
  createdBy?: UUID;
};

export type UpdateSupplierOrder = Partial<SupplierOrder>;

// --- PAGINATED RESPONSE ---
export type PaginatedSupplierOrdersResponse = {
  data: SupplierOrder[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// --- DELETE RESPONSE ---
export type DeleteSupplierOrderResponse = {
  success: boolean;
  message: string;
  id: UUID;
};

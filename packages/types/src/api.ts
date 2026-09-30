import type { Customer, Employee, User } from "./auth";
import type { BaseEntity, Metadata, PaginationParams, UUID } from "./index";
import type { SupplierBrand } from "./supplier-brands";

// API Request/Response types
export type CreateRequest<T> = Omit<T, "id" | "created_at" | "updated_at">;
export type UpdateRequest<T> = Partial<
  Omit<T, "id" | "created_at" | "updated_at">
>;

// Product related types
export type Category = BaseEntity & {
  name: string;
  slug: string | null;
  description: string | null;
  parent_id: UUID | null;
  is_active: boolean;
  // Relations
  parent?: Category;
  children?: Category[];
};

export type Product = BaseEntity & {
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category_id: UUID | null;
  tax_rate_id: UUID | null;
  is_active: boolean;
  metadata: Metadata;
  // Relations
  category?: Category;
  variants?: ProductVariant[];
  suppliers?: ProductSupplier[];
};

export type ProductVariant = BaseEntity & {
  product_id: UUID;
  sku: string | null;
  barcode: string | null;
  name: string | null;
  price: number;
  retail_price: number | null;
  cost_price: number | null;
  minimum_stock: number | null;
  maximum_stock: number | null;
  attributes: Record<string, unknown> | null;
  is_active: boolean;
  // Relations
  product?: Product;
  stock_levels?: StockLevel[];
};

// Location and Branch types
export type Country = {
  id: UUID;
  name: string | null;
  code: string | null;
  is_deleted: boolean;
};

export type Department = {
  id: UUID;
  country_id: UUID | null;
  name: string | null;
  code: string | null;
  is_deleted: boolean;
  // Relations
  country?: Country;
};

export type Municipality = {
  id: UUID;
  department_id: UUID | null;
  name: string | null;
  is_deleted: boolean;
  // Relations
  department?: Department;
};

export type Branch = BaseEntity & {
  name: string;
  code: string | null;
  address: string | null;
  phone: string | null;
  manager_employee_id: UUID | null;
  is_active: boolean;
  // Relations
  manager_employee?: {
    id: string;
    person: {
      firstName: string;
      lastName?: string;
    };
  };
  locations?: Array<{
    id: string;
    name: string;
    locationType: string;
    address?: string;
    contact?: string;
  }>;
};

export type BranchWithRelations = Branch;

export type BranchesResponse = {
  data: BranchWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// Branch request types
export type CreateBranchRequest = {
  name: string;
  code?: string;
  address?: string;
  phone?: string;
  managerEmployeeId?: string;
  isActive?: boolean;
};

export type UpdateBranchRequest = Partial<CreateBranchRequest>;

// Warehouse types (using Location with type WAREHOUSE)
export type WarehouseWithRelations = Location;

export type WarehousesResponse = {
  data: WarehouseWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type CreateWarehouseRequest = {
  name: string;
  branch_id?: string;
  address?: string;
  contact?: string;
};

export type UpdateWarehouseRequest = Partial<CreateWarehouseRequest>;

export type Location = BaseEntity & {
  branch_id: UUID | null;
  name: string;
  location_type: "STORE" | "WAREHOUSE" | "DISTRIBUTION_CENTER" | "POPUP_STORE";
  address: string | null;
  contact: string | null;
  // Relations
  branch?: Branch;
  stock_levels?: StockLevel[];
};

// Supplier types
export type Supplier = BaseEntity & {
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  metadata: Metadata;
  // Relations
  brands?: SupplierBrand[];
};

export type SupplierWithRelations = Supplier & {
  brands?: SupplierBrand[];
};

export type SuppliersResponse = {
  data: SupplierWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type CreateSupplierRequest = {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  address?: string;
  brand_ids?: UUID[];
};

export type UpdateSupplierRequest = Partial<CreateSupplierRequest>;

export type ProductSupplier = {
  id: UUID;
  product_id: UUID | null;
  supplier_id: UUID | null;
  supplier_sku: string | null;
  lead_time_days: number | null;
  is_deleted: boolean;
  created_at: string;
  deleted_at: string | null;
  // Relations
  product?: Product;
  supplier?: Supplier;
};

// Inventory types
export type StockLevel = {
  id: UUID;
  product_variant_id: UUID | null;
  product_id: UUID | null;
  location_id: UUID | null;
  quantity: number;
  reserved: number;
  updated_at: string;
  // Relations
  product_variant?: ProductVariant;
  product?: Product;
  location?: Location;
};

export type StockMovement = {
  id: UUID;
  product_variant_id: UUID | null;
  product_id: UUID | null;
  from_location_id: UUID | null;
  to_location_id: UUID | null;
  movement_type:
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
  reference: string | null;
  created_by: UUID | null;
  created_at: string;
  note: string | null;
  metadata: Metadata;
  // Relations
  product_variant?: ProductVariant;
  product?: Product;
  from_location?: Location;
  to_location?: Location;
  creator?: User;
};

// Purchase Order types
export type PurchaseOrder = BaseEntity & {
  supplier_id: UUID | null;
  branch_id: UUID | null;
  status: string | null;
  expected_date: string | null;
  created_by: UUID | null;
  total: number | null;
  // Relations
  supplier?: Supplier;
  branch?: Branch;
  items?: PurchaseOrderItem[];
  creator?: User;
};

export type PurchaseOrderItem = {
  id: UUID;
  purchase_order_id: UUID | null;
  product_variant_id: UUID | null;
  quantity: number | null;
  unit_cost: number | null;
  line_total: number | null;
  // Relations
  purchase_order?: PurchaseOrder;
  product_variant?: ProductVariant;
};

// Sales and Orders types
export type Order = {
  id: UUID;
  order_number: string | null;
  customer_id: UUID | null;
  branch_id: UUID | null;
  location_id: UUID | null;
  employee_id: UUID | null;
  status: string | null;
  total_amount: number | null;
  subtotal: number | null;
  taxes: number | null;
  created_at: string;
  metadata: Metadata;
  // Relations
  customer?: Customer;
  branch?: Branch;
  location?: Location;
  employee?: Employee;
  items?: OrderItem[];
  payments?: Payment[];
};

export type OrderItem = {
  id: UUID;
  order_id: UUID | null;
  product_variant_id: UUID | null;
  product_id: UUID | null;
  price_type_id?: UUID | null;
  quantity: number | null;
  unit_price: number | null;
  discount_amount: number | null;
  tax_amount: number | null;
  line_total: number | null;
  // Relations
  order?: Order;
  product_variant?: ProductVariant;
  product?: Product;
};

export type Payment = {
  id: UUID;
  order_id: UUID | null;
  payment_type: string | null;
  provider: string | null;
  amount: number | null;
  transaction_reference: string | null;
  paid_at: string;
  created_by: UUID | null;
  // Relations
  order?: Order;
  creator?: User;
};

// Tax and Discount types
// export type TaxRate = BaseEntity & {
//   name: string | null;
//   code: string | null;
//   rate: number | null;
//   active: boolean;
// };

export type Discount = BaseEntity & {
  name: string | null;
  type: string | null;
  value: number | null;
  start_date: string | null;
  end_date: string | null;
  applies_to: string | null;
  active: boolean;
};

// Search and filter types for API
export type ProductSearchParams = {
  category_id?: UUID;
  brand?: string;
  is_active?: boolean;
  has_stock?: boolean;
  price_min?: number;
  price_max?: number;
} & PaginationParams;

export type CustomerSearchParams = {
  email?: string;
  phone?: string;
  branch_id?: UUID;
} & PaginationParams;

export type OrderSearchParams = {
  customer_id?: UUID;
  branch_id?: UUID;
  employee_id?: UUID;
  status?: string;
  date_from?: string;
  date_to?: string;
} & PaginationParams;

// Import/Export types
export type ImportExportJob = {
  id: UUID;
  type: string | null;
  entity: string | null;
  status: string | null;
  file_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_by: UUID | null;
  metadata: Metadata | null;
  // Relations
  creator?: User;
};

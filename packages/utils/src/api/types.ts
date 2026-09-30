// Common API types and interfaces
export type ApiResponse<T = unknown> = {
  data?: T;
  error?: string;
  message?: string;
};

export type PaginationQuery = {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ApiError = {
  code: string;
  message: string;
  details?: unknown;
};

// Query key factories for React Query
export const queryKeys = {
  // Auth
  auth: ["auth"] as const,
  authSession: () => [...queryKeys.auth, "session"] as const,

  // Users
  users: ["users"] as const,
  usersList: (params?: PaginationQuery) =>
    [...queryKeys.users, "list", params] as const,
  userDetail: (id: string) => [...queryKeys.users, "detail", id] as const,

  // Products
  products: ["products"] as const,
  productsList: (params?: PaginationQuery) =>
    [...queryKeys.products, "list", params] as const,
  productDetail: (id: string) => [...queryKeys.products, "detail", id] as const,
  productVariants: (productId: string) =>
    [...queryKeys.products, productId, "variants"] as const,

  // Categories
  categories: ["categories"] as const,
  categoriesList: (params?: PaginationQuery) =>
    [...queryKeys.categories, "list", params] as const,
  categoryDetail: (id: string) =>
    [...queryKeys.categories, "detail", id] as const,

  // Customers
  customers: ["customers"] as const,
  customersList: (params?: PaginationQuery) =>
    [...queryKeys.customers, "list", params] as const,
  customerDetail: (id: string) =>
    [...queryKeys.customers, "detail", id] as const,

  // Orders
  orders: ["orders"] as const,
  ordersList: (params?: PaginationQuery) =>
    [...queryKeys.orders, "list", params] as const,
  orderDetail: (id: string) => [...queryKeys.orders, "detail", id] as const,

  // Inventory
  inventory: ["inventory"] as const,
  stockLevels: (locationId?: string) =>
    [...queryKeys.inventory, "stock-levels", locationId] as const,
  stockMovements: (params?: PaginationQuery) =>
    [...queryKeys.inventory, "movements", params] as const,

  // Branches
  branches: ["branches"] as const,
  branchsList: () => [...queryKeys.branches, "list"] as const,
  branchDetail: (id: string) => [...queryKeys.branches, "detail", id] as const,

  // Reports
  reports: ["reports"] as const,
  salesReport: (params?: { from?: string; to?: string; branchId?: string }) =>
    [...queryKeys.reports, "sales", params] as const,
  inventoryReport: (params?: { locationId?: string }) =>
    [...queryKeys.reports, "inventory", params] as const,
} as const;

import type { UUID, BaseEntity, Metadata } from "./index";
import type { RoleWithPermissions } from "./roles";
import type { Permission } from "./permissions";

// User and authentication types
export type User = {
  id: UUID;
  email: string;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  deletedAt: string | null;
};

export type Person = BaseEntity & {
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  docType: string | null;
  docNumber: string | null;
  metadata: Metadata;
};

export type Employee = BaseEntity & {
  personId: UUID;
  userId: UUID | null;
  employeeCode: string | null;
  roleTitle: string | null;
  branchId: UUID | null;
  isActive: boolean;
  hiredAt: string | null;
};

export type Customer = BaseEntity & {
  personId: UUID;
  userId: UUID | null;
  externalId: string | null;
  defaultBillingAddressId: UUID | null;
  metadata: Metadata;
};

// RBAC types - Role and Permission are now imported from ./roles and ./permissions

export type UserRole = {
  id: UUID;
  userId: UUID;
  roleId: UUID;
  branchId: UUID | null;
  createdAt: string;
  isDeleted: boolean;
  deletedAt: string | null;
};

export type RolePermission = {
  id: UUID;
  roleId: UUID;
  permissionId: UUID;
  isDeleted: boolean;
  createdAt: string;
  deletedAt: string | null;
};

// Authentication session and context types
export type AuthSession = {
  user: User;
  roles: RoleWithPermissions[];
  permissions: Permission[];
  employee?: Employee;
  customer?: Customer;
  person?: Person;
};

export type LoginCredentials = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

export type RegisterData = {
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  phone?: string;
};

export type ResetPasswordData = {
  email: string;
};

export type ChangePasswordData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

// Permission system
export type PermissionKey =
  // User Management
  | "users.create"
  | "users.read"
  | "users.update"
  | "users.delete"
  // Profile Management
  | "profile.read"
  | "profile.update"
  // Customer Management
  | "customers.create"
  | "customers.read"
  | "customers.update"
  | "customers.delete"
  // Product Management
  | "products.create"
  | "products.read"
  | "products.update"
  | "products.delete"
  // Product Variants
  | "products.variants.create"
  | "products.variants.read"
  | "products.variants.update"
  | "products.variants.delete"
  // Category Management
  | "categories.create"
  | "categories.read"
  | "categories.update"
  | "categories.delete"
  // Prices Management
  | "prices.create"
  | "prices.read"
  | "prices.update"
  | "prices.delete"
  // Tax Rates Management
  | "tax.rates.create"
  | "tax.rates.read"
  | "tax.rates.update"
  | "tax.rates.delete"
  // Customer Types Management
  | "customer_types.create"
  | "customer_types.read"
  | "customer_types.update"
  | "customer_types.delete"
  // Supplier Management
  | "suppliers.read"
  | "suppliers.create"
  | "suppliers.update"
  | "suppliers.delete"
  | "supplier.read"
  | "supplier.create"
  | "supplier.update"
  | "supplier.delete"
  // Supplier Orders Management
  | "supplier-orders.read"
  | "supplier-orders.create"
  | "supplier-orders.update"
  | "supplier-orders.delete"
  // Inventory Management
  | "inventory.read"
  | "inventory.update"
  | "inventory.movements"
  // Stock Levels
  | "stock-levels.create"
  | "stock-levels.read"
  | "stock-levels.update"
  | "stock-levels.delete"
  // Stock Movements
  | "stock-movements.create"
  | "stock-movements.read"
  | "stock-movements.update"
  | "stock-movements.delete"
  // Stock Transfers
  | "stock-transfers.create"
  | "stock-transfers.read"
  | "stock-transfers.update"
  | "stock-transfers.cancel"
  // Notifications
  | "notifications.create"
  | "notifications.read"
  | "notifications.update"
  | "notifications.delete"
  // Order Management
  | "orders.create"
  | "orders.read"
  | "orders.update"
  | "orders.delete"
  | "orders.annul"
  // Quotes Management
  | "quotes.create"
  | "quotes.read"
  | "quotes.update"
  | "quotes.delete"
  | "quotes.convert"
  // POS Operations
  | "pos.access"
  | "pos.transactions"
  // Reports
  | "reports.sales"
  | "reports.inventory"
  | "reports.financial"
  | "reports.export"
  // Employee Management
  | "employees.create"
  | "employees.read"
  | "employees.update"
  | "employees.delete"
  // People Management
  | "people.create"
  | "people.read"
  | "people.update"
  | "people.delete"
  // Branch Management
  | "branch.create"
  | "branch.read"
  | "branch.update"
  | "branch.delete"
  // Warehouse Management
  | "warehouse.create"
  | "warehouse.read"
  | "warehouse.update"
  | "warehouse.delete"
  // Brand Management
  | "brands.create"
  | "brands.read"
  | "brands.update"
  | "brands.delete"
  // Discount Codes Management
  | "discount_codes.create"
  | "discount_codes.read"
  | "discount_codes.update"
  | "discount_codes.delete"
  // System Administration
  | "system.admin"
  | "system.settings"
  | "system.roles"
  // Cash Register Management
  | "cash_registers.create"
  | "cash_registers.view"
  | "cash_registers.update"
  | "cash_registers.delete"
  | "cash_sessions.open"
  | "cash_sessions.close"
  | "cash_sessions.view"
  | "cash_movements.create"
  | "cash_movements.view";

export type RoleKey =
  | "admin"
  | "store_manager"
  | "sales_rep"
  | "cashier"
  | "inventory_manager";

// Auth context and hooks
export type AuthContextType = {
  session: AuthSession | null;
  loading: boolean;
  signIn: (credentials: LoginCredentials) => Promise<AuthSession>;
  signUp: (data: RegisterData) => Promise<AuthSession>;
  signOut: () => Promise<void>;
  resetPassword: (data: ResetPasswordData) => Promise<void>;
  changePassword: (data: ChangePasswordData) => Promise<void>;
  hasPermission: (permission: PermissionKey | string) => Promise<boolean>;
  hasRole: (role: RoleKey | string) => boolean;
  refresh: () => Promise<void>;
};

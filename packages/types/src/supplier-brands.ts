import { BaseEntity, UUID } from "./index";

// Supplier-Brand relationship types
export type SupplierBrand = {
  id: UUID;
  brandId: UUID;
  supplierId: UUID;
  brandName: string;
  isDeleted: boolean;
  createdAt: string;
  deletedAt?: string;
  // Relations
  brand?: {
    id: UUID;
    name: string;
    description?: string;
    websiteUrl?: string;
    logoUrl?: string;
    country?: string;
  };
  supplier?: {
    id: UUID;
    name: string;
    contact_name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
};

// API request/response types for supplier-brand relationships
export type CreateSupplierBrandRequest = {
  brandId: UUID;
  supplierId: UUID;
};

export type UpdateSupplierBrandRequest = Partial<CreateSupplierBrandRequest>;

export type SupplierBrandResponse = SupplierBrand;

export type SupplierBrandsResponse = {
  data: SupplierBrand[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

export type DeleteSupplierBrandResponse = {
  success: boolean;
  message: string;
  id: UUID;
};

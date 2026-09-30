import { BaseEntity, UUID, Product, Supplier } from "./index";
import { SupplierBrand } from "./supplier-brands";

// Brand entity types
export type Brand = BaseEntity & {
  name: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  country?: string;
};

// Brand with relations
export type BrandWithRelations = Brand & {
  suppliers?: SupplierBrand[];
  products?: Product[];
};

// API request/response types
export type CreateBrandRequest = {
  name: string;
  description?: string;
  websiteUrl?: string;
  logoUrl?: string;
  country?: string;
};

export type UpdateBrandRequest = Partial<CreateBrandRequest>;

export type BrandResponse = BrandWithRelations;

export type BrandsResponse = {
  data: BrandWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
};

export type DeleteBrandResponse = {
  success: boolean;
  message: string;
  id: UUID;
};

// Brand supplier API types
export type CreateBrandSupplierRequest = {
  brandId: UUID;
  supplierId: UUID;
  supplierSku?: string;
  leadTimeDays?: number;
};

export type UpdateBrandSupplierRequest = Partial<CreateBrandSupplierRequest>;

export type BrandSupplierResponse = SupplierBrand;

export type BrandSuppliersResponse = {
  data: SupplierBrand[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
};

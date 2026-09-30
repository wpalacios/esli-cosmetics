// Extended category type with nested relations for API responses
export interface CategoryWithRelations {
  id: string;
  name: string;
  slug?: string | null;
  description?: string | null;
  parentId?: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;

  parent?: CategoryWithRelations | null;
  products?: {
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
  }[];
}

export interface CreateCategoryRequest {
  name: string;
  slug?: string | null;
  description?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

export interface UpdateCategoryRequest extends Partial<CreateCategoryRequest> {}

export interface CategoryFilters {
  name?: string;
  slug?: string;
  parentId?: string;
  isActive?: boolean;
  isDeleted?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CategoriesResponse {
  data: CategoryWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

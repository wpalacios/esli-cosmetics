export interface PriceType {
  id: string;
  name: string;
  description: string | null;
  minQuantity: number;
  priority: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreatePriceRequest {
  name: string;
  description?: string | null;
  minQuantity: number;
  priority: number;
  isActive?: boolean;
}

export interface UpdatePriceRequest extends Partial<CreatePriceRequest> {}

export interface PricesFilters {
  name?: string;
  description?: string;
  minQuantity?: number;
  priority?: number;
  isActive?: boolean;
  isDeleted?: boolean;
  page?: number;
  limit?: number;
  search?: string;
}

export interface PricesResponse {
  data: PriceType[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

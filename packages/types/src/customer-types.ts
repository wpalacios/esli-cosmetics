export interface CustomerType {
  id: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  isDeleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface CreateCustomerTypeRequest {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateCustomerTypeRequest {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface PaginatedCustomerTypesResponse {
  data: CustomerType[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DeleteCustomerTypeResponse {
  success: boolean;
  message: string;
}

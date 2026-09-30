// Extended employee type with nested relations for API responses
export interface EmployeeWithRelations {
  id: string;
  personId: string;
  userId?: string;
  employeeCode?: string;
  roleTitle?: string;
  locationId?: string;
  isActive: boolean;
  hiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  person?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    docType?: string;
    docNumber?: string;
  };
  user?: {
    id: string;
    email: string;
    isActive: boolean;
  };
  location?: {
    id: string;
    name: string;
    locationType?: string;
    branchId?: string;
    branch?: {
      id: string;
      name: string;
      code?: string;
    };
  };
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  docType?: string | undefined;
  docNumber?: string | undefined;
  employeeCode?: string | undefined;
  roleTitle?: string | undefined;
  locationId?: string | undefined;
  isActive?: boolean | undefined;
  hiredAt?: string | undefined;
  userId?: string | undefined;
}

export interface UpdateEmployeeRequest extends Partial<CreateEmployeeRequest> {}

export interface EmployeesResponse {
  employees: EmployeeWithRelations[];
  total: number;
  page: number;
  limit: number;
}

export interface EmployeeFilters {
  page?: number;
  limit?: number;
  search?: string;
  locationId?: string;
  isActive?: boolean;
  roleTitle?: string;
}

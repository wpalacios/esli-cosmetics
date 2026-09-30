import type { UUID, BaseEntity } from "./index";

export type RoleInfo = {
  key: string;
  name: string;
};

export type UserWithRelations = BaseEntity & {
  email: string;
  isActive: boolean;
  lastLoginAt: string | null;
  roles?: RoleInfo[]; // Role objects with key and name
  permissions?: string[]; // Permission keys
  person?: {
    id: UUID;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
  };
  employee?: {
    id: UUID;
    employeeCode?: string;
    roleTitle?: string;
    person?: {
      id: UUID;
      firstName: string;
      lastName?: string;
      phone?: string;
      email?: string;
    };
  };
};

export type CreateUserRequest = {
  email: string;
  password?: string;
  isActive?: boolean;
  roleKeys?: string[];
  employeeId?: string;
};

export type UpdateUserRequest = {
  email?: string;
  password?: string;
  isActive?: boolean;
  roleKeys?: string[];
  employeeId?: string | null;
  /** Profile / person fields (e.g. for PATCH /profile) */
  firstName?: string;
  lastName?: string;
  phone?: string;
};

export type UsersResponse = {
  data: UserWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

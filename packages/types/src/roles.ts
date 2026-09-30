import type { BaseEntity } from "./index";

export type PermissionInfo = {
  key: string;
  name: string | null;
};

export type RoleWithPermissions = BaseEntity & {
  key: string;
  name: string;
  description: string | null;
  isDeleted: boolean;
  createdAt: string;
  deletedAt: string | null;
  permissions?: PermissionInfo[]; // Permission objects with key and name
};

export type CreateRoleRequest = {
  key: string;
  name: string;
  description?: string;
};

export type UpdateRoleRequest = {
  name?: string;
  description?: string;
};

export type RolesResponse = {
  data: RoleWithPermissions[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

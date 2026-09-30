import type { UUID, BaseEntity } from "./index";

export type Permission = BaseEntity & {
  key: string;
  name: string | null;
  description: string | null;
  isDeleted: boolean;
  createdAt: string;
  deletedAt: string | null;
};

export type CreatePermissionRequest = {
  key: string;
  name: string;
  description?: string;
};

export type UpdatePermissionRequest = {
  name?: string;
  description?: string;
};

export type PermissionsResponse = {
  data: Permission[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

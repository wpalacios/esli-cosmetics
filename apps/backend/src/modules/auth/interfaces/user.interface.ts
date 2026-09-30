export interface UserWithRoles {
  id: string;
  email: string;
  isActive: boolean;
  password?: string;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
  userRoles: Array<{
    role: {
      id: string;
      key: string;
      name: string;
      rolePermissions: Array<{
        permission: {
          id: string;
          key: string;
          name: string;
        };
      }>;
    };
  }>;
}

export interface UserProfile {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
  employee?: {
    id: string;
    person?: {
      id: string;
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    location?: {
      id: string;
      name: string;
      locationType: string;
      branchId?: string;
      address?: string;
      contact?: string;
      isDeleted: boolean;
      createdAt: Date;
      updatedAt: Date;
      deletedAt?: Date;
      branch?: {
        id: string;
        name: string;
        code?: string;
      };
    };
  };
}

export interface LoginResponse {
  user: UserProfile;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface AuthenticatedRequest {
  user: UserProfile;
  headers: {
    "user-agent"?: string;
    accept?: string;
    authorization?: string;
  };
  cookies?: {
    access_token?: string;
    refresh_token?: string;
  };
}

export interface RefreshTokenUser {
  id: string;
  email: string;
  isActive: boolean;
}

export interface LogoutUser {
  id: string;
}

export interface ProfileUser {
  id: string;
  email: string;
  isActive: boolean;
  roles: string[];
  permissions: string[];
}

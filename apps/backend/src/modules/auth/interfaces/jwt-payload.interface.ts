export interface JwtPayload {
  sub: string; // User ID
  email: string;
  roles: string[];
  iat?: number;
  exp?: number;
}

export interface JwtRefreshPayload {
  sub: string; // User ID
  email: string;
  iat?: number;
  exp?: number;
}

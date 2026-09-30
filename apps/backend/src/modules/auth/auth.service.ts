import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { PrismaService } from "../../common/prisma/prisma.service";
import {
  AuthenticationException,
  ConflictException,
} from "../../common/exceptions/api.exception";
import { LoginDto } from "./dto/login.dto";
import { LogoutResponseDto } from "./dto/logout-response.dto";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { RegisterDto } from "./dto/register.dto";
import {
  ProfileUser,
  RefreshTokenUser,
} from "./interfaces/auth-service.interface";
import {
  JwtPayload,
  JwtRefreshPayload,
} from "./interfaces/jwt-payload.interface";
import {
  AuthenticatedRequest,
  LoginResponse,
  UserProfile,
  UserWithRoles,
} from "./interfaces/user.interface";

interface CachedUserProfile {
  profile: UserProfile;
  expiresAt: number;
}

@Injectable()
export class AuthService implements OnModuleDestroy {
  // In-memory cache for user profiles (5 minute TTL)
  private readonly userProfileCache = new Map<string, CachedUserProfile>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly MAX_CACHE_SIZE = 500;
  private readonly cacheCleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {
    // Clean up expired cache entries every minute
    this.cacheCleanupInterval = setInterval(
      () => this.cleanExpiredCache(),
      60 * 1000
    );
  }

  onModuleDestroy() {
    clearInterval(this.cacheCleanupInterval);
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.userProfileCache.entries()) {
      if (value.expiresAt < now) {
        this.userProfileCache.delete(key);
      }
    }
  }

  private getCachedUserProfile(userId: string): UserProfile | null {
    const cached = this.userProfileCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.profile;
    }
    if (cached) {
      this.userProfileCache.delete(userId);
    }
    return null;
  }

  private setCachedUserProfile(userId: string, profile: UserProfile): void {
    if (this.userProfileCache.size >= this.MAX_CACHE_SIZE) {
      // Delete the oldest entry (first key in Map iteration order)
      const oldestKey = this.userProfileCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.userProfileCache.delete(oldestKey);
      }
    }
    this.userProfileCache.set(userId, {
      profile,
      expiresAt: Date.now() + this.CACHE_TTL,
    });
  }

  invalidateUserCache(userId: string): void {
    this.userProfileCache.delete(userId);
  }

  async validateUser(
    email: string,
    password: string
  ): Promise<UserWithRoles | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (user && user.isActive && user.password) {
      // Compare provided password with hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        const { password: _ignoredPassword, ...result } = user;
        return result;
      }
    }
    return null;
  }

  async validateJwtPayload(payload: JwtPayload): Promise<UserProfile | null> {
    // Check cache first
    const cached = this.getCachedUserProfile(payload.sub);
    if (cached) {
      return cached;
    }

    // Fetch user with all related data in optimized queries
    // Include employee with person, location, and branch in a single query
    const [user, employee] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userRoles: {
            where: { isDeleted: false },
            include: {
              role: {
                include: {
                  rolePermissions: {
                    where: { isDeleted: false },
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      // Fetch employee with person, location, and branch in one query
      this.prisma.employee.findFirst({
        where: {
          userId: payload.sub,
          isActive: true,
          isDeleted: false,
        },
        include: {
          person: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          location: {
            select: {
              id: true,
              name: true,
              locationType: true,
              branchId: true,
              address: true,
              contact: true,
              isDeleted: true,
              createdAt: true,
              updatedAt: true,
              deletedAt: true,
              branch: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (user && user.isActive) {
      // Type assertion: Prisma returns user with includes matching UserWithRoles structure
      const userWithRoles = user as unknown as UserWithRoles;
      const profile: UserProfile = {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        roles: this.extractRoles(userWithRoles),
        permissions: this.extractPermissions(userWithRoles),
        ...(employee && {
          employee: {
            id: employee.id,
            ...(employee.person && {
              person: employee.person,
            }),
            ...(employee.location && {
              location: employee.location,
            }),
          },
        }),
      };

      // Cache the profile with all employee data
      this.setCachedUserProfile(payload.sub, profile);
      return profile;
    }
    return null;
  }

  async validateRefreshPayload(
    payload: JwtRefreshPayload
  ): Promise<{ id: string; email: string; isActive: boolean } | null> {
    if (!payload || !payload.sub) {
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (user && user.isActive) {
      return {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
      };
    }
    return null;
  }

  async login(
    loginDto: LoginDto,
    response: Response,
    _request?: AuthenticatedRequest
  ): Promise<LoginResponse> {
    // Input is already sanitized by DTO transformation
    // Additional validation happens in validateUser
    const user = await this.validateUser(
      loginDto.email.trim(),
      loginDto.password.trim()
    );

    if (!user) {
      throw new AuthenticationException(
        "Invalid email or password",
        "INVALID_CREDENTIALS"
      );
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Invalidate cache on login to ensure fresh data
    this.invalidateUserCache(user.id);

    const roles = this.extractRoles(user);
    const permissions = this.extractPermissions(user);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
    };

    // Convert seconds to string format for jsonwebtoken library
    // jsonwebtoken accepts: number (seconds) or string like "7d", "604800s"
    // Using string format ensures consistent parsing
    const expiresInSeconds = this.configService.get<number>("jwt.expiresIn");
    const refreshExpiresInSeconds = this.configService.get<number>(
      "jwt.refreshExpiresIn"
    );

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("jwt.secret"),
      expiresIn: `${expiresInSeconds}s`, // Convert to "604800s" format for reliability
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>("jwt.refreshSecret"),
      expiresIn: `${refreshExpiresInSeconds}s`, // Convert to "2592000s" format for reliability
    });

    // Always set HttpOnly cookies for web requests
    // This ensures consistent behavior for all web clients
    response.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    response.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: "/",
    });
    // Store roles in a separate HttpOnly cookie
    // Permissions are checked via HTTP queries to /api/v1/auth/check-permission endpoint
    response.cookie("user_roles", JSON.stringify(roles), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (same as access token)
      path: "/",
    });

    const userProfile = {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      roles,
      permissions,
    };

    // Always return user data (tokens are in HttpOnly cookies)
    return {
      user: userProfile,
    };
  }

  async register(
    registerDto: RegisterDto,
    response: Response
  ): Promise<LoginResponse> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException(
        "User with this email already exists",
        "EMAIL_ALREADY_EXISTS"
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user record
    const userId = uuidv4();
    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: registerDto.email,
        password: hashedPassword,
        isActive: true,
      },
    });

    // Assign default role (sales_rep)
    const defaultRole = await this.prisma.role.findUnique({
      where: { key: "sales_rep" },
    });

    if (defaultRole) {
      await this.prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: defaultRole.id,
        },
      });
    }

    // Get user with roles for token generation
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const roles = this.extractRoles(userWithRoles);
    const permissions = this.extractPermissions(userWithRoles);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      roles,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: user.id,
      email: user.email,
    };

    // Convert seconds to string format for jsonwebtoken library
    const expiresInSeconds = this.configService.get<number>("jwt.expiresIn");
    const refreshExpiresInSeconds = this.configService.get<number>(
      "jwt.refreshExpiresIn"
    );

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("jwt.secret"),
      expiresIn: `${expiresInSeconds}s`, // Convert to "604800s" format for reliability
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>("jwt.refreshSecret"),
      expiresIn: `${refreshExpiresInSeconds}s`, // Convert to "2592000s" format for reliability
    });

    // Set HttpOnly cookies (same as login) instead of returning tokens in body
    response.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    response.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: "/",
    });

    // Store roles in a separate HttpOnly cookie
    response.cookie("user_roles", JSON.stringify(roles), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (same as access token)
      path: "/",
    });

    const userProfile = {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      roles,
      permissions,
    };

    // Return only user data (tokens are in HttpOnly cookies)
    return {
      user: userProfile,
    };
  }

  async refresh(
    user: RefreshTokenUser,
    response: Response
  ): Promise<RefreshResponseDto> {
    // Validate user parameter
    if (!user || !user.id) {
      throw new AuthenticationException(
        "Invalid refresh token",
        "INVALID_REFRESH_TOKEN"
      );
    }

    // Get user with current roles and permissions
    const userWithRoles = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles || !userWithRoles.isActive) {
      throw new AuthenticationException(
        "User not found or inactive",
        "USER_NOT_FOUND_OR_INACTIVE"
      );
    }

    // Invalidate cache on refresh to ensure fresh roles/permissions
    this.invalidateUserCache(userWithRoles.id);

    const roles = this.extractRoles(userWithRoles);

    const payload: JwtPayload = {
      sub: userWithRoles.id,
      email: userWithRoles.email,
      roles,
    };

    // Convert seconds to string format for jsonwebtoken library
    const expiresInSeconds = this.configService.get<number>("jwt.expiresIn");

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>("jwt.secret"),
      expiresIn: `${expiresInSeconds}s`, // Convert to "604800s" format for reliability
    });

    // Set access_token cookie (CRITICAL: This was missing!)
    response.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/",
    });

    // Update roles cookies with fresh data
    response.cookie("user_roles", JSON.stringify(roles), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (same as access token)
      path: "/",
    });

    return {
      accessToken,
      expiresIn: this.getTokenExpirationTime(),
    };
  }

  async logout(userId: string, response: Response): Promise<LogoutResponseDto> {
    // Clear HttpOnly cookies
    response.clearCookie("access_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    response.clearCookie("refresh_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    // Clear roles cookie

    response.clearCookie("user_roles", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    // In a real implementation, you might want to blacklist the token
    // For now, we'll just return a success message
    return { message: "Logged out successfully" };
  }

  private extractRoles(user: UserWithRoles): string[] {
    return user.userRoles?.map(userRole => userRole.role.key) || [];
  }

  private extractPermissions(user: UserWithRoles): string[] {
    const permissions = new Set<string>();

    user.userRoles?.forEach(userRole => {
      userRole.role.rolePermissions?.forEach(rolePermission => {
        permissions.add(rolePermission.permission.key);
      });
    });

    return Array.from(permissions);
  }

  private getTokenExpirationTime(): number {
    // Config already returns number of seconds
    // Default to 7 days (604800 seconds) to match cookie expiration
    return this.configService.get<number>("jwt.expiresIn") || 604800; // 7 days (60*60*24*7)
  }

  async getProfile(user: ProfileUser) {
    const { id, email, isActive, roles, permissions } = user;

    // Try to get cached profile first (includes employee/person/location/branch)
    const cached = this.getCachedUserProfile(id);
    if (cached && cached.employee) {
      // Return profile data from cache, avoiding redundant database query
      return {
        id,
        email,
        isActive,
        roles,
        permissions,
        ...(cached.employee && {
          employee: {
            id: cached.employee.id,
            ...(cached.employee.person && {
              person: cached.employee.person,
            }),
          },
        }),
        ...(cached.employee?.location?.branch && {
          branch: {
            id: cached.employee.location.branch.id,
            name: cached.employee.location.branch.name,
            code: cached.employee.location.branch.code || undefined,
          },
        }),
        ...(cached.employee?.location && {
          location: {
            id: cached.employee.location.id,
            name: cached.employee.location.name,
            locationType: cached.employee.location.locationType,
            branchId: cached.employee.location.branchId || undefined,
            address: cached.employee.location.address || undefined,
            contact: cached.employee.location.contact || undefined,
            isDeleted: cached.employee.location.isDeleted,
            createdAt: cached.employee.location.createdAt,
            updatedAt: cached.employee.location.updatedAt,
            deletedAt: cached.employee.location.deletedAt || undefined,
          },
        }),
      };
    }

    // Fallback: Fetch employee data if not in cache (should rarely happen)
    const employee = await this.prisma.employee.findFirst({
      where: {
        userId: id,
        isActive: true,
        isDeleted: false,
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
            locationType: true,
            branchId: true,
            address: true,
            contact: true,
            isDeleted: true,
            createdAt: true,
            updatedAt: true,
            deletedAt: true,
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
    });

    return {
      id,
      email,
      isActive,
      roles,
      permissions,
      ...(employee && {
        employee: {
          id: employee.id,
          person: employee.person,
        },
      }),
      ...(employee?.location?.branch && {
        branch: {
          id: employee.location.branch.id,
          name: employee.location.branch.name,
          code: employee.location.branch.code || undefined,
        },
      }),
      ...(employee?.location && {
        location: {
          id: employee.location.id,
          name: employee.location.name,
          locationType: employee.location.locationType,
          branchId: employee.location.branchId || undefined,
          address: employee.location.address || undefined,
          contact: employee.location.contact || undefined,
          isDeleted: employee.location.isDeleted,
          createdAt: employee.location.createdAt,
          updatedAt: employee.location.updatedAt,
          deletedAt: employee.location.deletedAt || undefined,
        },
      }),
    };
  }

  async checkPermission(
    userId: string,
    permission: string
  ): Promise<{ hasPermission: boolean }> {
    // Try to get cached profile first to avoid database query
    const cached = this.getCachedUserProfile(userId);
    if (cached) {
      return { hasPermission: cached.permissions.includes(permission) };
    }

    // Fallback: Fetch user if not in cache (should rarely happen)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return { hasPermission: false };
    }

    const permissions = this.extractPermissions(user);
    return { hasPermission: permissions.includes(permission) };
  }
}

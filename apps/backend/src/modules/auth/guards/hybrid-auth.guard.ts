import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuthService } from "../auth.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";
import { AuthenticatedRequest } from "../interfaces/user.interface";
import { AuthenticationException } from "../../../common/exceptions/api.exception";

@Injectable()
export class HybridAuthGuard implements CanActivate {
  private readonly logger = new Logger(HybridAuthGuard.name);

  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private configService: ConfigService,
    private authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if the route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      this.logger.debug("Public route, allowing access");
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    this.logger.debug("Auth check", {
      hasToken: !!token,
      tokenLength: token?.length,
      hasAuthHeader: !!request.headers.authorization,
      hasCookies: !!request.cookies,
    });

    if (!token) {
      this.logger.warn("No token found in request");
      throw new AuthenticationException(
        "Access token not found",
        "TOKEN_NOT_FOUND"
      );
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });

      this.logger.debug("Token verified", {
        userId: payload.sub,
        email: payload.email,
        roles: payload.roles,
      });

      const user = await this.authService.validateJwtPayload(payload);
      if (!user) {
        this.logger.warn("User validation failed", { userId: payload.sub });
        throw new AuthenticationException(
          "User not found or inactive",
          "USER_NOT_FOUND_OR_INACTIVE"
        );
      }

      this.logger.debug("User validated successfully", { userId: user.id });
      // Attach user to request
      request.user = user;
      return true;
    } catch (error) {
      if (error instanceof AuthenticationException) {
        throw error;
      }
      this.logger.warn("Token validation failed", { error: error.message });
      throw new AuthenticationException("Invalid token", "INVALID_TOKEN");
    }
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    // For web browsers, prioritize cookies (set by backend)
    // Check for new backend cookies first
    const accessTokenCookie = request?.cookies?.access_token;
    if (accessTokenCookie) {
      this.logger.debug("Using access_token cookie");
      return accessTokenCookie;
    }

    // Fallback to Authorization header (for API clients)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // Only use Authorization header if no cookie token exists
      this.logger.debug("Using Authorization header token");
      return token;
    }

    // No token found
    this.logger.debug("No token found in cookies or Authorization header");
    return undefined;
  }
}

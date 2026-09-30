import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AuthService } from "../auth.service";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class JwtCookieAuthGuard implements CanActivate {
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
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromCookies(request);

    if (!token) {
      throw new UnauthorizedException("Access token not found");
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<string>("jwt.secret"),
      });

      const user = await this.authService.validateJwtPayload(payload);
      if (!user) {
        throw new UnauthorizedException("User not found or inactive");
      }

      // Attach user to request
      request.user = user;
      return true;
    } catch (error) {
      console.error("Invalid token", error);
      throw new UnauthorizedException("Invalid token");
    }
  }

  private extractTokenFromCookies(request: any): string | undefined {
    return request?.cookies?.access_token;
  }
}

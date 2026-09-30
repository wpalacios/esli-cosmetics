import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

/**
 * Guard for protecting the refresh token endpoint.
 * Uses the 'jwt-refresh' strategy to validate refresh tokens.
 *
 * Note: This guard does NOT check for @Public() decorator because:
 * 1. When explicitly applied via @UseGuards(), it should always validate
 * 2. The @Public() decorator is only meant to bypass GLOBAL guards (HybridAuthGuard)
 * 3. The refresh endpoint needs this guard to run to validate refresh tokens
 */
@Injectable()
export class JwtRefreshAuthGuard extends AuthGuard("jwt-refresh") {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Always run Passport strategy validation when this guard is explicitly applied
    const result = await super.canActivate(context);
    if (!result) {
      return false;
    }

    // Ensure user is set on request after guard activation
    const request = context.switchToHttp().getRequest();
    if (!request.user || !request.user.id) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    return true;
  }
}

import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import { JwtRefreshPayload } from "../interfaces/jwt-payload.interface";
import { AuthService } from "../auth.service";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh"
) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService
  ) {
    super({
      // Support both Authorization header (for API clients) and cookies (for web)
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First try Authorization header (Bearer token)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        // Fallback to refresh_token cookie
        (request: Request) => {
          return request?.cookies?.refresh_token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwt.refreshSecret"),
    });
  }

  async validate(payload: JwtRefreshPayload) {
    if (!payload || !payload.sub) {
      throw new UnauthorizedException("Invalid refresh token payload");
    }

    const user = await this.authService.validateRefreshPayload(payload);
    if (!user || !user.id) {
      throw new UnauthorizedException("Invalid refresh token");
    }
    return user;
  }
}

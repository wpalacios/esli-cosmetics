import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { PassportStrategy } from "@nestjs/passport";
import { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "../auth.service";
import { JwtPayload } from "../interfaces/jwt-payload.interface";

@Injectable()
export class JwtCookieStrategy extends PassportStrategy(
  Strategy,
  "jwt-cookie"
) {
  private readonly logger = new Logger(JwtCookieStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    private reflector: Reflector
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Extract JWT from HttpOnly cookies
          const token = request?.cookies?.access_token;
          this.logger.debug("JWT cookie extraction", {
            hasCookies: !!request?.cookies,
            hasAccessToken: !!token,
          });
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("jwt.secret"),
    });
  }

  async validate(payload: JwtPayload) {
    this.logger.debug("Validating JWT payload", {
      hasPayload: !!payload,
    });

    const user = await this.authService.validateJwtPayload(payload);
    if (!user) {
      this.logger.warn("JWT cookie validation failed: user not found");
      throw new UnauthorizedException();
    }

    this.logger.debug("JWT cookie validation successful");
    return user;
  }
}

import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { HybridAuthGuard } from "./guards/hybrid-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { JwtCookieAuthGuard } from "./guards/jwt-cookie-auth.guard";
import { JwtRefreshAuthGuard } from "./guards/jwt-refresh-auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { JwtCookieStrategy } from "./strategies/jwt-cookie.strategy";
import { JwtRefreshStrategy } from "./strategies/jwt-refresh.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>("jwt.secret"),
        // Don't set expiresIn at module level - set it per-call in auth.service.ts
        // This ensures each token type (access/refresh) uses correct expiration
        signOptions: {},
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtCookieStrategy,
    JwtAuthGuard,
    JwtCookieAuthGuard,
    JwtRefreshAuthGuard,
    HybridAuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    JwtCookieAuthGuard,
    JwtRefreshAuthGuard,
    HybridAuthGuard,
    RolesGuard,
  ],
})
export class AuthModule {}

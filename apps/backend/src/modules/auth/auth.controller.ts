import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Response,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Response as ExpressResponse } from "express";
import { AuthenticationException } from "../../common/exceptions/api.exception";
import { AuthService } from "./auth.service";
import { Public } from "./decorators/public.decorator";
import { JwtRefreshAuthGuard } from "./guards/jwt-refresh-auth.guard";
import {
  CheckPermissionDto,
  CheckPermissionResponseDto,
} from "./dto/check-permission.dto";
import { LoginResponseDto } from "./dto/login-response.dto";
import { LoginDto } from "./dto/login.dto";
import { LogoutResponseDto } from "./dto/logout-response.dto";
import { ProfileResponseDto } from "./dto/profile-response.dto";
import { RefreshResponseDto } from "./dto/refresh-response.dto";
import { RegisterDto } from "./dto/register.dto";
import {
  LogoutUser,
  ProfileUser,
  RefreshTokenUser,
} from "./interfaces/auth-service.interface";
import { AuthenticatedRequest } from "./interfaces/user.interface";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "User login" })
  @ApiResponse({
    status: 200,
    description: "User logged in successfully",
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid credentials",
  })
  async login(
    @Body() loginDto: LoginDto,
    @Response() res: ExpressResponse,
    @Request() req: AuthenticatedRequest
  ): Promise<void> {
    const result = await this.authService.login(loginDto, res, req);
    res.json(result);
  }

  @Public()
  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "User registration" })
  @ApiResponse({
    status: 201,
    description: "User registered successfully",
    type: LoginResponseDto,
  })
  @ApiResponse({
    status: 409,
    description: "User with this email already exists",
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Response() res: ExpressResponse
  ): Promise<void> {
    const result = await this.authService.register(registerDto, res);
    res.status(HttpStatus.CREATED).json(result);
  }

  @Public() // Make public so HybridAuthGuard doesn't validate access token
  @UseGuards(JwtRefreshAuthGuard) // Use refresh token guard instead
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Refresh access token" })
  @ApiResponse({
    status: 200,
    description: "Token refreshed successfully",
    type: RefreshResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Invalid refresh token",
  })
  async refresh(
    @Request() req: { user: RefreshTokenUser },
    @Response() res: ExpressResponse
  ): Promise<void> {
    if (!req.user?.id) {
      throw new AuthenticationException(
        "Invalid refresh token",
        "INVALID_REFRESH_TOKEN"
      );
    }
    const result = await this.authService.refresh(req.user, res);
    res.json(result);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "User logout" })
  @ApiResponse({
    status: 200,
    description: "User logged out successfully",
    type: LogoutResponseDto,
  })
  async logout(
    @Request() req: { user: LogoutUser },
    @Response() res: ExpressResponse
  ): Promise<void> {
    const result = await this.authService.logout(req.user.id, res);
    res.json(result);
  }

  @Post("me")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user info" })
  @ApiResponse({
    status: 200,
    description: "Current user information",
    type: ProfileResponseDto,
  })
  async getProfile(
    @Request() req: { user: ProfileUser }
  ): Promise<ProfileResponseDto> {
    return this.authService.getProfile(req.user);
  }

  @Post("check-permission")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Check if current user has a specific permission" })
  @ApiResponse({
    status: 200,
    description: "Permission check result",
    type: CheckPermissionResponseDto,
  })
  async checkPermission(
    @Request() req: { user: ProfileUser },
    @Body() checkPermissionDto: CheckPermissionDto
  ): Promise<CheckPermissionResponseDto> {
    return this.authService.checkPermission(
      req.user.id,
      checkPermissionDto.permission
    );
  }
}

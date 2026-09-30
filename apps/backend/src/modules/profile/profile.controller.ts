import { Body, Controller, Get, Patch, Request } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UserDto } from "../users/dto/user.dto";
import { ProfileService } from "./profile.service";
import { ProfileUser } from "../auth/interfaces/auth-service.interface";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Profile")
@Controller("profile")
@ApiBearerAuth()
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @Permissions("profile.read")
  @ApiOperation({ summary: "Get current user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile retrieved successfully",
    type: UserDto,
  })
  @ApiResponse({ status: 404, description: "User not found" })
  getProfile(@Request() req: { user: ProfileUser }): Promise<UserDto> {
    // Get user ID from authenticated request (set by auth guard)
    // Requires profile.read permission
    const userId = req.user.id;
    return this.profileService.getProfile(userId);
  }

  @Patch()
  @Permissions("profile.update")
  @ApiOperation({ summary: "Update current user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
    type: UserDto,
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 409, description: "Email already exists" })
  updateProfile(
    @Request() req: { user: ProfileUser },
    @Body() updateProfileDto: UpdateProfileDto
  ): Promise<UserDto> {
    // Get user ID from authenticated request (set by auth guard)
    // Requires profile.update permission
    // Note: Users cannot update isActive or roles through this endpoint
    const userId = req.user.id;
    return this.profileService.updateProfile(userId, updateProfileDto);
  }
}

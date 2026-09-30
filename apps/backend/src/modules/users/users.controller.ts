import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserDto } from "./dto/user.dto";
import { UsersService } from "./users.service";

@ApiTags("Users")
@Controller("users")
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Permissions("users.create")
  @ApiOperation({ summary: "Create a new user" })
  @ApiResponse({
    status: 201,
    description: "User created successfully",
    type: UserDto,
  })
  @ApiResponse({
    status: 409,
    description: "User with this email already exists",
  })
  create(@Body() createUserDto: CreateUserDto): Promise<UserDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Permissions("users.read")
  @ApiOperation({ summary: "Get all users with pagination" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10)",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by name, email, or phone",
  })
  @ApiResponse({
    status: 200,
    description: "Users retrieved successfully",
    schema: {
      type: "object",
      properties: {
        users: {
          type: "array",
          items: { $ref: "#/components/schemas/UserDto" },
        },
        total: { type: "number" },
        page: { type: "number" },
        limit: { type: "number" },
      },
    },
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("search") search?: string
  ): Promise<{ users: UserDto[]; total: number; page: number; limit: number }> {
    return this.usersService.findAll(page, limit, search);
  }

  @Get(":id")
  @Permissions("users.read")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiResponse({
    status: 200,
    description: "User retrieved successfully",
    type: UserDto,
  })
  @ApiResponse({ status: 404, description: "User not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<UserDto> {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @Permissions("users.update")
  @ApiOperation({ summary: "Update user by ID" })
  @ApiResponse({
    status: 200,
    description: "User updated successfully",
    type: UserDto,
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 409, description: "Email already exists" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto
  ): Promise<UserDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @Permissions("users.delete")
  @ApiOperation({ summary: "Delete user by ID" })
  @ApiResponse({
    status: 200,
    description: "User deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "User not found" })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.usersService.remove(id);
  }
}

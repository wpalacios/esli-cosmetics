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
import { CreatePermissionDto } from "./dto/create-permission.dto";
import { PermissionDto } from "./dto/permission.dto";
import { UpdatePermissionDto } from "./dto/update-permission.dto";
import { PermissionsService } from "./permissions.service";

@ApiTags("Permissions")
@Controller("permissions")
@ApiBearerAuth()
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post()
  @Permissions("system.roles")
  @ApiOperation({ summary: "Create a new permission" })
  @ApiResponse({
    status: 201,
    description: "Permission created successfully",
    type: PermissionDto,
  })
  @ApiResponse({
    status: 409,
    description: "Permission with this key already exists",
  })
  create(
    @Body() createPermissionDto: CreatePermissionDto
  ): Promise<PermissionDto> {
    return this.permissionsService.create(createPermissionDto);
  }

  @Get()
  @Permissions("system.roles")
  @ApiOperation({ summary: "Get all permissions with pagination" })
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
  @ApiResponse({
    status: 200,
    description: "Permissions retrieved successfully",
    schema: {
      type: "object",
      properties: {
        permissions: {
          type: "array",
          items: { $ref: "#/components/schemas/PermissionDto" },
        },
        total: { type: "number" },
        page: { type: "number" },
        limit: { type: "number" },
      },
    },
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number
  ): Promise<{
    permissions: PermissionDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.permissionsService.findAll(page, limit);
  }

  @Get(":id")
  @Permissions("system.roles")
  @ApiOperation({ summary: "Get permission by ID" })
  @ApiResponse({
    status: 200,
    description: "Permission retrieved successfully",
    type: PermissionDto,
  })
  @ApiResponse({ status: 404, description: "Permission not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<PermissionDto> {
    return this.permissionsService.findOne(id);
  }

  @Patch(":id")
  @Permissions("system.roles")
  @ApiOperation({ summary: "Update permission by ID" })
  @ApiResponse({
    status: 200,
    description: "Permission updated successfully",
    type: PermissionDto,
  })
  @ApiResponse({ status: 404, description: "Permission not found" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updatePermissionDto: UpdatePermissionDto
  ): Promise<PermissionDto> {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @Delete(":id")
  @Permissions("system.roles")
  @ApiOperation({ summary: "Delete permission by ID" })
  @ApiResponse({
    status: 200,
    description: "Permission deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Permission not found" })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.permissionsService.remove(id);
  }
}

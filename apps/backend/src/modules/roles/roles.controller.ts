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
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { CreateRoleDto } from "./dto/create-role.dto";
import { RoleDto } from "./dto/role.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { RolesService } from "./roles.service";

@ApiTags("Roles")
@Controller("roles")
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Permissions("system.roles")
  @ApiOperation({ summary: "Create a new role" })
  @ApiResponse({
    status: 201,
    description: "Role created successfully",
    type: RoleDto,
  })
  @ApiResponse({
    status: 409,
    description: "Role with this key already exists",
  })
  create(@Body() createRoleDto: CreateRoleDto): Promise<RoleDto> {
    return this.rolesService.create(createRoleDto);
  }

  @Get()
  @Permissions("system.roles")
  @ApiOperation({ summary: "Get all roles with pagination" })
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
    description: "Roles retrieved successfully",
    schema: {
      type: "object",
      properties: {
        roles: {
          type: "array",
          items: { $ref: "#/components/schemas/RoleDto" },
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
  ): Promise<{ roles: RoleDto[]; total: number; page: number; limit: number }> {
    return this.rolesService.findAll(page, limit);
  }

  @Get(":id")
  @Permissions("system.roles")
  @ApiOperation({ summary: "Get role by ID" })
  @ApiResponse({
    status: 200,
    description: "Role retrieved successfully",
    type: RoleDto,
  })
  @ApiResponse({ status: 404, description: "Role not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<RoleDto> {
    return this.rolesService.findOne(id);
  }

  @Patch(":id")
  @Permissions("system.roles")
  @ApiOperation({ summary: "Update role by ID" })
  @ApiResponse({
    status: 200,
    description: "Role updated successfully",
    type: RoleDto,
  })
  @ApiResponse({ status: 404, description: "Role not found" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateRoleDto: UpdateRoleDto
  ): Promise<RoleDto> {
    return this.rolesService.update(id, updateRoleDto);
  }

  @Delete(":id")
  @Permissions("system.roles")
  @ApiOperation({ summary: "Delete role by ID" })
  @ApiResponse({
    status: 200,
    description: "Role deleted successfully",
    schema: {
      type: "object",
      properties: {
        message: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Role not found" })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<{ message: string }> {
    return this.rolesService.remove(id);
  }

  @Post(":id/permissions")
  @Permissions("system.roles")
  @ApiOperation({ summary: "Assign permissions to role" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        permissionKeys: {
          type: "array",
          items: { type: "string" },
          example: ["products.read", "products.create"],
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "Permissions assigned successfully",
    type: RoleDto,
  })
  @ApiResponse({ status: 404, description: "Role not found" })
  assignPermissions(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: { permissionKeys: string[] }
  ): Promise<RoleDto> {
    return this.rolesService.assignPermissions(id, body.permissionKeys);
  }
}

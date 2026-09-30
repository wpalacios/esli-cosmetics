import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { WarehousesService } from "./warehouses.service";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { WarehouseDto } from "./dto/warehouse.dto";
import { PaginatedWarehousesDto } from "./dto/paginated-warehouses.dto";
import { DeleteWarehouseResponseDto } from "./dto/delete-warehouse-response.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Warehouses")
@Controller("warehouses")
@ApiBearerAuth()
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Post()
  @Permissions("warehouse.create")
  @ApiOperation({ summary: "Create a new warehouse" })
  @ApiResponse({
    status: 201,
    description: "Warehouse created successfully",
    type: WarehouseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Branch not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async create(
    @Body() createWarehouseDto: CreateWarehouseDto
  ): Promise<WarehouseDto> {
    return this.warehousesService.create(createWarehouseDto);
  }

  @Get()
  @Permissions("warehouse.read")
  @ApiOperation({ summary: "Get all warehouses with pagination and search" })
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
    description: "Search term for name, address, contact, or branch",
  })
  @ApiResponse({
    status: 200,
    description: "Warehouses retrieved successfully",
    type: PaginatedWarehousesDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("search") search?: string
  ): Promise<PaginatedWarehousesDto> {
    return this.warehousesService.findAll(page, limit, search);
  }

  @Get(":id")
  @Permissions("warehouse.read")
  @ApiOperation({ summary: "Get a warehouse by ID" })
  @ApiResponse({
    status: 200,
    description: "Warehouse retrieved successfully",
    type: WarehouseDto,
  })
  @ApiResponse({ status: 404, description: "Warehouse not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<WarehouseDto> {
    return this.warehousesService.findOne(id);
  }

  @Patch(":id")
  @Permissions("warehouse.update")
  @ApiOperation({ summary: "Update a warehouse" })
  @ApiResponse({
    status: 200,
    description: "Warehouse updated successfully",
    type: WarehouseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Warehouse or branch not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto
  ): Promise<WarehouseDto> {
    return this.warehousesService.update(id, updateWarehouseDto);
  }

  @Delete(":id")
  @Permissions("warehouse.delete")
  @ApiOperation({ summary: "Delete a warehouse (soft delete)" })
  @ApiResponse({
    status: 200,
    description: "Warehouse deleted successfully",
    type: DeleteWarehouseResponseDto,
  })
  @ApiResponse({ status: 404, description: "Warehouse not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteWarehouseResponseDto> {
    return this.warehousesService.remove(id);
  }
}

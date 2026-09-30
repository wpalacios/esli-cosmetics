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
import { SuppliersService } from "./suppliers.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SupplierDto } from "./dto/supplier.dto";
import { PaginatedSuppliersDto } from "./dto/paginated-suppliers.dto";
import { DeleteSupplierResponseDto } from "./dto/delete-supplier-response.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Suppliers")
@Controller("suppliers")
@ApiBearerAuth()
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Post()
  @Permissions("supplier.create")
  @ApiOperation({ summary: "Create a new supplier" })
  @ApiResponse({
    status: 201,
    description: "Supplier created successfully",
    type: SupplierDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({
    status: 409,
    description: "Supplier with this name already exists",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async create(
    @Body() createSupplierDto: CreateSupplierDto
  ): Promise<SupplierDto> {
    return this.suppliersService.create(createSupplierDto);
  }

  @Get()
  @Permissions("supplier.read")
  @ApiOperation({ summary: "Get all suppliers with pagination and search" })
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
    description: "Search term for name, contact, phone, email, or address",
  })
  @ApiResponse({
    status: 200,
    description: "Suppliers retrieved successfully",
    type: PaginatedSuppliersDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("search") search?: string
  ): Promise<PaginatedSuppliersDto> {
    return this.suppliersService.findAll(page, limit, search);
  }

  @Get(":id")
  @Permissions("supplier.read")
  @ApiOperation({ summary: "Get a supplier by ID" })
  @ApiResponse({
    status: 200,
    description: "Supplier retrieved successfully",
    type: SupplierDto,
  })
  @ApiResponse({ status: 404, description: "Supplier not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<SupplierDto> {
    return this.suppliersService.findOne(id);
  }

  @Patch(":id")
  @Permissions("supplier.update")
  @ApiOperation({ summary: "Update a supplier" })
  @ApiResponse({
    status: 200,
    description: "Supplier updated successfully",
    type: SupplierDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Supplier not found" })
  @ApiResponse({
    status: 409,
    description: "Supplier with this name already exists",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateSupplierDto: UpdateSupplierDto
  ): Promise<SupplierDto> {
    return this.suppliersService.update(id, updateSupplierDto);
  }

  @Delete(":id")
  @Permissions("supplier.delete")
  @ApiOperation({ summary: "Delete a supplier (soft delete)" })
  @ApiResponse({
    status: 200,
    description: "Supplier deleted successfully",
    type: DeleteSupplierResponseDto,
  })
  @ApiResponse({ status: 404, description: "Supplier not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteSupplierResponseDto> {
    return this.suppliersService.remove(id);
  }
}

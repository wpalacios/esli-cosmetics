import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
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
import { CreateSupplierOrderDto } from "./dto/create-supplier-order.dto";
import { DeleteSupplierOrderResponseDto } from "./dto/delete-supplier-order.dto";
import { PaginatedSupplierOrdersDto } from "./dto/paginated-supplier-order.dto";
import { PurchaseOrderDto } from "./dto/supplier-order.dto";
import { UpdateSupplierOrderDto } from "./dto/update-supplier-order.dto";
import { SupplierOrderService } from "./supplier-order.service";

@ApiTags("Supplier Orders")
@Controller("supplier-orders")
@ApiBearerAuth()
export class SupplierOrderController {
  constructor(private readonly supplierOrderService: SupplierOrderService) {}

  @Get()
  @Permissions("supplier-orders.read")
  @ApiOperation({ summary: "Get all supplier orders with pagination" })
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
    description: "Supplier orders retrieved",
    type: PaginatedSupplierOrdersDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number
  ): Promise<PaginatedSupplierOrdersDto> {
    return this.supplierOrderService.findAll(page, limit);
  }

  @Get("search")
  @Permissions("supplier-orders.read")
  @ApiOperation({ summary: "Search supplier orders" })
  @ApiQuery({
    name: "search",
    required: true,
    type: String,
    description: "Search term",
  })
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
    description: "Paginated list of supplier orders",
    type: PaginatedSupplierOrdersDto,
  })
  searchSupplierOrders(
    @Query("search") search: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10
  ): Promise<PaginatedSupplierOrdersDto> {
    return this.supplierOrderService.searchSupplierOrder(search, page, limit);
  }

  @Get(":id")
  @Permissions("supplier-orders.read")
  @ApiOperation({ summary: "Get supplier order by ID" })
  @ApiResponse({
    status: 200,
    description: "Supplier order retrieved",
    type: PurchaseOrderDto,
  })
  @ApiResponse({ status: 404, description: "Supplier order not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<PurchaseOrderDto> {
    return this.supplierOrderService.findOne(id);
  }

  @Post()
  @Permissions("supplier-orders.create")
  @ApiOperation({ summary: "Create a new supplier order" })
  @ApiResponse({
    status: 201,
    description: "Supplier order created",
    type: PurchaseOrderDto,
  })
  create(@Body() createDto: CreateSupplierOrderDto): Promise<PurchaseOrderDto> {
    return this.supplierOrderService.create(createDto);
  }

  @Put(":id")
  @Permissions("supplier-orders.update")
  @ApiOperation({ summary: "Update a supplier order by ID" })
  @ApiResponse({
    status: 200,
    description: "Supplier order updated",
    type: PurchaseOrderDto,
  })
  @ApiResponse({ status: 404, description: "Supplier order not found" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateSupplierOrderDto
  ): Promise<PurchaseOrderDto> {
    const result = await this.supplierOrderService.update(id, updateDto);
    return result;
  }

  @Delete(":id")
  @Permissions("supplier-orders.delete")
  @ApiOperation({ summary: "Soft delete a supplier order by ID" })
  @ApiResponse({
    status: 200,
    description: "Supplier order deleted",
    type: DeleteSupplierOrderResponseDto,
  })
  @ApiResponse({ status: 404, description: "Supplier order not found" })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteSupplierOrderResponseDto> {
    return this.supplierOrderService.remove(id);
  }

  // Get products by Brand ID
  @Get("by-brand/:brandId")
  @Permissions("supplier-orders.read")
  @ApiOperation({
    summary: "Get all product variants for a specific brand with global stock",
  })
  @ApiResponse({
    status: 200,
    description: "List of variants for the brand with global stock",
  })
  async getByBrand(
    @Param("brandId", ParseUUIDPipe) brandId: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10
  ) {
    return this.supplierOrderService.getVariantsByBrandWithStock(
      brandId,
      page,
      limit
    );
  }
}

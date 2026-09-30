import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { StockMovementsService } from "./stock-movements.service";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";
import { StockMovementDto } from "./dto/stock-movement.dto";
import { PaginatedStockMovementDto } from "./dto/paginated-stock-movement.dto";
import { ResolveVariantDisplayNamesDto } from "./dto/resolve-variant-display-names.dto";
import { BulkPurchaseImportDto } from "./dto/bulk-purchase-import.dto";
import { BulkPurchaseImportResponseDto } from "./dto/bulk-purchase-import-response.dto";
import { ResolveVariantDisplayNamesResponseDto } from "./dto/resolve-variant-display-names-response.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";

@ApiTags("Stock Movements")
@Controller("stock-movements")
@ApiBearerAuth()
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Post()
  @Permissions("stock-movements.create")
  @ApiOperation({ summary: "Create a new stock movement" })
  @ApiResponse({
    status: 201,
    description: "Stock movement created successfully",
    type: StockMovementDto,
  })
  create(
    @Body() createDto: CreateStockMovementDto,
    @Request() req: AuthenticatedRequest
  ): Promise<StockMovementDto> {
    const userId = req.user?.id;
    return this.stockMovementsService.create(createDto, userId);
  }

  @Post("resolve-variant-display-names")
  @Permissions("stock-movements.create")
  @ApiOperation({
    summary: "Resolve variant display names to IDs (batch, read-only)",
  })
  @ApiResponse({
    status: 200,
    description: "Per-name resolution status",
    type: ResolveVariantDisplayNamesResponseDto,
  })
  resolveVariantDisplayNames(
    @Body() body: ResolveVariantDisplayNamesDto
  ): Promise<ResolveVariantDisplayNamesResponseDto> {
    return this.stockMovementsService.resolveVariantDisplayNames(body);
  }

  @Post("bulk-purchase-import")
  @Permissions("stock-movements.create")
  @ApiOperation({
    summary:
      "Bulk PURCHASE import from pre-parsed rows (transaction per request)",
  })
  @ApiResponse({
    status: 200,
    description: "Import result",
    type: BulkPurchaseImportResponseDto,
  })
  bulkPurchaseImport(
    @Body() body: BulkPurchaseImportDto,
    @Request() req: AuthenticatedRequest
  ): Promise<BulkPurchaseImportResponseDto> {
    const userId = req.user?.id;
    return this.stockMovementsService.bulkPurchaseImport(body, userId);
  }

  @Get()
  @Permissions("stock-movements.read")
  @ApiOperation({ summary: "Get all stock movements with pagination" })
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
    description: "Number of items per page (default: 10)",
  })
  @ApiQuery({
    name: "fromLocationId",
    required: false,
    type: String,
    description: "Filter by source location ID",
  })
  @ApiQuery({
    name: "toLocationId",
    required: false,
    type: String,
    description: "Filter by destination location ID",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description:
      "Start of the creation date range (YYYY-MM-DD, business time zone)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description:
      "End of the creation date range (YYYY-MM-DD, business time zone)",
  })
  @ApiResponse({
    status: 200,
    description: "Stock movements retrieved successfully",
    type: PaginatedStockMovementDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number,
    @Query("fromLocationId") fromLocationId?: string,
    @Query("toLocationId") toLocationId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ): Promise<PaginatedStockMovementDto> {
    return this.stockMovementsService.findAll(page, limit, {
      fromLocationId,
      toLocationId,
      startDate,
      endDate,
    });
  }

  @Get("search")
  @Permissions("stock-movements.read")
  @ApiOperation({
    summary: "Search stock movements",
    description: "Search by product name, SKU, reference, or location name",
  })
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
  @ApiQuery({
    name: "fromLocationId",
    required: false,
    type: String,
    description: "Filter by source location ID",
  })
  @ApiQuery({
    name: "toLocationId",
    required: false,
    type: String,
    description: "Filter by destination location ID",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description:
      "Start of the creation date range (YYYY-MM-DD, business time zone)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description:
      "End of the creation date range (YYYY-MM-DD, business time zone)",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of stock movements matching the search term",
    type: PaginatedStockMovementDto,
  })
  async searchStockMovements(
    @Query("search") search?: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10,
    @Query("fromLocationId") fromLocationId?: string,
    @Query("toLocationId") toLocationId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ): Promise<PaginatedStockMovementDto> {
    return this.stockMovementsService.searchStockMovements(
      search,
      page,
      limit,
      { fromLocationId, toLocationId, startDate, endDate }
    );
  }

  @Get("product/:productId")
  @Permissions("stock-movements.read")
  @ApiOperation({
    summary: "Get movement history for a specific product",
    description:
      "Returns all stock movements for a product, optionally filtered by variant",
  })
  @ApiQuery({
    name: "productVariantId",
    required: false,
    type: String,
    description: "Product variant ID (optional)",
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
    description: "Movement history retrieved successfully",
    type: PaginatedStockMovementDto,
  })
  findByProduct(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Query("productVariantId", new ParseUUIDPipe({ optional: true }))
    productVariantId?: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10
  ): Promise<PaginatedStockMovementDto> {
    return this.stockMovementsService.findByProduct(
      productId,
      productVariantId,
      page,
      limit
    );
  }

  @Get("location/:locationId")
  @Permissions("stock-movements.read")
  @ApiOperation({
    summary: "Get movement history for a specific location",
    description:
      "Returns all stock movements involving a location (as source or destination)",
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
    description: "Movement history retrieved successfully",
    type: PaginatedStockMovementDto,
  })
  findByLocation(
    @Param("locationId", ParseUUIDPipe) locationId: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10
  ): Promise<PaginatedStockMovementDto> {
    return this.stockMovementsService.findByLocation(locationId, page, limit);
  }

  @Get(":id")
  @Permissions("stock-movements.read")
  @ApiOperation({ summary: "Get stock movement by ID" })
  @ApiResponse({
    status: 200,
    description: "Stock movement retrieved successfully",
    type: StockMovementDto,
  })
  @ApiResponse({ status: 404, description: "Stock movement not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<StockMovementDto> {
    return this.stockMovementsService.findOne(id);
  }

  // NOTE: Stock movements are immutable - no update or delete endpoints
  // Corrections should be handled by creating new opposing movements
}

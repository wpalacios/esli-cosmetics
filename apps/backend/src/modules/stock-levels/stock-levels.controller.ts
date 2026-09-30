import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
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
import { BatchStockLevelsByLocationDto } from "./dto/batch-stock-levels-by-location.dto";
import { CreateStockLevelDto } from "./dto/create-stock-level.dto";
import { PaginatedStockLevelDto } from "./dto/paginated-stock-level.dto";
import { KitAvailabilityDto, StockLevelDto } from "./dto/stock-level.dto";
import { StockLevelsService } from "./stock-levels.service";

@ApiTags("Stock Levels")
@Controller("stock-levels")
@ApiBearerAuth()
export class StockLevelsController {
  constructor(private readonly stockLevelsService: StockLevelsService) {}

  // TODO: evaluate if we need to create a stock level from API
  @Post()
  @Permissions("stock-levels.create")
  @ApiOperation({ summary: "Create a new stock level" })
  @ApiResponse({
    status: 201,
    description: "Stock level created successfully",
    type: StockLevelDto,
  })
  @ApiResponse({
    status: 409,
    description: "Stock level already exists for this combination",
  })
  create(@Body() createDto: CreateStockLevelDto): Promise<StockLevelDto> {
    return this.stockLevelsService.create(createDto);
  }

  @Get()
  @Permissions("stock-levels.read")
  @ApiOperation({ summary: "Get all stock levels with pagination" })
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
    name: "locationId",
    required: false,
    type: String,
    description: "Filter by location ID",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description:
      "Start of the last-updated date range (YYYY-MM-DD, business time zone)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description:
      "End of the last-updated date range (YYYY-MM-DD, business time zone)",
  })
  @ApiResponse({
    status: 200,
    description: "Stock levels retrieved successfully",
    type: PaginatedStockLevelDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number,
    @Query("locationId") locationId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ): Promise<PaginatedStockLevelDto> {
    return this.stockLevelsService.findAll(page, limit, {
      locationId,
      startDate,
      endDate,
    });
  }

  @Get("search")
  @Permissions("stock-levels.read")
  @ApiOperation({
    summary: "Search stock levels",
    description: "Search by product name, SKU, or location name",
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
    name: "locationId",
    required: false,
    type: String,
    description: "Filter by location ID",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description:
      "Start of the last-updated date range (YYYY-MM-DD, business time zone)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description:
      "End of the last-updated date range (YYYY-MM-DD, business time zone)",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of stock levels matching the search term",
    type: PaginatedStockLevelDto,
  })
  async searchStockLevels(
    @Query("search") search?: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10,
    @Query("locationId") locationId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string
  ): Promise<PaginatedStockLevelDto> {
    return this.stockLevelsService.searchStockLevels(search, page, limit, {
      locationId,
      startDate,
      endDate,
    });
  }

  @Post("kit-availability")
  @Permissions("stock-levels.read")
  @ApiOperation({
    summary: "Get kit availability by kit variant IDs",
    description:
      "Receives one or many KIT variant IDs, resolves kit items in backend, and returns per-location component stock plus kitsAvailable.",
  })
  @ApiResponse({
    status: 200,
    description: "Kit availability retrieved successfully",
    type: KitAvailabilityDto,
    isArray: true,
  })
  async getKitStockLevelsByLocationPost(
    @Body("kitVariantIds") kitVariantIds: string[]
  ): Promise<KitAvailabilityDto[]> {
    if (!Array.isArray(kitVariantIds)) {
      throw new BadRequestException(
        "kitVariantIds must be an array of strings"
      );
    }
    return this.stockLevelsService.getKitStockLevelsByLocation(kitVariantIds);
  }

  @Post("batch/by-location")
  @Permissions("stock-levels.read")
  @ApiOperation({
    summary:
      "Batch get stock levels for multiple product variants at a location",
    description:
      "Efficiently fetch stock levels for multiple product variants at a specific location. Used for POS checkout validation. Uses POST to avoid URL length limitations when dealing with large numbers of product variants.",
  })
  @ApiResponse({
    status: 200,
    description: "Stock levels retrieved successfully",
    type: [StockLevelDto],
  })
  async findByProductVariantsAndLocation(
    @Body() dto: BatchStockLevelsByLocationDto
  ): Promise<StockLevelDto[]> {
    return this.stockLevelsService.findByProductVariantsAndLocation(
      dto.productVariantIds,
      dto.locationId
    );
  }

  @Get(":productVariantId/all-locations-availability")
  @Permissions("stock-levels.read")
  @ApiOperation({ summary: "Get all stock levels for a product variant" })
  @ApiResponse({
    status: 200,
    description: "Stock levels retrieved successfully",
    type: [StockLevelDto],
  })
  async findByProductVariant(
    @Param("productVariantId", ParseUUIDPipe) productVariantId: string
  ): Promise<StockLevelDto[]> {
    return this.stockLevelsService.findByProductVariant(productVariantId);
  }

  @Get(":id")
  @Permissions("stock-levels.read")
  @ApiOperation({ summary: "Get stock level by ID" })
  @ApiResponse({
    status: 200,
    description: "Stock level retrieved successfully",
    type: StockLevelDto,
  })
  @ApiResponse({ status: 404, description: "Stock level not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<StockLevelDto> {
    return this.stockLevelsService.findOne(id);
  }

  // TODO: evaluate if we need to update a stock level from API
  // @Put(":id")
  // @Permissions("stock-levels.update")
  // @ApiOperation({ summary: "Update a stock level by ID" })
  // @ApiResponse({
  //   status: 200,
  //   description: "Stock level updated successfully",
  //   type: StockLevelDto,
  // })
  // @ApiResponse({ status: 404, description: "Stock level not found" })
  // update(
  //   @Param("id", ParseUUIDPipe) id: string,
  //   @Body() updateDto: UpdateStockLevelDto
  // ): Promise<StockLevelDto> {
  //   return this.stockLevelsService.update(id, updateDto);
  // }

  // TODO: evaluate if we need to delete a stock level from API
  // @Delete(":id")
  // @Permissions("stock-levels.delete")
  // @ApiOperation({ summary: "Delete a stock level by ID" })
  // @ApiResponse({
  //   status: 200,
  //   description: "Stock level deleted successfully",
  //   type: DeleteStockLevelResponseDto,
  // })
  // @ApiResponse({ status: 404, description: "Stock level not found" })
  // remove(
  //   @Param("id", ParseUUIDPipe) id: string
  // ): Promise<DeleteStockLevelResponseDto> {
  //   return this.stockLevelsService.remove(id);
  // }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { PricesService } from "./prices.service";
import { CreatePriceDto } from "./dto/create-price.dto";
import { PriceDto } from "./dto/prices.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PaginatedPricesDto } from "./dto/paginated-prices.dto";
import { UpdatePriceDto } from "./dto/update-price.dto";
import { DeletePriceResponseDto } from "./dto/delete-price.dto";

@ApiTags("Prices")
@Controller("prices")
@ApiBearerAuth()
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Post()
  @Permissions("prices.create")
  @ApiOperation({ summary: "Create a new price" })
  @ApiResponse({
    status: 201,
    description: "Price created successfully",
    type: PriceDto,
  })
  @ApiResponse({
    status: 409,
    description: "A price with this name already exists",
  })
  create(@Body() createPriceDto: CreatePriceDto): Promise<PriceDto> {
    return this.pricesService.create(createPriceDto);
  }

  @Get()
  @Permissions("prices.read")
  @ApiOperation({ summary: "Get all prices with pagination" })
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
    description: "Number of prices per page (default: 10)",
  })
  @ApiResponse({
    status: 200,
    description: "Prices retrieved successfully",
    type: PaginatedPricesDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number
  ): Promise<PaginatedPricesDto> {
    return this.pricesService.findAll(page, limit);
  }

  @Get("search")
  @Permissions("prices.read")
  @ApiOperation({
    summary: "Search prices by name or description",
    description: `
    Search for prices by a single search term.
    The search in case-insensitive and matches partial values in:
    - Price name
    - Price description
    
    Example:
    ?search=VIP -> finds all prices with 'VIP' in any of those fields.
    `,
  })
  @ApiQuery({
    name: "search",
    required: true,
    type: String,
    description: "Search term (matches name or description)",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (deafult: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10)",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of prices matching the search term",
    type: PaginatedPricesDto,
  })
  @ApiResponse({ status: 400, description: "Search term is required" })
  searchPrices(
    @Query("search") search?: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10
  ): Promise<PaginatedPricesDto> {
    if (!search) {
      throw new BadRequestException("You must provide a search term");
    }
    return this.pricesService.searchPrices(search, page, limit);
  }

  @Get(":id")
  @Permissions("prices.read")
  @ApiOperation({ summary: "Get price by ID" })
  @ApiResponse({
    status: 200,
    description: "Price retrieved successfully",
    type: PriceDto,
  })
  @ApiResponse({
    status: 404,
    description: "Price not found",
  })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<PriceDto> {
    return this.pricesService.findOne(id);
  }

  @Put(":id")
  @Permissions("prices.update")
  @ApiOperation({ summary: "Update a price by ID" })
  @ApiResponse({
    status: 200,
    description: "Price updated successfully",
    type: PriceDto,
  })
  @ApiResponse({
    status: 404,
    description: "Product not found",
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updatePriceDto: UpdatePriceDto
  ): Promise<PriceDto> {
    return this.pricesService.update(id, updatePriceDto);
  }

  @Delete(":id")
  @Permissions("prices.delete")
  @ApiOperation({ summary: "Delete a price by ID" })
  @ApiResponse({
    status: 200,
    description: "Price deleted successfully",
    type: DeletePriceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Price not found",
  })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeletePriceResponseDto> {
    return this.pricesService.remove(id);
  }
}

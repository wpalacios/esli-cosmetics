import {
  BadRequestException,
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
import { CreateTaxRateDto } from "./dto/create-tax-rates.dto";
import { DeleteTaxRateResponseDto } from "./dto/delete-tax-rates.dto";
import { PaginatedTaxRateDto } from "./dto/paginated-tax-rates.dto";
import { TaxRateDto } from "./dto/tax-rates.dto";
import { UpdateTaxRateDto } from "./dto/update-tax-rates.dto";
import { TaxRatesService } from "./tax-rates.service";
@ApiTags("TaxRates")
@Controller("tax-rates")
@ApiBearerAuth()
export class TaxRatesController {
  constructor(private readonly taxRatesService: TaxRatesService) {}

  @Post()
  @Permissions("tax.rates.create")
  @ApiOperation({ summary: "Create a new tax rate" })
  @ApiResponse({
    status: 201,
    description: "Tax rate created successfully",
    type: TaxRateDto,
  })
  @ApiResponse({ status: 409, description: "Tax rate conflict" })
  create(@Body() createTaxRateDto: CreateTaxRateDto): Promise<TaxRateDto> {
    return this.taxRatesService.create(createTaxRateDto);
  }

  @Get()
  @Permissions("tax.rates.read")
  @ApiOperation({ summary: "Get all tax rates with pagination" })
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
  @ApiResponse({
    status: 200,
    description: "Tax rates retrieved successfully",
    type: PaginatedTaxRateDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10
  ): Promise<PaginatedTaxRateDto> {
    return this.taxRatesService.findAll(page, limit);
  }

  @Get("search")
  @Permissions("tax.rates.read")
  @ApiOperation({
    summary: "Search tax rates by name or code",
    description: `
  Search for tax rates by a single search term.
  The search is case-insensitive and matches partial values in:
  - Tax Rate name
  - Tax Rate code

  Example:
  ?search=IVA -> finds all rates with 'IVA' in the name or code.
  `,
  })
  @ApiQuery({
    name: "search",
    required: true,
    type: String,
    description: "Search term (matches name or code)",
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
    description: "Paginated list of tax rates matching the search term",
    type: PaginatedTaxRateDto,
  })
  @ApiResponse({ status: 400, description: "Search term is required" })
  async searchTaxRates(
    @Query("search") search?: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10
  ): Promise<PaginatedTaxRateDto> {
    if (!search || search.trim() === "") {
      throw new BadRequestException("You must provide a search term");
    }

    return this.taxRatesService.searchTaxRates(search, page, limit);
  }

  @Get(":id")
  @Permissions("tax.rates.read")
  @ApiOperation({ summary: "Get tax rate by ID" })
  @ApiResponse({
    status: 200,
    description: "Tax rate retrieved successfully",
    type: TaxRateDto,
  })
  @ApiResponse({ status: 404, description: "Tax rate not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<TaxRateDto> {
    return this.taxRatesService.findOne(id);
  }

  @Put(":id")
  @Permissions("tax.rates.update")
  @ApiOperation({ summary: "Update a tax rate by ID" })
  @ApiResponse({
    status: 200,
    description: "Tax rate updated successfully",
    type: TaxRateDto,
  })
  @ApiResponse({ status: 404, description: "Tax rate not found" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateTaxRateDto: UpdateTaxRateDto
  ): Promise<TaxRateDto> {
    return this.taxRatesService.update(id, updateTaxRateDto);
  }

  @Delete(":id")
  @Permissions("tax.rates.delete")
  @ApiOperation({ summary: "Delete a tax rate by ID" })
  @ApiResponse({
    status: 200,
    description: "Tax rate deleted successfully",
    type: DeleteTaxRateResponseDto,
  })
  @ApiResponse({ status: 404, description: "Tax rate not found" })
  async remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteTaxRateResponseDto> {
    await this.taxRatesService.remove(id);

    return {
      success: true,
      message: `Tax rate ${id} deleted successfully`,
      id,
    };
  }
}

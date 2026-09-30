import {
  BadRequestException,
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
import { BrandsService } from "./brands.service";
import { BrandDto } from "./dto/brand.dto";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { DeleteBrandResponseDto } from "./dto/delete-brand-response.dto";
import { PaginatedBrandsDto } from "./dto/paginated-brands.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";

@ApiTags("Brands")
@Controller("brands")
@ApiBearerAuth()
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Post()
  @Permissions("brands.create")
  @ApiOperation({ summary: "Create a new brand" })
  @ApiResponse({
    status: 201,
    description: "Brand created successfully",
    type: BrandDto,
  })
  @ApiResponse({
    status: 409,
    description: "Brand with this name already exists",
  })
  create(@Body() createBrandDto: CreateBrandDto): Promise<BrandDto> {
    return this.brandsService.create(createBrandDto);
  }

  @Get("check-name")
  @Permissions("brands.read")
  @ApiOperation({
    summary: "Check if brand name exists",
    description: "Check if a brand with the given name already exists",
  })
  @ApiQuery({
    name: "name",
    required: true,
    type: String,
    description: "Brand name to check",
  })
  @ApiQuery({
    name: "excludeId",
    required: false,
    type: String,
    description: "Brand ID to exclude from check (for updates)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns whether the name exists",
    schema: { type: "object", properties: { exists: { type: "boolean" } } },
  })
  async checkNameExists(
    @Query("name") name: string,
    @Query("excludeId") excludeId?: string
  ): Promise<{ exists: boolean }> {
    if (!name || name.trim() === "") {
      throw new BadRequestException("Name query parameter is required");
    }
    const exists = await this.brandsService.checkNameExists(
      name.trim(),
      excludeId
    );
    return { exists };
  }

  @Get()
  @Permissions("brands.read")
  @ApiOperation({ summary: "Get all brands with pagination and search" })
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
    description: "Search by name, description, or country",
  })
  @ApiResponse({
    status: 200,
    description: "Brands retrieved successfully",
    type: PaginatedBrandsDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("search") search?: string
  ): Promise<PaginatedBrandsDto> {
    return this.brandsService.findAll(page, limit, search);
  }

  @Get(":id")
  @Permissions("brands.read")
  @ApiOperation({ summary: "Get brand by ID" })
  @ApiResponse({
    status: 200,
    description: "Brand retrieved successfully",
    type: BrandDto,
  })
  @ApiResponse({ status: 404, description: "Brand not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<BrandDto> {
    return this.brandsService.findOne(id);
  }

  @Patch(":id")
  @Permissions("brands.update")
  @ApiOperation({ summary: "Update brand by ID" })
  @ApiResponse({
    status: 200,
    description: "Brand updated successfully",
    type: BrandDto,
  })
  @ApiResponse({ status: 404, description: "Brand not found" })
  @ApiResponse({
    status: 409,
    description: "Brand with this name already exists",
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateBrandDto: UpdateBrandDto
  ): Promise<BrandDto> {
    return this.brandsService.update(id, updateBrandDto);
  }

  @Delete(":id")
  @Permissions("brands.delete")
  @ApiOperation({ summary: "Delete brand by ID" })
  @ApiResponse({
    status: 200,
    description: "Brand deleted successfully",
    type: DeleteBrandResponseDto,
  })
  @ApiResponse({ status: 404, description: "Brand not found" })
  @ApiResponse({
    status: 409,
    description: "Cannot delete brand with associated products or suppliers",
  })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteBrandResponseDto> {
    return this.brandsService.remove(id);
  }
}

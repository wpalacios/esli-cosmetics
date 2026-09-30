import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  Put,
  BadRequestException,
  DefaultValuePipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { CategoriesService } from "./categories.service";
import { CreateCategoryDto } from "./dto/create-category.dto";
import { CategoryDto } from "./dto/category.dto";
import { UpdateCategoryDto } from "./dto/update-category.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PaginatedCategoryDto } from "./dto/paginated-category.dto";
import { DeleteCategoryResponseDto } from "./dto/delete-category.dto";

@ApiTags("Categories")
@Controller("categories")
@ApiBearerAuth()
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @Permissions("categories.create")
  @ApiOperation({ summary: "Create a new category" })
  @ApiResponse({
    status: 201,
    description: "Category created successfully",
    type: CategoryDto,
  })
  @ApiResponse({
    status: 409,
    description: "Category with this slug already exists",
  })
  create(@Body() createCategoryDto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @Permissions("categories.read")
  @ApiOperation({ summary: "Get all categories with pagination" })
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
    description: "Number of categories per page (default: 10)",
  })
  @ApiResponse({
    status: 200,
    description: "Categories retrieved successfully",
    type: PaginatedCategoryDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number
  ): Promise<PaginatedCategoryDto> {
    return this.categoriesService.findAll(page, limit);
  }

  @Get("check-name")
  @Permissions("categories.read")
  @ApiOperation({
    summary: "Check if category name exists",
    description: "Check if a category with the given name already exists",
  })
  @ApiQuery({
    name: "name",
    required: true,
    type: String,
    description: "Category name to check",
  })
  @ApiQuery({
    name: "excludeId",
    required: false,
    type: String,
    description: "Category ID to exclude from check (for updates)",
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
    const exists = await this.categoriesService.checkNameExists(
      name.trim(),
      excludeId
    );
    return { exists };
  }

  @Get("search")
  @Permissions("categories.read")
  @ApiOperation({
    summary: "Search categories by name",
    description:
      "This endpoint allows you to search for categories by their name.",
  })
  @ApiQuery({
    name: "name",
    required: false,
    type: String,
    description: "Category name to search",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    example: 1,
    description: "Page number (default 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    example: 10,
    description: "Items per page (default 10)",
  })
  @ApiResponse({
    status: 200,
    description: "Categories found",
    type: PaginatedCategoryDto,
  })
  searchByName(
    @Query("name", new DefaultValuePipe("")) name: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit = 10
  ): Promise<PaginatedCategoryDto> {
    return this.categoriesService.searchByName(name, page, limit);
  }

  @Get(":id")
  @Permissions("categories.read")
  @ApiOperation({ summary: "Get one category by ID" })
  @ApiResponse({
    status: 200,
    description: "Category retrieved successfully",
    type: CategoryDto,
  })
  @ApiResponse({ status: 404, description: "Category not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<CategoryDto> {
    return this.categoriesService.findOne(id);
  }

  @Put(":id")
  @Permissions("categories.update")
  @ApiOperation({ summary: "Update a category by ID" })
  @ApiResponse({
    status: 200,
    description: "Category updated successfully",
    type: CategoryDto,
  })
  @ApiResponse({ status: 404, description: "Category not found" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateCategoryDto: UpdateCategoryDto
  ): Promise<CategoryDto> {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(":id")
  @Permissions("categories.delete")
  @ApiOperation({ summary: "Delete a category by ID" })
  @ApiResponse({
    status: 200,
    description: "Category deleted successfully",
    type: DeleteCategoryResponseDto,
  })
  @ApiResponse({ status: 404, description: "Category not found" })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteCategoryResponseDto> {
    return this.categoriesService.remove(id);
  }
}

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
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import { ProductSearchIndexService } from "./product-search-index.service";
import {
  ProductSearchIndexRebuildResultDto,
  ProductSearchIndexStatusDto,
} from "./dto/product-search-index.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { ProductsDto } from "./dto/products.dto";
import { UpdateProductDto } from "./dto/update-product.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PaginatedProductDto } from "./dto/paginated-product.dto";
import { DeleteProductResponseDto } from "./dto/delete-product.dto";
import { ProductType } from "@prisma/client";

@ApiTags("Products")
@Controller("products")
@ApiBearerAuth()
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly productSearchIndex: ProductSearchIndexService
  ) {}

  @Post()
  @Permissions("products.create")
  @ApiOperation({ summary: "Create a new product" })
  @ApiResponse({
    status: 201,
    description: "Product created successfully",
    type: ProductsDto,
  })
  @ApiResponse({
    status: 409,
    description: "Product with this barcode already exists",
  })
  create(@Body() createProductDto: CreateProductDto): Promise<ProductsDto> {
    return this.productsService.create(createProductDto);
  }

  @Get()
  @Permissions("products.read")
  @ApiOperation({ summary: "Get all products with pagination" })
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
    description: "Number of products per page (default: 10)",
  })
  @ApiQuery({
    name: "excludeTypes",
    required: false,
    type: String,
    description:
      "Comma-separated list of product types to exclude (e.g., 'KIT,STANDARD')",
  })
  @ApiResponse({
    status: 200,
    description: "Products retrieved successfully",
    type: PaginatedProductDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number,
    @Query("excludeTypes") excludeTypes?: string,
    @Query("brandId", new ParseUUIDPipe({ optional: true })) brandId?: string,
    @Query("categoryId", new ParseUUIDPipe({ optional: true }))
    categoryId?: string
  ): Promise<PaginatedProductDto> {
    const excludeTypesArray = excludeTypes
      ? excludeTypes.split(",").map(t => t.trim() as ProductType)
      : undefined;
    return this.productsService.findAll(
      page,
      limit,
      undefined,
      undefined,
      excludeTypesArray,
      brandId,
      categoryId
    );
  }

  @Get("search")
  @Permissions("products.read")
  @ApiOperation({
    summary: "Search products by any field",
    description: `
    Search for products by a single search term.
    The search is case-insensitive and matches partial values in:
    - Product name
    - SKU
    - Barcode
    - Category name

    Example:
    ?search=test3 -> finds all products with 'test3' in any of those fields.
    `,
  })
  @ApiQuery({
    name: "search",
    required: true,
    type: String,
    description: "Search term (matches name, SKU, barcode or category name)",
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
    name: "excludeTypes",
    required: false,
    type: String,
    description:
      "Comma-separated list of product types to exclude (e.g., 'KIT,STANDARD')",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of products matching the search term",
    type: PaginatedProductDto,
  })
  @ApiResponse({ status: 400, description: "Search term is required" })
  async searchProducts(
    @Query("search") search?: string,
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10,
    @Query("excludeTypes") excludeTypes?: string,
    @Query("brandId", new ParseUUIDPipe({ optional: true })) brandId?: string,
    @Query("categoryId", new ParseUUIDPipe({ optional: true }))
    categoryId?: string
  ): Promise<PaginatedProductDto> {
    const excludeTypesArray = excludeTypes
      ? excludeTypes.split(",").map(t => t.trim() as ProductType)
      : undefined;
    return this.productsService.searchProducts(
      search,
      page,
      limit,
      excludeTypesArray,
      brandId,
      categoryId
    );
  }

  @Get("search-index/status")
  @Permissions("products.update")
  @ApiOperation({ summary: "Get product search index status" })
  @ApiResponse({
    status: 200,
    description: "Search index status",
    type: ProductSearchIndexStatusDto,
  })
  getSearchIndexStatus(): Promise<ProductSearchIndexStatusDto> {
    return this.productSearchIndex.getStatus();
  }

  @Post("search-index/rebuild-aliases")
  @Permissions("products.update")
  @ApiOperation({ summary: "Rebuild search aliases for all active variants" })
  @ApiQuery({
    name: "batchSize",
    required: false,
    type: Number,
    description: "Variants per batch (default: 50, max: 200)",
  })
  @ApiResponse({
    status: 200,
    description: "Alias rebuild completed",
    type: ProductSearchIndexRebuildResultDto,
  })
  rebuildSearchAliases(
    @Query("batchSize", new ParseIntPipe({ optional: true })) batchSize?: number
  ): Promise<ProductSearchIndexRebuildResultDto> {
    return this.productSearchIndex.rebuildAliasesAll(batchSize ?? 50);
  }

  @Post("search-index/rebuild-embeddings")
  @Permissions("products.update")
  @ApiOperation({ summary: "Rebuild embeddings for all active variants" })
  @ApiQuery({
    name: "batchSize",
    required: false,
    type: Number,
    description: "Variants per batch (default: 50, max: 200)",
  })
  @ApiResponse({
    status: 200,
    description: "Embedding rebuild completed",
    type: ProductSearchIndexRebuildResultDto,
  })
  rebuildSearchEmbeddings(
    @Query("batchSize", new ParseIntPipe({ optional: true })) batchSize?: number
  ): Promise<ProductSearchIndexRebuildResultDto> {
    return this.productSearchIndex.rebuildEmbeddingsAll(batchSize ?? 50);
  }

  @Get(":id")
  @Permissions("products.read")
  @ApiOperation({ summary: "Get product by ID" })
  @ApiResponse({
    status: 200,
    description: "Product retrieved successfully",
    type: ProductsDto,
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<ProductsDto> {
    return this.productsService.findOne(id);
  }

  @Put(":id")
  @Permissions("products.update")
  @ApiOperation({ summary: "Update a product by ID" })
  @ApiResponse({
    status: 200,
    description: "Product updated successfully",
    type: ProductsDto,
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto
  ): Promise<ProductsDto> {
    return this.productsService.update(id, updateProductDto);
  }

  @Delete(":id")
  @Permissions("products.delete")
  @ApiOperation({ summary: "Delete a product by ID" })
  @ApiResponse({
    status: 200,
    description: "Product deleted successfully",
    type: DeleteProductResponseDto,
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteProductResponseDto> {
    return this.productsService.remove(id);
  }
}

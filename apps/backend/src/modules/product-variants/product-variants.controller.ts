import {
  Controller,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Put,
  Delete,
  Get,
  Query,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { ProductVariantsService } from "./product-variants.service";
import { CreateProductVariantDto } from "./dto/create-product-variants.dto";
import { UpdateProductVariantDto } from "./dto/update-product-variants.dto";
import { ProductVariantDto } from "./dto/product-variants.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { DeleteProductVariantResponseDto } from "./dto/delete-product-variant.dto";
@ApiTags("Product Variants")
@Controller("products")
@ApiBearerAuth()
export class ProductVariantsController {
  constructor(
    private readonly productVariantsService: ProductVariantsService
  ) {}

  @Get("variants/all-with-stock")
  @Permissions("products.variants.read")
  @ApiOperation({
    summary:
      "Get all product variants (all brands) with global stock (paginated)",
    description:
      "Returns all product variants with their global stock, prices, and related product/brand/category info.",
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
    name: "search",
    required: false,
    type: String,
    description: "Search by name, SKU or barcode",
  })
  @ApiResponse({
    status: 200,
    description: "Paginated list of all product variants with global stock",
  })
  async getAllVariantsWithStock(
    @Query("page", new ParseIntPipe({ optional: true })) page = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit = 10,
    @Query("search") search?: string
  ) {
    return this.productVariantsService.getAllVariantsWithStock(
      page,
      limit,
      search
    );
  }

  @Post(":productId/variants")
  @Permissions("products.variants.create")
  @ApiOperation({
    summary: "Create a new variant for an existing product (parent)",
    description:
      "Registers a new variant (child) and links it to the specified Product ID in the path.",
  })
  @ApiResponse({
    status: 201,
    description: "Product variant created successfully",
    type: ProductVariantDto,
  })
  @ApiResponse({
    status: 404,
    description: "Product (parent) not found or inactive",
  })
  @ApiResponse({
    status: 409,
    description: "A variant with this SKU or Barcode already exists",
  })
  create(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() createVariantDto: CreateProductVariantDto
  ): Promise<ProductVariantDto> {
    return this.productVariantsService.create(productId, createVariantDto);
  }

  @Get("variants/search")
  @Permissions("products.variants.read")
  @ApiOperation({
    summary: "Search product variants for POS",
    description:
      "Search product variants by barcode, SKU, product name, or variant name. Includes stock levels for a specific location.",
  })
  @ApiQuery({
    name: "query",
    required: true,
    description: "Search term (barcode, SKU, product name, or variant name)",
  })
  @ApiQuery({
    name: "locationId",
    required: false,
    description: "Location ID to get stock levels",
  })
  @ApiResponse({
    status: 200,
    description: "Product variants found",
    type: [ProductVariantDto],
  })
  searchVariants(
    @Query("query") query: string,
    @Query("locationId") locationId?: string
  ): Promise<ProductVariantDto[]> {
    return this.productVariantsService.searchForPOS(query, locationId);
  }

  @Get("variants/:variantId")
  @Permissions("products.variants.read")
  @ApiOperation({
    summary: "Get a product variant by ID",
    description: "Retrieves a specific product variant by its ID.",
  })
  @ApiResponse({
    status: 200,
    description: "Product variant retrieved successfully",
    type: ProductVariantDto,
  })
  @ApiResponse({
    status: 404,
    description: "Product variant not found",
  })
  findOne(
    @Param("variantId", ParseUUIDPipe) variantId: string
  ): Promise<ProductVariantDto> {
    return this.productVariantsService.findOne(variantId);
  }

  @Put(":productId/variants/:variantId")
  @Permissions("products.variants.update")
  @ApiOperation({
    summary: "Update a product variant",
    description: "Updates an existing product variant with the provided data.",
  })
  @ApiResponse({
    status: 200,
    description: "Product variant updated successfully",
    type: ProductVariantDto,
  })
  @ApiResponse({
    status: 404,
    description: "Product variant not found",
  })
  @ApiResponse({
    status: 409,
    description: "A variant with this SKU or Barcode already exists",
  })
  update(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() updateVariantDto: UpdateProductVariantDto
  ): Promise<ProductVariantDto> {
    return this.productVariantsService.update(
      productId,
      variantId,
      updateVariantDto
    );
  }

  @Get(":productId/variants")
  @Permissions("products.variants.read")
  @ApiOperation({ summary: "List variants for a product (paginated)" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  async listVariants(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Query("page") page = 1,
    @Query("limit") limit = 10
  ) {
    return this.productVariantsService.listVariantsPaginated(
      productId,
      page,
      limit
    );
  }

  @Delete("variants/:variantId")
  @Permissions("products.variants.delete")
  @ApiOperation({
    summary: "Delete a product variant",
    description: "Soft deletes a product variant by setting isDeleted to true.",
  })
  @ApiResponse({
    status: 200,
    description: "Product variant deleted successfully",
    type: DeleteProductVariantResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Product variant not found",
  })
  remove(
    @Param("variantId", ParseUUIDPipe) variantId: string
  ): Promise<DeleteProductVariantResponseDto> {
    return this.productVariantsService.remove(variantId);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { ProductImagesService } from "./product-images.service";
import { CreateProductImageDto } from "./dto/create-product-image.dto";
import { ReorderProductImagesDto } from "./dto/reorder-product-images.dto";
import { ProductImageDto } from "./dto/product-image.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Product Images")
@Controller("products/:productId/images")
@ApiBearerAuth()
export class ProductImagesController {
  constructor(private readonly productImagesService: ProductImagesService) {}

  @Post()
  @Permissions("products.update")
  @ApiOperation({ summary: "Add an image to a product" })
  @ApiResponse({
    status: 201,
    description: "Image added",
    type: ProductImageDto,
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  create(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductImageDto
  ): Promise<ProductImageDto> {
    return this.productImagesService.create(productId, dto);
  }

  @Get()
  @Permissions("products.read")
  @ApiOperation({ summary: "List all images for a product" })
  @ApiResponse({
    status: 200,
    description: "List of product images",
    type: [ProductImageDto],
  })
  @ApiResponse({ status: 404, description: "Product not found" })
  findAll(
    @Param("productId", ParseUUIDPipe) productId: string
  ): Promise<ProductImageDto[]> {
    return this.productImagesService.findAllByProductId(productId);
  }

  @Patch(":imageId/primary")
  @Permissions("products.update")
  @ApiOperation({ summary: "Set an image as the primary image" })
  @ApiResponse({
    status: 200,
    description: "Updated image",
    type: ProductImageDto,
  })
  @ApiResponse({ status: 404, description: "Product or image not found" })
  setPrimary(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string
  ): Promise<ProductImageDto> {
    return this.productImagesService.setPrimary(productId, imageId);
  }

  @Put("reorder")
  @Permissions("products.update")
  @ApiOperation({ summary: "Reorder product images" })
  @ApiResponse({
    status: 200,
    description: "Reordered list of images",
    type: [ProductImageDto],
  })
  @ApiResponse({ status: 400, description: "Invalid image IDs" })
  @ApiResponse({ status: 404, description: "Product not found" })
  reorder(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() dto: ReorderProductImagesDto
  ): Promise<ProductImageDto[]> {
    return this.productImagesService.reorder(productId, dto);
  }

  @Delete(":imageId")
  @Permissions("products.update")
  @ApiOperation({ summary: "Remove an image from a product (soft delete)" })
  @ApiResponse({ status: 200, description: "Image removed" })
  @ApiResponse({ status: 404, description: "Product or image not found" })
  remove(
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string
  ): Promise<void> {
    return this.productImagesService.remove(productId, imageId);
  }
}

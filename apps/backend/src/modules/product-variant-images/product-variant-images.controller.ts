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
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { ProductVariantImagesService } from "./product-variant-images.service";
import { CreateProductVariantImageDto } from "./dto/create-product-variant-image.dto";
import { ReorderProductVariantImagesDto } from "./dto/reorder-product-variant-images.dto";
import { ProductVariantImageDto } from "./dto/product-variant-image.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Product Variant Images")
@Controller("products/variants/:variantId/images")
@ApiBearerAuth()
export class ProductVariantImagesController {
  constructor(
    private readonly productVariantImagesService: ProductVariantImagesService
  ) {}

  @Post()
  @Permissions("products.variants.update")
  @ApiOperation({ summary: "Add an image to a product variant" })
  create(
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() dto: CreateProductVariantImageDto
  ): Promise<ProductVariantImageDto> {
    return this.productVariantImagesService.create(variantId, dto);
  }

  @Get()
  @Permissions("products.variants.read")
  @ApiOperation({ summary: "List all images for a product variant" })
  findAll(
    @Param("variantId", ParseUUIDPipe) variantId: string
  ): Promise<ProductVariantImageDto[]> {
    return this.productVariantImagesService.findAllByVariantId(variantId);
  }

  @Patch(":imageId/primary")
  @Permissions("products.variants.update")
  @ApiOperation({ summary: "Set variant image as primary" })
  setPrimary(
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string
  ): Promise<ProductVariantImageDto> {
    return this.productVariantImagesService.setPrimary(variantId, imageId);
  }

  @Put("reorder")
  @Permissions("products.variants.update")
  @ApiOperation({ summary: "Reorder variant images" })
  reorder(
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() dto: ReorderProductVariantImagesDto
  ): Promise<ProductVariantImageDto[]> {
    return this.productVariantImagesService.reorder(variantId, dto);
  }

  @Delete(":imageId")
  @Permissions("products.variants.update")
  @ApiOperation({ summary: "Remove a variant image" })
  remove(
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Param("imageId", ParseUUIDPipe) imageId: string
  ): Promise<void> {
    return this.productVariantImagesService.remove(variantId, imageId);
  }
}

import { Module } from "@nestjs/common";
import { ProductVariantImagesService } from "./product-variant-images.service";
import { ProductVariantImagesController } from "./product-variant-images.controller";

@Module({
  providers: [ProductVariantImagesService],
  controllers: [ProductVariantImagesController],
  exports: [ProductVariantImagesService],
})
export class ProductVariantImagesModule {}

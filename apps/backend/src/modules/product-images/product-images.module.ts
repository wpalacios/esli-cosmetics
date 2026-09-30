import { Module } from "@nestjs/common";
import { ProductImagesService } from "./product-images.service";
import { ProductImagesController } from "./product-images.controller";

@Module({
  providers: [ProductImagesService],
  controllers: [ProductImagesController],
  exports: [ProductImagesService],
})
export class ProductImagesModule {}

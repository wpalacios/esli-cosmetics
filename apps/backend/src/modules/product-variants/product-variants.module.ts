import { Module } from "@nestjs/common";
import { ProductVariantsService } from "./product-variants.service";
import { ProductVariantsController } from "./product-variants.controller";
import { ProductVariantPricesService } from "./product-variant-prices.service";
import { ProductSearchModule } from "../products/product-search/product-search.module";

@Module({
  imports: [ProductSearchModule],
  providers: [ProductVariantsService, ProductVariantPricesService],
  controllers: [ProductVariantsController],
  exports: [ProductVariantsService, ProductVariantPricesService],
})
export class ProductVariantsModule {}

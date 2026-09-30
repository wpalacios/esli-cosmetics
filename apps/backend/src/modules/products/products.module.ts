import { Module } from "@nestjs/common";
import { ProductsService } from "./products.service";
import { ProductsController } from "./products.controller";
import { ProductSearchModule } from "./product-search/product-search.module";
import { ProductSearchIndexService } from "./product-search-index.service";

@Module({
  imports: [ProductSearchModule],
  providers: [ProductsService, ProductSearchIndexService],
  controllers: [ProductsController],
  exports: [ProductsService, ProductSearchIndexService],
})
export class ProductsModule {}

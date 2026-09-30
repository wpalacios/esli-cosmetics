import { Module } from "@nestjs/common";
import { VariantAliasService } from "./variant-alias.service";
import { VariantEmbeddingService } from "./variant-embedding.service";
import { ProductSearchService } from "./product-search.service";

@Module({
  providers: [
    ProductSearchService,
    VariantAliasService,
    VariantEmbeddingService,
  ],
  exports: [ProductSearchService, VariantAliasService, VariantEmbeddingService],
})
export class ProductSearchModule {}

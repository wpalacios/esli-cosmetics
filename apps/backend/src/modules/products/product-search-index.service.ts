import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { VariantAliasService } from "./product-search/variant-alias.service";
import { VariantEmbeddingService } from "./product-search/variant-embedding.service";
import {
  ProductSearchIndexRebuildResultDto,
  ProductSearchIndexStatusDto,
} from "./dto/product-search-index.dto";

@Injectable()
export class ProductSearchIndexService {
  private readonly logger = new Logger(ProductSearchIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly variantAlias: VariantAliasService,
    private readonly variantEmbedding: VariantEmbeddingService
  ) {}

  async getStatus(): Promise<ProductSearchIndexStatusDto> {
    const [stats] = await this.prisma.$queryRaw<
      Array<{
        total_variants: number;
        variants_with_aliases: number;
        variants_with_embeddings: number;
        pending_embeddings: number;
      }>
    >`
      SELECT
        (
          SELECT COUNT(*)::int
          FROM product_variants v
          INNER JOIN products p ON p.id = v.product_id
          WHERE v.is_deleted = false AND v.is_active = true AND p.is_deleted = false
        ) AS total_variants,
        (
          SELECT COUNT(DISTINCT va.product_variant_id)::int
          FROM variant_aliases va
          INNER JOIN product_variants v ON v.id = va.product_variant_id
          INNER JOIN products p ON p.id = v.product_id
          WHERE v.is_deleted = false AND v.is_active = true AND p.is_deleted = false
        ) AS variants_with_aliases,
        (
          SELECT COUNT(*)::int
          FROM variant_embeddings ve
          INNER JOIN product_variants v ON v.id = ve.product_variant_id
          INNER JOIN products p ON p.id = v.product_id
          WHERE v.is_deleted = false AND v.is_active = true AND p.is_deleted = false
        ) AS variants_with_embeddings,
        (
          SELECT COUNT(*)::int
          FROM product_variants v
          INNER JOIN products p ON p.id = v.product_id
          WHERE v.is_deleted = false
            AND v.is_active = true
            AND p.is_deleted = false
            AND (
              NOT EXISTS (
                SELECT 1 FROM variant_embeddings ve WHERE ve.product_variant_id = v.id
              )
              OR EXISTS (
                SELECT 1 FROM variant_embeddings ve
                WHERE ve.product_variant_id = v.id AND v.updated_at > ve.updated_at
              )
            )
        ) AS pending_embeddings
    `;

    const totalVariants = stats?.total_variants ?? 0;
    const variantsWithAliases = stats?.variants_with_aliases ?? 0;

    return {
      totalVariants,
      variantsWithAliases,
      variantsWithoutAliases: Math.max(0, totalVariants - variantsWithAliases),
      variantsWithEmbeddings: stats?.variants_with_embeddings ?? 0,
      pendingEmbeddings: stats?.pending_embeddings ?? 0,
      embeddingsEnabled: this.variantEmbedding.isEnabled(),
    };
  }

  async rebuildAliasesAll(
    batchSize = 50
  ): Promise<ProductSearchIndexRebuildResultDto> {
    const size = Math.min(Math.max(batchSize, 1), 200);
    let processed = 0;
    let aliases = 0;
    let failed = 0;
    let cursor: string | undefined;

    this.logger.log(`Rebuilding variant aliases (batchSize=${size})`);

    while (true) {
      const variants = await this.prisma.productVariant.findMany({
        where: {
          isDeleted: false,
          isActive: true,
          product: { isDeleted: false },
        },
        select: { id: true },
        orderBy: { id: "asc" },
        take: size,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (variants.length === 0) {
        break;
      }

      for (const variant of variants) {
        try {
          const created = await this.variantAlias.generateAliasesForVariant(
            variant.id
          );
          aliases += created.length;
          processed += 1;
        } catch (err) {
          failed += 1;
          this.logger.warn(
            `Alias rebuild failed for ${variant.id}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      cursor = variants[variants.length - 1]?.id;
      if (variants.length < size) {
        break;
      }
    }

    return { processed, aliases, failed };
  }

  async rebuildEmbeddingsAll(
    batchSize = 50
  ): Promise<ProductSearchIndexRebuildResultDto> {
    if (!this.variantEmbedding.isEnabled()) {
      throw new BadRequestException(
        "Embeddings are disabled. Set PRODUCT_SEARCH_EMBEDDING_URL to enable semantic search."
      );
    }

    const size = Math.min(Math.max(batchSize, 1), 200);
    let processed = 0;
    let failed = 0;
    let cursor: string | undefined;

    this.logger.log(`Rebuilding variant embeddings (batchSize=${size})`);

    while (true) {
      const variants = await this.prisma.productVariant.findMany({
        where: {
          isDeleted: false,
          isActive: true,
          product: { isDeleted: false },
        },
        select: { id: true },
        orderBy: { id: "asc" },
        take: size,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (variants.length === 0) {
        break;
      }

      for (const variant of variants) {
        try {
          await this.variantEmbedding.upsertVariantEmbedding(variant.id);
          processed += 1;
        } catch (err) {
          failed += 1;
          this.logger.warn(
            `Embedding rebuild failed for ${variant.id}: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      cursor = variants[variants.length - 1]?.id;
      if (variants.length < size) {
        break;
      }
    }

    return { processed, failed };
  }

  /** @deprecated Use rebuildAliasesAll — kept for CLI script compatibility */
  async generateAliasesBatch(
    limit = 50
  ): Promise<{ processed: number; aliases: number }> {
    this.logger.log(`Generating variant aliases batch (limit=${limit})`);
    return this.variantAlias.generateAliasesBatch(limit);
  }
}

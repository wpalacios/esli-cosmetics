import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { ProductSearchService } from "./product-search.service";

type EmbeddingApiResponse = {
  data?: Array<{ embedding?: number[] }>;
};

@Injectable()
export class VariantEmbeddingService {
  private readonly logger = new Logger(VariantEmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly productSearch: ProductSearchService
  ) {}

  isEnabled(): boolean {
    return Boolean(
      this.config.get<string>("PRODUCT_SEARCH_EMBEDDING_URL")?.trim()
    );
  }

  getModelVersion(): string {
    return (
      this.config.get<string>("PRODUCT_SEARCH_EMBEDDING_MODEL")?.trim() ??
      "nomic-embed-text"
    );
  }

  async embedText(text: string): Promise<number[] | null> {
    const baseUrl = this.config
      .get<string>("PRODUCT_SEARCH_EMBEDDING_URL")
      ?.trim();
    if (!baseUrl) return null;

    const apiKey =
      this.config.get<string>("PRODUCT_SEARCH_EMBEDDING_API_KEY")?.trim() ??
      "ollama";
    const model = this.getModelVersion();

    try {
      const resp = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, input: text }),
        signal: AbortSignal.timeout(30000),
      });

      if (!resp.ok) {
        this.logger.warn(`Embedding API HTTP ${resp.status}`);
        return null;
      }

      const json = (await resp.json()) as EmbeddingApiResponse;
      const embedding = json.data?.[0]?.embedding;
      return embedding?.length ? embedding : null;
    } catch (err) {
      this.logger.warn(
        `Embedding request failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }
  }

  async upsertVariantEmbedding(variantId: string): Promise<void> {
    if (!this.isEnabled()) return;

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            name: true,
            description: true,
            brand: { select: { name: true } },
            category: { select: { name: true } },
          },
        },
        aliases: { select: { alias: true } },
      },
    });
    if (!variant || variant.isDeleted) return;

    const document = [
      variant.name ?? variant.product.name,
      variant.product.description ?? "",
      variant.product.brand?.name ?? "",
      variant.product.category?.name ?? "",
      variant.sku ?? "",
      ...variant.aliases.map(a => a.alias),
    ]
      .filter(Boolean)
      .join(". ");

    const embedding = await this.embedText(document);
    if (!embedding) return;

    const vectorLiteral = `[${embedding.join(",")}]`;
    const modelVersion = this.getModelVersion();

    await this.prisma.$executeRaw`
      INSERT INTO variant_embeddings (product_variant_id, embedding, model_version, updated_at)
      VALUES (${variantId}::uuid, ${vectorLiteral}::vector, ${modelVersion}, NOW())
      ON CONFLICT (product_variant_id) DO UPDATE SET
        embedding = EXCLUDED.embedding,
        model_version = EXCLUDED.model_version,
        updated_at = NOW()
    `;
  }

  async searchVariantIdsSemantic(
    rawQuery: string,
    limit = 10
  ): Promise<Array<{ variantId: string; score: number }>> {
    if (!this.isEnabled()) return [];

    const embedding = await this.embedText(rawQuery);
    if (!embedding) return [];

    const vectorLiteral = `[${embedding.join(",")}]`;

    try {
      const rows = await this.prisma.$queryRaw<
        Array<{ variant_id: string; score: number }>
      >`
        SELECT
          ve.product_variant_id AS variant_id,
          (1 - (ve.embedding <=> ${vectorLiteral}::vector))::float AS score
        FROM variant_embeddings ve
        INNER JOIN product_variants v ON v.id = ve.product_variant_id
        INNER JOIN products p ON p.id = v.product_id
        WHERE v.is_deleted = false
          AND v.is_active = true
          AND p.is_deleted = false
          AND ve.embedding IS NOT NULL
        ORDER BY ve.embedding <=> ${vectorLiteral}::vector
        LIMIT ${limit}
      `;

      return rows.map(r => ({
        variantId: r.variant_id,
        score: Number(r.score),
      }));
    } catch (err) {
      this.logger.debug(
        `Semantic search unavailable: ${err instanceof Error ? err.message : String(err)}`
      );
      return [];
    }
  }

  async hybridSearchVariantIds(
    rawQuery: string,
    limit = 20
  ): Promise<Array<{ variantId: string; score: number }>> {
    const [lexical, semantic] = await Promise.all([
      this.productSearch.searchVariantIdsRanked(rawQuery, limit),
      this.searchVariantIdsSemantic(rawQuery, limit),
    ]);

    const merged = new Map<string, number>();

    for (const hit of lexical) {
      merged.set(
        hit.variantId,
        (merged.get(hit.variantId) ?? 0) + hit.score * 0.55
      );
    }
    for (const hit of semantic) {
      merged.set(
        hit.variantId,
        (merged.get(hit.variantId) ?? 0) + hit.score * 0.45
      );
    }

    return [...merged.entries()]
      .map(([variantId, score]) => ({ variantId, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}

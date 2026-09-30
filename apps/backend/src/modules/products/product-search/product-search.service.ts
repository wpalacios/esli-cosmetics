import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../../common/prisma/prisma.service";
import {
  buildTokenGroups,
  expandSearchQueries,
  normalizeSearchText,
  tokenizeSearchQuery,
} from "./product-search-text.util";

export type VariantSearchHit = {
  variantId: string;
  score: number;
};

@Injectable()
export class ProductSearchService {
  private readonly logger = new Logger(ProductSearchService.name);

  constructor(private readonly prisma: PrismaService) {}

  expandSearchQueries(raw: string, maxVariants = 4): string[] {
    return expandSearchQueries(raw, maxVariants);
  }

  /** Tokens without stop words, joined for pg_trgm / FTS (not the full conversational string). */
  buildRankedSearchTerm(rawQuery: string): string {
    const tokens = tokenizeSearchQuery(rawQuery);
    if (tokens.length > 0) {
      return tokens.join(" ");
    }
    return normalizeSearchText(rawQuery);
  }

  /** Token-AND Prisma filter: every token (or synonym) must match at least one field. */
  buildVariantTokenWhere(rawQuery: string): Prisma.ProductVariantWhereInput {
    const tokenGroups = buildTokenGroups(rawQuery);
    if (tokenGroups.length === 0) {
      const normalized = normalizeSearchText(rawQuery);
      return normalized
        ? this.singleTermVariantWhere(normalized)
        : { id: { equals: "00000000-0000-0000-0000-000000000000" } };
    }

    return {
      isDeleted: false,
      isActive: true,
      AND: tokenGroups.map(group => ({
        OR: group.flatMap(term => this.singleTermVariantWhere(term).OR ?? []),
      })),
    };
  }

  /**
   * Hybrid ranked variant IDs: FTS/trgm via raw SQL when extensions exist,
   * otherwise falls back to token overlap scoring in application code.
   */
  async searchVariantIdsRanked(
    rawQuery: string,
    limit = 20
  ): Promise<VariantSearchHit[]> {
    const searchTerm = this.buildRankedSearchTerm(rawQuery);
    if (!searchTerm) return [];

    try {
      await this.prisma.$executeRaw`
        SELECT set_config('pg_trgm.word_similarity_threshold', '0.35', true)
      `;

      const rows = await this.prisma.$queryRaw<
        Array<{ variant_id: string; score: number }>
      >`
        WITH q AS (
          SELECT ${searchTerm}::text AS term
        )
        SELECT
          v.id AS variant_id,
          GREATEST(
            word_similarity(q.term, COALESCE(v.normalized_name, public.normalize_search_text(v.name))),
            word_similarity(COALESCE(v.normalized_name, public.normalize_search_text(v.name)), q.term),
            COALESCE((
              SELECT MAX(GREATEST(
                word_similarity(q.term, va.normalized_alias),
                word_similarity(va.normalized_alias, q.term)
              ))
              FROM variant_aliases va
              WHERE va.product_variant_id = v.id
            ), 0),
            ts_rank(
              COALESCE(v.search_text, to_tsvector('spanish', COALESCE(v.normalized_name, public.normalize_search_text(v.name)))),
              plainto_tsquery('spanish', q.term)
            )
          )::float AS score
        FROM product_variants v
        INNER JOIN products p ON p.id = v.product_id
        , q
        WHERE v.is_deleted = false
          AND v.is_active = true
          AND p.is_deleted = false
          AND (
            q.term <% COALESCE(v.normalized_name, public.normalize_search_text(v.name))
            OR COALESCE(v.normalized_name, public.normalize_search_text(v.name)) <% q.term
            OR COALESCE(v.search_text, to_tsvector('spanish', COALESCE(v.normalized_name, public.normalize_search_text(v.name))))
               @@ plainto_tsquery('spanish', q.term)
            OR EXISTS (
              SELECT 1 FROM variant_aliases va
              WHERE va.product_variant_id = v.id
                AND (q.term <% va.normalized_alias OR va.normalized_alias <% q.term)
            )
          )
        ORDER BY score DESC
        LIMIT ${limit}
      `;

      return rows.map(r => ({
        variantId: r.variant_id,
        score: Number(r.score),
      }));
    } catch (err) {
      this.logger.debug(
        `Hybrid SQL search unavailable, using token overlap: ${err instanceof Error ? err.message : String(err)}`
      );
      return this.searchVariantIdsByTokenOverlap(rawQuery, limit);
    }
  }

  async searchVariantIdsByTokenOverlap(
    rawQuery: string,
    limit = 20
  ): Promise<VariantSearchHit[]> {
    const tokenGroups = buildTokenGroups(rawQuery);
    if (tokenGroups.length === 0) return [];

    const variants = await this.prisma.productVariant.findMany({
      where: this.buildVariantTokenWhere(rawQuery),
      select: {
        id: true,
        name: true,
        sku: true,
        normalizedName: true,
        product: { select: { name: true, brand: { select: { name: true } } } },
        aliases: { select: { normalizedAlias: true } },
      },
      take: 100,
    });

    const scored = variants.map(variant => {
      const haystack = [
        variant.normalizedName ??
          normalizeSearchText(variant.name ?? variant.product.name),
        variant.sku ? normalizeSearchText(variant.sku) : "",
        normalizeSearchText(variant.product.name),
        variant.product.brand?.name
          ? normalizeSearchText(variant.product.brand.name)
          : "",
        ...variant.aliases.map(a => a.normalizedAlias),
      ]
        .filter(Boolean)
        .join(" ");

      let matchedGroups = 0;
      for (const group of tokenGroups) {
        if (group.some(term => haystack.includes(term))) matchedGroups++;
      }

      const score = matchedGroups / tokenGroups.length;
      return { variantId: variant.id, score };
    });

    return scored
      .filter(hit => hit.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async refreshVariantSearchFields(variantId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: {
          select: {
            name: true,
            brand: { select: { name: true } },
            category: { select: { name: true } },
          },
        },
        aliases: { select: { alias: true } },
      },
    });
    if (!variant || variant.isDeleted) return;

    const displayName = variant.name ?? variant.product.name;
    const normalizedName = normalizeSearchText(displayName);
    const searchDocument = [
      variant.name ?? "",
      variant.sku ?? "",
      variant.barcode ?? "",
      variant.product.name,
      variant.product.brand?.name ?? "",
      variant.product.category?.name ?? "",
      ...variant.aliases.map(a => a.alias),
    ]
      .filter(Boolean)
      .join(" ");

    await this.prisma.$executeRaw`
      UPDATE product_variants
      SET
        normalized_name = ${normalizedName},
        search_text = to_tsvector('spanish', ${searchDocument})
      WHERE id = ${variantId}::uuid
    `;
  }

  private singleTermVariantWhere(
    term: string
  ): Prisma.ProductVariantWhereInput {
    return {
      OR: [
        { barcode: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
        { name: { contains: term, mode: "insensitive" } },
        { normalizedName: { contains: term, mode: "insensitive" } },
        {
          aliases: {
            some: {
              OR: [
                { alias: { contains: term, mode: "insensitive" } },
                {
                  normalizedAlias: {
                    contains: term,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        },
        {
          product: {
            isDeleted: false,
            isActive: true,
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { sku: { contains: term, mode: "insensitive" } },
              {
                brand: {
                  name: { contains: term, mode: "insensitive" },
                },
              },
            ],
          },
        },
      ],
    };
  }
}

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../../common/prisma/prisma.service";
import { normalizeSearchText } from "./product-search-text.util";
import { VariantEmbeddingService } from "./variant-embedding.service";
import { ProductSearchService } from "./product-search.service";

type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

@Injectable()
export class VariantAliasService {
  private readonly logger = new Logger(VariantAliasService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly productSearch: ProductSearchService,
    private readonly variantEmbedding: VariantEmbeddingService
  ) {}

  async upsertAlias(params: {
    variantId: string;
    alias: string;
    source?: string;
  }): Promise<void> {
    const normalizedAlias = normalizeSearchText(params.alias);
    if (!normalizedAlias) return;

    await this.prisma.variantAlias.upsert({
      where: {
        productVariantId_normalizedAlias: {
          productVariantId: params.variantId,
          normalizedAlias,
        },
      },
      create: {
        productVariantId: params.variantId,
        alias: params.alias.trim(),
        normalizedAlias,
        source: params.source ?? "manual",
      },
      update: {
        alias: params.alias.trim(),
        source: params.source ?? "manual",
      },
    });

    await this.productSearch.refreshVariantSearchFields(params.variantId);
    await this.variantEmbedding.upsertVariantEmbedding(params.variantId);
  }

  async generateAliasesForVariant(variantId: string): Promise<string[]> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        product: { select: { name: true, brand: { select: { name: true } } } },
      },
    });
    if (!variant || variant.isDeleted) return [];

    const displayName = variant.name ?? variant.product.name;
    const generated = await this.generateAliasesWithLlm(
      displayName,
      variant.product.brand?.name
    );
    for (const alias of generated) {
      await this.upsertAlias({ variantId, alias, source: "generated" });
    }
    return generated;
  }

  async generateAliasesBatch(
    limit = 50
  ): Promise<{ processed: number; aliases: number }> {
    const variants = await this.prisma.productVariant.findMany({
      where: { isDeleted: false, isActive: true },
      select: { id: true },
      take: limit,
      orderBy: { updatedAt: "desc" },
    });

    let aliases = 0;
    for (const variant of variants) {
      const created = await this.generateAliasesForVariant(variant.id);
      aliases += created.length;
    }

    return { processed: variants.length, aliases };
  }

  private async generateAliasesWithLlm(
    name: string,
    brandName?: string | null
  ): Promise<string[]> {
    const baseUrl = this.config.get<string>("PRODUCT_ALIAS_LLM_URL")?.trim();
    if (!baseUrl) {
      return this.generateAliasesHeuristic(name, brandName);
    }

    const apiKey =
      this.config.get<string>("PRODUCT_ALIAS_LLM_API_KEY")?.trim() ?? "ollama";
    const model =
      this.config.get<string>("PRODUCT_ALIAS_LLM_MODEL")?.trim() ?? "qwen3-4b";

    const prompt = [
      "Genera entre 5 y 8 formas coloquiales en español con las que un cliente podría buscar este producto en un chat.",
      "Incluye variaciones sin acentos, abreviaturas (pcs/piezas), y frases cortas.",
      "Responde SOLO con un JSON array de strings, sin markdown.",
      `Producto: ${name}`,
      brandName ? `Marca: ${brandName}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const resp = await fetch(
        `${baseUrl.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: 256,
            temperature: 0.4,
          }),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!resp.ok) {
        this.logger.warn(`Alias LLM HTTP ${resp.status}`);
        return this.generateAliasesHeuristic(name, brandName);
      }

      const json = (await resp.json()) as ChatCompletionResponse;
      const content = json.choices?.[0]?.message?.content?.trim() ?? "[]";
      const parsed = JSON.parse(content) as unknown;
      if (!Array.isArray(parsed)) {
        return this.generateAliasesHeuristic(name, brandName);
      }

      return parsed
        .filter((item): item is string => typeof item === "string")
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, 10);
    } catch (err) {
      this.logger.warn(
        `Alias LLM failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return this.generateAliasesHeuristic(name, brandName);
    }
  }

  private generateAliasesHeuristic(
    name: string,
    brandName?: string | null
  ): string[] {
    const normalized = normalizeSearchText(name);
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const aliases = new Set<string>();

    aliases.add(normalized);
    if (tokens.length > 1) {
      aliases.add(tokens.slice(0, 2).join(" "));
      aliases.add(tokens.slice(-2).join(" "));
    }
    if (brandName) {
      aliases.add(
        `${normalizeSearchText(brandName)} ${tokens.at(-1) ?? ""}`.trim()
      );
    }

    return [...aliases].filter(Boolean);
  }
}

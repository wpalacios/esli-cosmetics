/**
 * Offline job: generate colloquial search aliases for product variants.
 *
 * Usage:
 *   pnpm --filter @esli/backend exec tsx scripts/generate-product-aliases.ts [limit]
 */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { ProductSearchIndexService } from "../src/modules/products/product-search-index.service";

async function main() {
  const limit = Number(process.argv[2] ?? 50);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const indexService = app.get(ProductSearchIndexService);
    const result = await indexService.generateAliasesBatch(limit);
    console.log(
      JSON.stringify({
        ok: true,
        processed: result.processed,
        aliases: result.aliases,
      })
    );
  } finally {
    await app.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

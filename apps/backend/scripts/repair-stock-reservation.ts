/**
 * Repairs orphaned stock_levels.reserved when quotes are CONVERTED/ANNULLED
 * but reservation was never released (known bug in quote→order flow).
 *
 * Usage (dry-run default):
 *   npx ts-node --transpile-only scripts/repair-stock-reservation.ts \
 *     --variant eea67f39-1115-4b70-b730-6195899fa527 \
 *     --location 16cdc98e-c163-44c1-9d9d-9db988b72ffc
 *
 * Apply fix:
 *   ... --apply
 */
import { PrismaClient, ProductType, QuoteStatus } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(): {
  variantId: string;
  locationId: string;
  apply: boolean;
} {
  const args = process.argv.slice(2);
  let variantId = "";
  let locationId = "";
  let apply = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--variant" && args[i + 1]) variantId = args[++i];
    if (args[i] === "--location" && args[i + 1]) locationId = args[++i];
    if (args[i] === "--apply") apply = true;
  }
  if (!variantId || !locationId) {
    throw new Error("Required: --variant <uuid> --location <uuid>");
  }
  return { variantId, locationId, apply };
}

async function reservedFromQuoteItems(
  quoteId: string,
  variantId: string
): Promise<number> {
  const items = await prisma.quoteItem.findMany({
    where: { quoteId },
    include: {
      productVariant: {
        include: { product: { include: { kitItems: true } } },
      },
    },
  });
  let total = 0;
  for (const ci of items) {
    const pv = ci.productVariant;
    if (!pv?.product) continue;
    const isKit =
      pv.product.type === ProductType.KIT &&
      (pv.product.kitItems?.length ?? 0) > 0;
    if (isKit && pv.product.kitItems) {
      for (const ki of pv.product.kitItems) {
        if (ki.productVariantId === variantId) {
          total += ci.quantity * Number(ki.quantity);
        }
      }
    } else if (ci.productVariantId === variantId) {
      total += ci.quantity;
    }
  }
  return total;
}

async function main() {
  const { variantId, locationId, apply } = parseArgs();

  const sl = await prisma.stockLevel.findFirst({
    where: { productVariantId: variantId, locationId },
  });
  if (!sl) {
    console.error("No stock_levels row for variant + location");
    process.exit(1);
  }

  const approvedQuotes = await prisma.quote.findMany({
    where: {
      locationId,
      isDeleted: false,
      status: QuoteStatus.APPROVED,
    },
    select: { id: true, quoteNumber: true },
  });

  let activeReserved = 0;
  for (const q of approvedQuotes) {
    const qty = await reservedFromQuoteItems(q.id, variantId);
    if (qty > 0) {
      console.log(`Active APPROVED quote ${q.quoteNumber}: reserves ${qty}`);
      activeReserved += qty;
    }
  }

  const currentReserved = Number(sl.reserved);
  const currentQty = Number(sl.quantity);
  const orphanReserved = Math.max(0, currentReserved - activeReserved);

  console.log("\n=== STOCK LEVEL ===");
  console.log({
    stockLevelId: sl.id,
    quantity: currentQty,
    reserved: currentReserved,
    activeReservedFromApprovedQuotes: activeReserved,
    orphanReservedToRelease: orphanReserved,
  });

  const convertedHolding = await prisma.quote.findMany({
    where: {
      locationId,
      isDeleted: false,
      status: QuoteStatus.CONVERTED,
      items: { some: { productVariantId: variantId } },
    },
    select: {
      quoteNumber: true,
      orders: { select: { orderNumber: true, status: true, metadata: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 5,
  });
  console.log("\n=== RECENT CONVERTED QUOTES (direct line) ===");
  console.log(convertedHolding);

  if (orphanReserved <= 0) {
    console.log("\nNo orphan reserved to release.");
    return;
  }

  if (!apply) {
    console.log(
      `\nDry-run: would SET reserved = ${activeReserved} (release ${orphanReserved}). Re-run with --apply to commit.`
    );
    return;
  }

  await prisma.stockLevel.update({
    where: { id: sl.id },
    data: { reserved: activeReserved },
  });
  console.log(`\nApplied: reserved ${currentReserved} → ${activeReserved}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

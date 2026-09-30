/**
 * Global audit & repair for stock_levels.reserved drift.
 *
 * Scans every (variant + location) and compares stock_levels.reserved against
 * the sum of reservations from currently APPROVED quotes (decomposed for kits).
 * Reports drift (orphan reservations or under-reserved rows) and optionally repairs.
 *
 * Usage:
 *   Dry-run (default), audit everything:
 *     npx ts-node --transpile-only scripts/audit-stock-reservations.ts
 *
 *   Filter by location and/or variant:
 *     npx ts-node --transpile-only scripts/audit-stock-reservations.ts \
 *       --location <uuid> --variant <uuid>
 *
 *   Apply the fix (writes to DB):
 *     npx ts-node --transpile-only scripts/audit-stock-reservations.ts --apply
 *
 *   Limit which drifts to apply:
 *     --only-orphans   only release orphaned reservations (actual > expected)
 *     --only-missing   only top up missing reservations (actual < expected; rarely safe)
 *     --reconcile      fully align reserved with current APPROVED proformas
 *                      (release orphans AND top up missing in one pass)
 *
 *   Output:
 *     --json           machine-readable report
 *
 *  Notes:
 *   - "expected" is computed strictly from current APPROVED quotes at the
 *     location (kits decomposed into components).
 *   - The script never touches `quantity`. Only `reserved`.
 *   - Default behaviour (no --only-* flag) repairs ONLY orphan reservations,
 *     which is the safe direction; missing reservations are surfaced for review.
 */
import { PrismaClient, ProductType, QuoteStatus } from "@prisma/client";

type ReservationMap = Map<string, number>; // variantId -> qty

interface DriftRow {
  stockLevelId: string;
  locationId: string;
  locationName: string | null;
  productVariantId: string;
  variantName: string | null;
  productName: string | null;
  actualReserved: number;
  expectedReserved: number;
  drift: number; // actual - expected; >0 = orphan, <0 = missing
  quotesContributing: Array<{ quoteNumber: string | null; qty: number }>;
}

const prisma = new PrismaClient();

interface CliArgs {
  locationId?: string;
  variantId?: string;
  apply: boolean;
  onlyOrphans: boolean;
  onlyMissing: boolean;
  json: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = {
    apply: false,
    onlyOrphans: false,
    onlyMissing: false,
    json: false,
  };
  let reconcile = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--location" && args[i + 1]) out.locationId = args[++i];
    else if (a === "--variant" && args[i + 1]) out.variantId = args[++i];
    else if (a === "--apply") out.apply = true;
    else if (a === "--only-orphans") out.onlyOrphans = true;
    else if (a === "--only-missing") out.onlyMissing = true;
    // --reconcile: fully align reserved with current APPROVED proformas, i.e.
    // release orphans AND top up missing reservations in a single pass. Both
    // directions are proforma-generated; `quantity` (physical stock) is never
    // touched, so user-side issues (miscount, theft) are left for manual review.
    else if (a === "--reconcile") reconcile = true;
    else if (a === "--json") out.json = true;
  }
  if (reconcile) {
    out.onlyOrphans = true;
    out.onlyMissing = true;
  }
  if (!out.onlyOrphans && !out.onlyMissing) out.onlyOrphans = true; // safe default
  return out;
}

function addToMap(map: ReservationMap, key: string, qty: number) {
  map.set(key, (map.get(key) ?? 0) + qty);
}

/**
 * For one APPROVED quote, expand its items into (variantId, qty) pairs,
 * decomposing kits into their components (component qty × kit line qty).
 */
async function expandQuoteToVariantQty(
  quoteId: string
): Promise<ReservationMap> {
  const items = await prisma.quoteItem.findMany({
    where: { quoteId },
    include: {
      productVariant: {
        include: {
          product: { include: { kitItems: true } },
        },
      },
    },
  });

  const map: ReservationMap = new Map();
  for (const ci of items) {
    const pv = ci.productVariant;
    if (!pv?.product) continue;
    const isKit =
      pv.product.type === ProductType.KIT &&
      (pv.product.kitItems?.length ?? 0) > 0;
    if (isKit && pv.product.kitItems) {
      for (const ki of pv.product.kitItems) {
        addToMap(map, ki.productVariantId, ci.quantity * Number(ki.quantity));
      }
    } else if (ci.productVariantId) {
      addToMap(map, ci.productVariantId, ci.quantity);
    }
  }
  return map;
}

async function buildExpectedReservedByLocation(args: {
  locationId?: string;
}): Promise<
  Map<
    string, // locationId
    Map<
      string, // variantId
      Array<{ quoteId: string; quoteNumber: string | null; qty: number }>
    >
  >
> {
  const quotes = await prisma.quote.findMany({
    where: {
      isDeleted: false,
      status: QuoteStatus.APPROVED,
      ...(args.locationId ? { locationId: args.locationId } : {}),
    },
    select: { id: true, quoteNumber: true, locationId: true },
  });

  const byLocation = new Map<
    string,
    Map<
      string,
      Array<{ quoteId: string; quoteNumber: string | null; qty: number }>
    >
  >();

  for (const q of quotes) {
    if (!q.locationId) continue;
    const expanded = await expandQuoteToVariantQty(q.id);
    if (expanded.size === 0) continue;
    let perVariant = byLocation.get(q.locationId);
    if (!perVariant) {
      perVariant = new Map();
      byLocation.set(q.locationId, perVariant);
    }
    for (const [variantId, qty] of expanded) {
      let list = perVariant.get(variantId);
      if (!list) {
        list = [];
        perVariant.set(variantId, list);
      }
      list.push({ quoteId: q.id, quoteNumber: q.quoteNumber, qty });
    }
  }

  return byLocation;
}

async function main() {
  const args = parseArgs();

  const expectedByLocation = await buildExpectedReservedByLocation({
    locationId: args.locationId,
  });

  const stockLevels = await prisma.stockLevel.findMany({
    where: {
      ...(args.locationId ? { locationId: args.locationId } : {}),
      ...(args.variantId ? { productVariantId: args.variantId } : {}),
      productVariantId: { not: null },
      locationId: { not: null },
    },
    select: {
      id: true,
      productVariantId: true,
      locationId: true,
      reserved: true,
      quantity: true,
      productVariant: {
        select: { name: true, product: { select: { name: true } } },
      },
      location: { select: { name: true } },
    },
  });

  const drifts: DriftRow[] = [];

  for (const sl of stockLevels) {
    if (!sl.productVariantId || !sl.locationId) continue;
    const expectedList =
      expectedByLocation.get(sl.locationId)?.get(sl.productVariantId) ?? [];
    const expected = expectedList.reduce((s, r) => s + r.qty, 0);
    const actual = Number(sl.reserved);
    if (Math.abs(actual - expected) < 1e-9) continue;
    drifts.push({
      stockLevelId: sl.id,
      locationId: sl.locationId,
      locationName: sl.location?.name ?? null,
      productVariantId: sl.productVariantId,
      variantName: sl.productVariant?.name ?? null,
      productName: sl.productVariant?.product?.name ?? null,
      actualReserved: actual,
      expectedReserved: expected,
      drift: actual - expected,
      quotesContributing: expectedList.map(r => ({
        quoteNumber: r.quoteNumber,
        qty: r.qty,
      })),
    });
  }

  const orphans = drifts.filter(d => d.drift > 0);
  const missing = drifts.filter(d => d.drift < 0);

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          scannedStockLevels: stockLevels.length,
          totalDrifts: drifts.length,
          orphans: orphans.length,
          missing: missing.length,
          drifts,
        },
        null,
        2
      )
    );
  } else {
    console.log(`Scanned ${stockLevels.length} stock_levels rows`);
    console.log(
      `Total drifts: ${drifts.length} (orphans=${orphans.length}, missing=${missing.length})\n`
    );
    if (orphans.length > 0) {
      console.log("=== ORPHANED RESERVATIONS (actual > expected) ===");
      for (const d of orphans) {
        console.log(
          `  ${d.locationName ?? d.locationId} | ${d.variantName ?? d.productVariantId}\n    reserved=${d.actualReserved} expected=${d.expectedReserved} → release ${d.drift}` +
            (d.quotesContributing.length
              ? `\n    backed by APPROVED: ${d.quotesContributing
                  .map(q => `${q.quoteNumber}(${q.qty})`)
                  .join(", ")}`
              : "")
        );
      }
      console.log("");
    }
    if (missing.length > 0) {
      console.log("=== MISSING RESERVATIONS (actual < expected) ===");
      for (const d of missing) {
        console.log(
          `  ${d.locationName ?? d.locationId} | ${d.variantName ?? d.productVariantId}\n    reserved=${d.actualReserved} expected=${d.expectedReserved} → short ${-d.drift}` +
            (d.quotesContributing.length
              ? `\n    backed by APPROVED: ${d.quotesContributing
                  .map(q => `${q.quoteNumber}(${q.qty})`)
                  .join(", ")}`
              : "")
        );
      }
      console.log("");
    }
  }

  if (!args.apply) {
    console.log(
      `Dry-run: no changes. Re-run with --apply ${
        args.onlyMissing ? "--only-missing" : "--only-orphans"
      } to repair.`
    );
    return;
  }

  const toRepair: DriftRow[] = [];
  if (args.onlyOrphans) toRepair.push(...orphans);
  if (args.onlyMissing) toRepair.push(...missing);

  if (toRepair.length === 0) {
    console.log("Nothing to apply with the current filter.");
    return;
  }

  await prisma.$transaction(async tx => {
    for (const d of toRepair) {
      await tx.stockLevel.update({
        where: { id: d.stockLevelId },
        data: { reserved: d.expectedReserved },
      });
    }
  });

  console.log(`Applied: updated reserved on ${toRepair.length} rows.`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

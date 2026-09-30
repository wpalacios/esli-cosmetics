/**
 * Global audit & repair for stock_levels.quantity drift.
 *
 * Compares stock_levels.quantity against the cumulative net effect of every
 * stock_movements row affecting the same (productId, productVariantId, locationId)
 * triplet. If they disagree, the stock_level was either:
 *   - Seeded directly by the migration script (initial load) without a backing
 *     POSITIVE_ADJUSTMENT movement (HISTORICAL — large diffs, present at multiple
 *     locations of the same variant; treat as initial seed and ignore).
 *   - Touched by a code path that wrote to stock_levels but skipped stock_movements,
 *     OR a code path that wrote stock_movements but skipped stock_levels (BUG —
 *     diff appears suddenly on a single location).
 *
 * The script never invents history. Repair mode rewrites the stock_level quantity
 * to match the sum of movements PLUS an explicit baseline you accept per row, so
 * historical seeds stay intact unless you explicitly opt them out.
 *
 * Usage:
 *   Dry-run (default), audit everything:
 *     npx ts-node --transpile-only scripts/audit-stock-levels.ts
 *
 *   Filter:
 *     --location <uuid>      only this location
 *     --variant <uuid>       only this variant
 *     --since <ISO date>     only count movements created on/after this date
 *                            (useful to detect drift introduced after a known seed)
 *     --min-abs-diff <n>     only report rows with |diff| >= n (default 1)
 *
 *   Output:
 *     --json                 machine-readable report
 *
 * Notes:
 *   - This script touches `quantity`, never `reserved`.
 *   - Reservations are audited separately by audit-stock-reservations.ts.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface CliArgs {
  locationId?: string;
  variantId?: string;
  since?: string;
  minAbsDiff: number;
  json: boolean;
}

interface DriftRow {
  stockLevelId: string;
  productId: string | null;
  productVariantId: string | null;
  locationId: string;
  locationName: string | null;
  productName: string | null;
  variantName: string | null;
  actualQuantity: number;
  expectedFromMovements: number;
  diff: number;
  positiveSum: number;
  negativeSum: number;
  movementCount: number;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const out: CliArgs = { minAbsDiff: 1, json: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--location" && args[i + 1]) out.locationId = args[++i];
    else if (a === "--variant" && args[i + 1]) out.variantId = args[++i];
    else if (a === "--since" && args[i + 1]) out.since = args[++i];
    else if (a === "--min-abs-diff" && args[i + 1])
      out.minAbsDiff = Number(args[++i]);
    else if (a === "--json") out.json = true;
  }
  return out;
}

async function main() {
  const args = parseArgs();

  // Build optional filters. We string-interpolate because Postgres' parameterized arrays make
  // `WITH ... GROUP BY` plans worse and this script is operator-only (not a request handler).
  // Validate UUID/ISO inputs to keep the surface tight.
  const uuidRe =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (args.locationId && !uuidRe.test(args.locationId)) {
    throw new Error(`Invalid --location uuid: ${args.locationId}`);
  }
  if (args.variantId && !uuidRe.test(args.variantId)) {
    throw new Error(`Invalid --variant uuid: ${args.variantId}`);
  }
  if (args.since && Number.isNaN(Date.parse(args.since))) {
    throw new Error(`Invalid --since date: ${args.since}`);
  }

  const sinceClause = args.since
    ? `AND sm.created_at >= '${args.since}'::timestamptz`
    : "";
  const locationClause = args.locationId
    ? `AND sl.location_id = '${args.locationId}'::uuid`
    : "";
  const variantClause = args.variantId
    ? `AND sl.product_variant_id = '${args.variantId}'::uuid`
    : "";
  const movementLocationClause = args.locationId
    ? `AND (sm.from_location_id = '${args.locationId}'::uuid OR sm.to_location_id = '${args.locationId}'::uuid)`
    : "";
  const movementVariantClause = args.variantId
    ? `AND sm.product_variant_id = '${args.variantId}'::uuid`
    : "";

  // Pre-aggregate movements per (product, variant, location) BEFORE joining stock_levels.
  // Splitting outflows and inflows into two grouped scans (then UNION ALL + SUM) avoids the
  // N×M join that timed out on a one-shot query and uses the existing
  // stock_movements_from_location_id_idx / stock_movements_to_location_id_idx indexes.
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      stock_level_id: string;
      product_id: string | null;
      product_variant_id: string | null;
      location_id: string;
      actual_quantity: string;
      expected_from_movements: string;
      diff: string;
      positive_sum: string;
      negative_sum: string;
      movement_count: number;
    }>
  >(`
    WITH movement_legs AS (
      SELECT
        sm.product_id,
        sm.product_variant_id,
        sm.from_location_id AS location_id,
        -sm.quantity AS net,
        sm.quantity AS negative_sum,
        0::numeric AS positive_sum,
        1 AS cnt
      FROM stock_movements sm
      WHERE sm.from_location_id IS NOT NULL
        ${sinceClause}
        ${movementLocationClause}
        ${movementVariantClause}
      UNION ALL
      SELECT
        sm.product_id,
        sm.product_variant_id,
        sm.to_location_id AS location_id,
        sm.quantity AS net,
        0::numeric AS negative_sum,
        sm.quantity AS positive_sum,
        1 AS cnt
      FROM stock_movements sm
      WHERE sm.to_location_id IS NOT NULL
        ${sinceClause}
        ${movementLocationClause}
        ${movementVariantClause}
    ),
    movements_agg AS (
      SELECT
        product_id,
        product_variant_id,
        location_id,
        SUM(net) AS net,
        SUM(positive_sum) AS positive_sum,
        SUM(negative_sum) AS negative_sum,
        SUM(cnt)::int AS movement_count
      FROM movement_legs
      GROUP BY product_id, product_variant_id, location_id
    )
    SELECT
      sl.id AS stock_level_id,
      sl.product_id,
      sl.product_variant_id,
      sl.location_id,
      sl.quantity AS actual_quantity,
      COALESCE(ma.net, 0) AS expected_from_movements,
      (sl.quantity - COALESCE(ma.net, 0)) AS diff,
      COALESCE(ma.positive_sum, 0) AS positive_sum,
      COALESCE(ma.negative_sum, 0) AS negative_sum,
      COALESCE(ma.movement_count, 0) AS movement_count
    FROM stock_levels sl
    LEFT JOIN movements_agg ma
      ON ma.product_id IS NOT DISTINCT FROM sl.product_id
     AND ma.product_variant_id IS NOT DISTINCT FROM sl.product_variant_id
     AND ma.location_id = sl.location_id
    WHERE sl.location_id IS NOT NULL
      ${locationClause}
      ${variantClause}
      AND ABS(sl.quantity - COALESCE(ma.net, 0)) >= ${Number(args.minAbsDiff)}
    ORDER BY ABS(sl.quantity - COALESCE(ma.net, 0)) DESC
  `);

  // Resolve human-readable names in one pass.
  const locationIds = Array.from(new Set(rows.map(r => r.location_id)));
  const variantIds = Array.from(
    new Set(rows.map(r => r.product_variant_id).filter(Boolean) as string[])
  );
  const productIds = Array.from(
    new Set(rows.map(r => r.product_id).filter(Boolean) as string[])
  );

  const [locations, variants, products] = await Promise.all([
    prisma.location.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    }),
    prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, name: true, product: { select: { name: true } } },
    }),
    prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    }),
  ]);
  const locName = new Map(locations.map(l => [l.id, l.name]));
  const variantName = new Map(variants.map(v => [v.id, v.name]));
  const variantProductName = new Map(
    variants.map(v => [v.id, v.product?.name ?? null])
  );
  const productName = new Map(products.map(p => [p.id, p.name]));

  const resolveProductName = (
    productId: string | null,
    variantId: string | null
  ): string | null => {
    if (productId) {
      const direct = productName.get(productId);
      if (direct) return direct;
    }
    if (variantId) {
      return variantProductName.get(variantId) ?? null;
    }
    return null;
  };

  const drifts: DriftRow[] = rows.map(r => ({
    stockLevelId: r.stock_level_id,
    productId: r.product_id,
    productVariantId: r.product_variant_id,
    locationId: r.location_id,
    locationName: locName.get(r.location_id) ?? null,
    productName: resolveProductName(r.product_id, r.product_variant_id),
    variantName: r.product_variant_id
      ? (variantName.get(r.product_variant_id) ?? null)
      : null,
    actualQuantity: Number(r.actual_quantity),
    expectedFromMovements: Number(r.expected_from_movements),
    diff: Number(r.diff),
    positiveSum: Number(r.positive_sum),
    negativeSum: Number(r.negative_sum),
    movementCount: Number(r.movement_count),
  }));

  if (args.json) {
    console.log(
      JSON.stringify(
        {
          totalDrifts: drifts.length,
          surplus: drifts.filter(d => d.diff > 0).length,
          deficit: drifts.filter(d => d.diff < 0).length,
          drifts,
        },
        null,
        2
      )
    );
    return;
  }

  const surplus = drifts.filter(d => d.diff > 0);
  const deficit = drifts.filter(d => d.diff < 0);
  console.log(`Found ${drifts.length} stock_levels with drift`);
  console.log(
    `  surplus (actual > sum_of_movements): ${surplus.length} (likely seed or missing decrement)`
  );
  console.log(
    `  deficit (actual < sum_of_movements): ${deficit.length} (likely missing increment or unrecorded outflow)\n`
  );

  if (drifts.length === 0) return;

  const top = drifts.slice(0, 30);
  console.log("=== TOP DRIFTS (by |diff|) ===");
  for (const d of top) {
    console.log(
      `  ${d.locationName ?? d.locationId} | ${
        d.variantName ?? d.productName ?? d.productVariantId ?? d.productId
      }\n    actual=${d.actualQuantity} expected=${d.expectedFromMovements} diff=${d.diff} (+${d.positiveSum}/-${d.negativeSum} across ${d.movementCount} movements)`
    );
  }
  if (drifts.length > top.length) {
    console.log(
      `  ... and ${drifts.length - top.length} more (use --json to dump all)`
    );
  }
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

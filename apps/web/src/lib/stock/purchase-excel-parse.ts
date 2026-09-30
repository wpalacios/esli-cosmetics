import * as XLSX from "xlsx";
import type { LocationInfo } from "@esli-cosmetics/types";
import type { PriceType } from "@esli-cosmetics/types";
import { PURCHASE_EXCEL_MAX_DATA_ROWS } from "./purchase-excel-constants";

export function normalizeHeaderKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeVariantDisplayName(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

const IGNORED_HEADERS = new Set(["p", "p1", "total"]);

const ITEM_HEADERS = new Set(["item", "producto"]);

const COST_ALIASES = new Set(["costo final", "cost price", "costo"]);

/** Normalized header -> canonical price type name in DB */
const PRICE_HEADER_TO_CANONICAL: Record<string, string> = {
  detalle: "Unitario",
  "p emp": "Emprendedor",
  "p mayor": "Mayorista",
  "p dist": "Distribuidor",
  unitario: "Unitario",
  emprendedor: "Emprendedor",
  mayorista: "Mayorista",
  distribuidor: "Distribuidor",
};

export type ColumnKind =
  | "item"
  | "cost"
  | "ignored"
  | "location"
  | "priceType"
  | "unknown";

export interface ParsedColumn {
  index: number;
  header: string;
  kind: ColumnKind;
  locationId?: string;
  priceTypeId?: string;
  priceTypeName?: string;
}

function parseNumericCell(v: unknown): number {
  if (v === "" || v === null || v === undefined) {
    return 0;
  }
  if (typeof v === "number" && !Number.isNaN(v)) {
    return v;
  }
  const s = String(v).trim().replace(/,/g, ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}

function stripCellBom(raw: string): string {
  return raw.replace(/^\uFEFF/, "").trim();
}

function findHeaderRowIndex(matrix: string[][]): number {
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row) {
      continue;
    }
    const cells = row.map(c => normalizeHeaderKey(stripCellBom(String(c))));
    if (cells.some(c => ITEM_HEADERS.has(c))) {
      return i;
    }
  }
  return 0;
}

function matchLocationByExtractedName(
  extracted: string,
  wantType: "STORE" | "WAREHOUSE",
  locations: LocationInfo[]
): LocationInfo | null {
  const normExt = normalizeHeaderKey(extracted);
  if (normExt.length < 1) {
    return null;
  }

  const pool = locations.filter(
    loc => !loc.isDeleted && loc.locationType === wantType
  );

  const exact = pool.filter(loc => normalizeHeaderKey(loc.name) === normExt);
  if (exact.length === 1) {
    return exact[0] ?? null;
  }

  const byPrefix = pool.filter(loc => {
    const n = normalizeHeaderKey(loc.name);
    if (!n.startsWith(normExt)) {
      return false;
    }
    if (n.length === normExt.length) {
      return true;
    }
    const next = n.charAt(normExt.length);
    return next === " " || next === "(" || next === "-";
  });
  if (byPrefix.length === 1) {
    return byPrefix[0] ?? null;
  }

  if (normExt.length >= 4) {
    const byContains = pool.filter(loc =>
      normalizeHeaderKey(loc.name).includes(normExt)
    );
    if (byContains.length === 1) {
      return byContains[0] ?? null;
    }
  }

  return null;
}

/** Accepts SUCURSAL - Name, SUCURSAL Name, STORE - Name, etc. */
function tryParseLocationColumn(
  header: string,
  locations: LocationInfo[]
): { locationId: string; locationName: string } | null {
  const h = stripCellBom(header);

  let extracted: string | undefined;
  let wantType: "STORE" | "WAREHOUSE" | undefined;

  const mStoreDash = h.match(/^(sucursal|store)\s*[-:–]\s*(.+)$/i);
  const mWhDash = h.match(/^(bodega|warehouse)\s*[-:–]\s*(.+)$/i);
  if (mStoreDash?.[2]?.trim()) {
    extracted = mStoreDash[2].trim();
    wantType = "STORE";
  } else if (mWhDash?.[2]?.trim()) {
    extracted = mWhDash[2].trim();
    wantType = "WAREHOUSE";
  } else {
    const mStoreSpace = h.match(/^(sucursal|store)\s{1,}(.+)$/i);
    const mWhSpace = h.match(/^(bodega|warehouse)\s{1,}(.+)$/i);
    if (mStoreSpace?.[2]?.trim()) {
      extracted = mStoreSpace[2].trim();
      wantType = "STORE";
    } else if (mWhSpace?.[2]?.trim()) {
      extracted = mWhSpace[2].trim();
      wantType = "WAREHOUSE";
    }
  }

  if (!extracted || !wantType) {
    return null;
  }

  const matched = matchLocationByExtractedName(extracted, wantType, locations);
  if (!matched) {
    return null;
  }
  return { locationId: matched.id, locationName: matched.name };
}

function resolvePriceTypeColumn(
  header: string,
  priceTypes: PriceType[]
): { priceTypeId: string; priceTypeName: string } | null {
  const key = normalizeHeaderKey(header);
  if (
    IGNORED_HEADERS.has(key) ||
    ITEM_HEADERS.has(key) ||
    COST_ALIASES.has(key)
  ) {
    return null;
  }
  const active = priceTypes.filter(pt => !pt.isDeleted && pt.isActive);
  const canonical = PRICE_HEADER_TO_CANONICAL[key];
  const byCanonical = canonical
    ? active.find(
        pt => normalizeHeaderKey(pt.name) === normalizeHeaderKey(canonical)
      )
    : undefined;
  if (byCanonical) {
    return { priceTypeId: byCanonical.id, priceTypeName: byCanonical.name };
  }
  const direct = active.find(pt => normalizeHeaderKey(pt.name) === key);
  if (direct) {
    return { priceTypeId: direct.id, priceTypeName: direct.name };
  }
  return null;
}

function classifyColumns(
  headers: string[],
  locations: LocationInfo[],
  priceTypes: PriceType[]
): ParsedColumn[] {
  return headers.map((rawHeader, index) => {
    const header = stripCellBom(String(rawHeader ?? ""));
    const key = normalizeHeaderKey(header);

    if (ITEM_HEADERS.has(key)) {
      return { index, header, kind: "item" };
    }
    if (IGNORED_HEADERS.has(key)) {
      return { index, header, kind: "ignored" };
    }
    if (COST_ALIASES.has(key)) {
      return { index, header, kind: "cost" };
    }

    const loc = tryParseLocationColumn(header, locations);
    if (loc) {
      return {
        index,
        header,
        kind: "location",
        locationId: loc.locationId,
      };
    }

    const pt = resolvePriceTypeColumn(header, priceTypes);
    if (pt) {
      return {
        index,
        header,
        kind: "priceType",
        priceTypeId: pt.priceTypeId,
        priceTypeName: pt.priceTypeName,
      };
    }

    if (key.length === 0) {
      return { index, header, kind: "ignored" };
    }

    return { index, header, kind: "unknown" };
  });
}

export interface ParsedPurchaseExcelRow {
  sheetRow: number;
  itemLabel: string;
  itemNormalized: string;
  locationQuantities: { locationId: string; quantity: number }[];
  /**
   * Excel headers for recognized location columns where the cell was 0 or empty.
   * Used to explain which SUCURSAL/BODEGA columns did not generate a movement.
   */
  locationColumnsWithZeroQty: string[];
  costPrice: number;
  prices: { priceTypeId: string; price: number }[];
}

export interface ParsePurchaseExcelResult {
  rows: ParsedPurchaseExcelRow[];
  columnIssues: string[];
  columns: ParsedColumn[];
}

export function sheetMatrixFromBuffer(buffer: ArrayBuffer): string[][] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0] ?? "";
  const ws = wb.Sheets[sheetName];
  if (!ws) {
    return [];
  }
  const json = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  return json.map(row =>
    (row as unknown[]).map(cell => String(cell ?? "").trim())
  );
}

export function parsePurchaseExcelSheet(
  buffer: ArrayBuffer,
  locations: LocationInfo[],
  priceTypes: PriceType[]
): ParsePurchaseExcelResult {
  const matrix = sheetMatrixFromBuffer(buffer);
  if (matrix.length === 0) {
    return { rows: [], columnIssues: ["Empty sheet"], columns: [] };
  }

  const headerRowIdx = findHeaderRowIndex(matrix);
  const headers = (matrix[headerRowIdx] ?? []).map(h =>
    stripCellBom(String(h ?? ""))
  );
  const columns = classifyColumns(headers, locations, priceTypes);

  const columnIssues: string[] = [];
  for (const c of columns) {
    if (c.kind === "unknown") {
      columnIssues.push(c.header);
    }
  }

  const itemCol = columns.find(c => c.kind === "item");
  const costCol = columns.find(c => c.kind === "cost");
  const locCols = columns.filter(c => c.kind === "location");
  const priceCols = columns.filter(c => c.kind === "priceType");

  if (!itemCol) {
    columnIssues.push("Missing required column: Item (or Producto)");
  }
  if (locCols.length === 0) {
    columnIssues.push(
      'No location columns found. Use headers like "SUCURSAL - Name" or "BODEGA - Name".'
    );
  }
  if (!costCol) {
    columnIssues.push("Missing cost column (e.g. COSTO FINAL)");
  }

  const rows: ParsedPurchaseExcelRow[] = [];

  if (!itemCol || locCols.length === 0 || !costCol) {
    return { rows, columnIssues, columns };
  }

  for (let r = headerRowIdx + 1; r < matrix.length; r++) {
    if (rows.length >= PURCHASE_EXCEL_MAX_DATA_ROWS) {
      columnIssues.push(
        `Stopped after ${PURCHASE_EXCEL_MAX_DATA_ROWS} data rows (limit).`
      );
      break;
    }
    const line = matrix[r] ?? [];
    const itemLabel = String(line[itemCol.index] ?? "").trim();
    if (!itemLabel) {
      continue;
    }

    const locationQuantities: { locationId: string; quantity: number }[] = [];
    const locationColumnsWithZeroQty: string[] = [];
    for (const lc of locCols) {
      if (!lc.locationId) {
        continue;
      }
      const qty = parseNumericCell(line[lc.index]);
      if (qty > 0) {
        locationQuantities.push({ locationId: lc.locationId, quantity: qty });
      } else {
        const label = lc.header.trim();
        if (label.length > 0) {
          locationColumnsWithZeroQty.push(label);
        }
      }
    }

    const costRaw = parseNumericCell(line[costCol.index]);
    const prices: { priceTypeId: string; price: number }[] = [];
    for (const pc of priceCols) {
      if (!pc.priceTypeId) {
        continue;
      }
      const p = parseNumericCell(line[pc.index]);
      if (p > 0) {
        prices.push({ priceTypeId: pc.priceTypeId, price: p });
      }
    }

    rows.push({
      sheetRow: r + 1,
      itemLabel,
      itemNormalized: normalizeVariantDisplayName(itemLabel),
      locationQuantities,
      locationColumnsWithZeroQty,
      costPrice: Number.isFinite(costRaw) ? costRaw : 0,
      prices,
    });
  }

  return { rows, columnIssues, columns };
}

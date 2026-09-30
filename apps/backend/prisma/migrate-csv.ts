import { PrismaClient } from "@prisma/client";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "csv-parse/sync";

const prisma = new PrismaClient();

// Type for transaction client
type TransactionClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// Branch mappings
const BRANCH_MAPPINGS = {
  "cc40985e-f256-4885-afac-825e807824d2": {
    id: "cc40985e-f256-4885-afac-825e807824d2",
    name: "Bello Horizonte",
  },
  "0febf243-90b7-4ff2-867d-975c1d494407": {
    id: "0febf243-90b7-4ff2-867d-975c1d494407",
    name: "Centroamérica",
  },
} as const;

// Location mappings with full details - mapped by UBICACION column values
const LOCATION_MAPPINGS: Record<string, LocationDetails> = {
  "SUCURSAL BELLO HORIZONTE": {
    id: "1f9bcdc5-365d-47a1-8b02-b70bfa458916",
    name: "SUCURSAL BELLO HORIZONTE",
    branchId: "cc40985e-f256-4885-afac-825e807824d2",
    address: "MANAGUA, BELLO HORIZONTE DE LA IGLESIA PIO X MEDIA CUADRA ABAJO",
    contact: "89709834",
    locationType: "STORE",
  },
  "BELLO HORIZONTE": {
    id: "1f9bcdc5-365d-47a1-8b02-b70bfa458916",
    name: "SUCURSAL BELLO HORIZONTE",
    branchId: "cc40985e-f256-4885-afac-825e807824d2",
    address: "MANAGUA, BELLO HORIZONTE DE LA IGLESIA PIO X MEDIA CUADRA ABAJO",
    contact: "89709834",
    locationType: "STORE",
  },
  "Sucursal Centroamérica": {
    id: "5a5e3be7-918a-429e-8a42-20d28bd84776",
    name: "Sucursal Centroamérica",
    branchId: "0febf243-90b7-4ff2-867d-975c1d494407",
    address:
      "Rotonda Centroamérica 2c al este, mano izquierda contiguo a Farma 911, módulo esquinero",
    contact: null,
    locationType: "STORE",
  },
  Centroamérica: {
    id: "5a5e3be7-918a-429e-8a42-20d28bd84776",
    name: "Sucursal Centroamérica",
    branchId: "0febf243-90b7-4ff2-867d-975c1d494407",
    address:
      "Rotonda Centroamérica 2c al este, mano izquierda contiguo a Farma 911, módulo esquinero",
    contact: null,
    locationType: "STORE",
  },
};

// Price type IDs (from user's database data)
const PRICE_TYPE_IDS = {
  Unitario: "87fdf151-4601-4385-8471-463e3fd14194",
  Emprendedor: "8f361e07-18c9-498f-90ef-0f3c8f56f7a2",
  Mayorista: "a1275fcc-80f9-4410-bb30-91a057c48dce",
  Distribuidor: "43bc2cce-89a2-4443-9412-72ee8442566a",
} as const;

// Cache for price type IDs
const priceTypeCache = new Map<string, string>();

// Cache for location IDs
const locationCache = new Map<string, string>();

// Cache for branch IDs
const branchCache = new Map<string, string>();

interface CSVRow {
  SKU: string;
  "CODIGO DE BARRA": string;
  PRODUCTO: string;
  COSTO: string;
  "P. VENTA (DETALLE)": string;
  "P. VENTA (EMPRENDEDOR)": string;
  "P. VENTA (MAYOREO)": string;
  "P. VENTA (DISTRIBUIDOR)": string;
  MULTIPLO: string;
  DEPARTAMENTO: string;
  EXISTENCIA: string;
  "INV. MÍNIMO": string;
  "INV. MÁXIMO": string;
  UBICACION: string;
  RERENCIA: string;
}

/**
 * Parse price string and convert to Nicaraguan format (comma thousands, period decimal)
 * Handles both formats:
 * - Nicaraguan format: "C$1,300.00" (comma thousands, period decimal) -> 1300.00
 * - Spanish format: "C$1.150,00" (period thousands, comma decimal) -> 1150.00
 */
function parsePrice(priceStr: string | undefined): number | null {
  if (!priceStr || priceStr.trim() === "") return null;

  // Remove "C$" prefix and trim
  let cleaned = priceStr.replaceAll("C$", "").trim();

  // Count separators to detect format
  const periodCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  const lastPeriod = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  // Spanish format detection: period before comma (e.g., "1.150,00")
  // OR if there are periods but the last separator is a comma
  if (lastComma > lastPeriod && lastPeriod !== -1) {
    // Spanish format: period = thousands separator, comma = decimal separator
    // Example: "1.150,00" -> remove periods, replace comma with period -> "1150.00"
    cleaned = cleaned.replaceAll(".", "").replace(",", ".");
  } else if (periodCount > 1 && commaCount === 0) {
    // Multiple periods but no comma - likely Spanish format without decimals
    // Example: "1.150" -> remove periods -> "1150"
    cleaned = cleaned.replaceAll(".", "");
  } else {
    // Nicaraguan format: comma = thousands separator, period = decimal separator (or no separators)
    // Example: "1,300.00" -> remove commas -> "1300.00"
    // Example: "1300.00" -> no change -> "1300.00"
    cleaned = cleaned.replaceAll(",", "");
  }

  const parsed = Number.parseFloat(cleaned);

  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Parse inventory quantity string to number
 */
function parseQuantity(qtyStr: string | undefined): number {
  if (!qtyStr || qtyStr.trim() === "") return 0;

  const cleaned = qtyStr.trim();
  const parsed = Number.parseInt(cleaned, 10);

  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Clean brand name from DEPARTAMENTO column
 */
function cleanBrandName(departamento: string | undefined): string | null {
  if (!departamento || departamento.trim() === "") return null;

  // Remove parentheses if present
  let cleaned = departamento.trim();
  cleaned = cleaned.replaceAll(/^\(/g, "").replaceAll(/\)$/g, "");
  cleaned = cleaned.trim();

  return cleaned === "" ? null : cleaned;
}

/**
 * Get location details from UBICACION column value
 */
function getLocationFromUbicacion(
  ubicacion: string | undefined
): LocationDetails | null {
  if (!ubicacion || ubicacion.trim() === "") return null;

  const ubicacionNormalized = ubicacion.trim();

  // Try exact match first
  if (LOCATION_MAPPINGS[ubicacionNormalized]) {
    return LOCATION_MAPPINGS[ubicacionNormalized];
  }

  // Try case-insensitive match
  for (const [key, location] of Object.entries(LOCATION_MAPPINGS)) {
    if (key.toLowerCase() === ubicacionNormalized.toLowerCase()) {
      return location;
    }
  }

  // Try partial matches
  if (ubicacionNormalized.toLowerCase().includes("bello horizonte")) {
    return LOCATION_MAPPINGS["SUCURSAL BELLO HORIZONTE"];
  }

  if (
    ubicacionNormalized.toLowerCase().includes("centroamérica") ||
    ubicacionNormalized.toLowerCase().includes("centroamerica")
  ) {
    return LOCATION_MAPPINGS["Sucursal Centroamérica"];
  }

  return null;
}

/**
 * Get or create brand
 */
async function _getOrCreateBrand(brandName: string): Promise<string> {
  const cleanedName = cleanBrandName(brandName);
  if (!cleanedName) {
    throw new Error(`Invalid brand name: ${brandName}`);
  }

  // Check if brand exists
  const existingBrand = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM brands WHERE name = ${cleanedName} AND is_deleted = false LIMIT 1
  `;

  if (existingBrand && existingBrand.length > 0) {
    return existingBrand[0].id;
  }

  // Create new brand
  const newBrand = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO brands (id, name, created_at, updated_at, is_deleted)
    VALUES (gen_random_uuid(), ${cleanedName}, NOW(), NOW(), false)
    RETURNING id
  `;

  if (!newBrand || newBrand.length === 0) {
    throw new Error(`Failed to create brand: ${cleanedName}`);
  }

  return newBrand[0].id;
}

/**
 * Get or create price type by name or ID
 */
async function getOrCreatePriceType(
  name: string,
  preferredId?: string
): Promise<string> {
  // Check cache first
  if (priceTypeCache.has(name)) {
    return priceTypeCache.get(name)!;
  }

  // Try to find by ID first if provided
  if (preferredId) {
    const existingById = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM price_types 
      WHERE id = ${preferredId}::uuid AND is_deleted = false 
      LIMIT 1
    `;

    if (existingById && existingById.length > 0) {
      priceTypeCache.set(name, existingById[0].id);
      return existingById[0].id;
    }
  }

  // Try to find by name
  const existingByName = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM price_types 
    WHERE name = ${name} AND is_deleted = false 
    LIMIT 1
  `;

  if (existingByName && existingByName.length > 0) {
    priceTypeCache.set(name, existingByName[0].id);
    return existingByName[0].id;
  }

  // If preferredId is provided, the price type should already exist - don't create
  if (preferredId) {
    throw new Error(
      `Price type "${name}" with ID ${preferredId} not found in database. Please ensure price types are seeded first.`
    );
  }

  // Create new price type with default values (only if no preferredId)
  // Find the next available priority
  const maxPriority = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(priority) as max FROM price_types WHERE is_deleted = false
  `;
  const nextPriority = (maxPriority[0]?.max || 0) + 1;

  let minQuantity = 1;
  let description = `Precio ${name}`;

  if (name === "Emprendedor") {
    minQuantity = 1;
    description = "Precio especial para emprendedores";
  } else if (name === "Mayorista") {
    minQuantity = 6;
    description = "Precio mayorista para compras en volumen";
  } else if (name === "Distribuidor") {
    minQuantity = 12;
    description = "Tipos de precios para clientes distribuidores";
  } else if (name === "Unitario") {
    minQuantity = 1;
    description = "Precio unitario para compras individuales";
  }

  // Create new price type with next available priority
  const newPriceType = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO price_types (
      id, name, description, minimum_quantity, priority, is_active, is_deleted,
      created_at, updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${name},
      ${description},
      ${minQuantity},
      ${nextPriority},
      true,
      false,
      NOW(),
      NOW()
    )
    RETURNING id
  `;

  if (!newPriceType || newPriceType.length === 0) {
    throw new Error(`Failed to create price type: ${name}`);
  }

  priceTypeCache.set(name, newPriceType[0].id);
  return newPriceType[0].id;
}

/**
 * Branch details interface
 */
interface _BranchDetails {
  id: string;
  name: string;
}

/**
 * Location details interface
 */
interface LocationDetails {
  id: string;
  name: string;
  branchId: string | null;
  address?: string | null;
  contact?: string | null;
  locationType?: "STORE" | "WAREHOUSE" | "DISTRIBUTION_CENTER" | "POPUP_STORE";
}

/**
 * Get or create branch
 */
async function getOrCreateBranch(
  branchId: string,
  branchName: string
): Promise<string> {
  // Check cache first
  if (branchCache.has(branchId)) {
    return branchCache.get(branchId)!;
  }

  // Check if branch exists
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM branches 
    WHERE id = ${branchId}::uuid AND is_deleted = false 
    LIMIT 1
  `;

  if (existing && existing.length > 0) {
    branchCache.set(branchId, existing[0].id);
    return existing[0].id;
  }

  // Create new branch
  const newBranch = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO branches (
      id, name, is_active, is_deleted, created_at, updated_at
    )
    VALUES (
      ${branchId}::uuid,
      ${branchName},
      true,
      false,
      NOW(),
      NOW()
    )
    RETURNING id
  `;

  if (!newBranch || newBranch.length === 0) {
    throw new Error(`Failed to create branch: ${branchName}`);
  }

  branchCache.set(branchId, newBranch[0].id);
  return newBranch[0].id;
}

/**
 * Verify location exists, create if it doesn't
 */
async function getOrCreateLocation(
  locationDetails: LocationDetails
): Promise<string> {
  const {
    id,
    name,
    branchId,
    address,
    contact,
    locationType = "STORE",
  } = locationDetails;

  // Check cache first
  if (locationCache.has(id)) {
    return locationCache.get(id)!;
  }

  // Check if location exists
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM locations 
    WHERE id = ${id}::uuid AND is_deleted = false 
    LIMIT 1
  `;

  if (existing && existing.length > 0) {
    locationCache.set(id, existing[0].id);
    return existing[0].id;
  }

  // Ensure branch exists if branchId is provided
  if (branchId) {
    const branchInfo =
      BRANCH_MAPPINGS[branchId as keyof typeof BRANCH_MAPPINGS];
    if (branchInfo) {
      await getOrCreateBranch(branchId, branchInfo.name);
    }
  }

  // Create new location
  const newLocation = branchId
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO locations (
          id, name, branch_id, address, contact, location_type,
          is_deleted, created_at, updated_at
        )
        VALUES (
          ${id}::uuid,
          ${name},
          ${branchId}::uuid,
          ${address || null},
          ${contact || null},
          'STORE',
          false,
          NOW(),
          NOW()
        )
        RETURNING id
      `
    : await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO locations (
          id, name, branch_id, address, contact, location_type,
          is_deleted, created_at, updated_at
        )
        VALUES (
          ${id}::uuid,
          ${name},
          NULL,
          ${address || null},
          ${contact || null},
          ${locationType}::location_type,
          false,
          NOW(),
          NOW()
        )
        RETURNING id
      `;

  if (!newLocation || newLocation.length === 0) {
    throw new Error(`Failed to create location: ${name}`);
  }

  locationCache.set(id, newLocation[0].id);
  return newLocation[0].id;
}

/**
 * Transaction-aware version: Get or create brand
 */
async function getOrCreateBrandWithTx(
  tx: TransactionClient,
  brandName: string
): Promise<string> {
  const cleanedName = cleanBrandName(brandName);
  if (!cleanedName) {
    throw new Error(`Invalid brand name: ${brandName}`);
  }

  // Check if brand exists (case-insensitive)
  const existingBrand = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM brands WHERE is_deleted = false AND LOWER(name) = LOWER(${cleanedName}) LIMIT 1
  `;

  if (existingBrand && existingBrand.length > 0) {
    return existingBrand[0].id;
  }

  // Create new brand
  const newBrand = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO brands (id, name, created_at, updated_at, is_deleted)
    VALUES (gen_random_uuid(), ${cleanedName}, NOW(), NOW(), false)
    RETURNING id
  `;

  if (!newBrand || newBrand.length === 0) {
    throw new Error(`Failed to create brand: ${cleanedName}`);
  }

  return newBrand[0].id;
}

/**
 * Generate a unique barcode by appending a random 3-digit suffix if needed
 */
async function ensureUniqueBarcode(
  tx: TransactionClient,
  originalBarcode: string | null
): Promise<string | null> {
  if (!originalBarcode) {
    return null;
  }

  // Check if barcode already exists
  let existing = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM products 
    WHERE barcode = ${originalBarcode} 
    AND is_deleted = false 
    LIMIT 1
  `;

  // If barcode doesn't exist, return it as-is
  if (!existing || existing.length === 0) {
    return originalBarcode;
  }

  // Barcode exists, try appending random 3-digit suffix
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const randomSuffix = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    const newBarcode = `${originalBarcode}-${randomSuffix}`;

    existing = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM products 
      WHERE barcode = ${newBarcode} 
      AND is_deleted = false 
      LIMIT 1
    `;

    if (!existing || existing.length === 0) {
      console.warn(
        `⚠️  Barcode "${originalBarcode}" already exists, using "${newBarcode}" instead`
      );
      return newBarcode;
    }

    attempts++;
  }

  // If we couldn't find a unique barcode after max attempts, throw error
  throw new Error(
    `Could not generate unique barcode for "${originalBarcode}" after ${maxAttempts} attempts`
  );
}

/**
 * Transaction-aware version: Create product (searches by SKU and barcode, creates if not found)
 */
async function createProductWithTx(
  tx: TransactionClient,
  row: CSVRow,
  brandId: string
): Promise<string> {
  const sku = row.SKU?.trim() || null;
  const originalBarcode = row["CODIGO DE BARRA"]?.trim() || null;
  const name = row.PRODUCTO?.trim();

  if (!name) {
    throw new Error("Product name is required");
  }

  // Check if product already exists by SKU OR barcode
  let existingProduct: Array<{ id: string; is_deleted: boolean }> | null = null;

  if (sku || originalBarcode) {
    if (sku && originalBarcode) {
      // Both SKU and barcode exist - check with OR
      existingProduct = await tx.$queryRaw<
        Array<{ id: string; is_deleted: boolean }>
      >`
        SELECT id FROM products 
        WHERE (sku = ${sku} OR barcode = ${originalBarcode})
        LIMIT 1
      `;
    } else if (sku) {
      // Only SKU exists
      existingProduct = await tx.$queryRaw<
        Array<{ id: string; is_deleted: boolean }>
      >`
        SELECT id FROM products 
        WHERE sku = ${sku}
        LIMIT 1
      `;
    } else if (originalBarcode) {
      // Only barcode exists
      existingProduct = await tx.$queryRaw<
        Array<{ id: string; is_deleted: boolean }>
      >`
        SELECT id FROM products 
        WHERE barcode = ${originalBarcode}
        LIMIT 1
      `;
    }
  }

  if (
    existingProduct &&
    existingProduct.length > 0 &&
    existingProduct[0].is_deleted
  ) {
    const deletedProductId = existingProduct[0].id;
    console.log(
      `    🗑️  Found soft-deleted product (ID: ${deletedProductId}), hard deleting...`
    );

    // Hard delete the soft-deleted product
    await tx.$executeRaw`
      DELETE FROM products 
      WHERE id = ${deletedProductId}::uuid
    `;

    console.log(`    ✅ Hard deleted product with ID: ${deletedProductId}`);
  } else if (existingProduct && existingProduct.length > 0) {
    console.log("existingProduct", existingProduct);
    return existingProduct[0].id;
  }

  // Product doesn't exist - ensure barcode is unique before creating new product
  const barcode = await ensureUniqueBarcode(tx, originalBarcode);

  // Create new product
  const newProduct = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO products (
      id, sku, barcode, name, brand_id, is_active, is_deleted, 
      created_at, updated_at, metadata, default_variant_only
    )
    VALUES (
      gen_random_uuid(), 
      ${sku}, 
      ${barcode}, 
      ${name}, 
      ${brandId}::uuid, 
      true, 
      false, 
      NOW(), 
      NOW(), 
      '{}'::jsonb,
      false
    )
    RETURNING id
  `;

  if (!newProduct || newProduct.length === 0) {
    throw new Error(`Failed to create product: ${name}`);
  }

  console.log(
    `  ✨ Created product: "${name}" (SKU: ${sku || "N/A"}, Barcode: ${barcode || "N/A"})`
  );
  return newProduct[0].id;
}

/**
 * Transaction-aware version: Create product variant with cost price, minimum stock, and maximum stock
 * Note: This function only creates new variants. Updating existing variants is handled in the main processing logic.
 */
async function createProductVariantWithTx(
  tx: TransactionClient,
  productId: string,
  row: CSVRow
): Promise<string> {
  const name = row.PRODUCTO?.trim();
  const sku = row.SKU?.trim() || null;
  const barcode = row["CODIGO DE BARRA"]?.trim() || null;
  const costPrice = parsePrice(row.COSTO) ?? 0;
  const minStock = parseQuantity(row["INV. MÍNIMO"]) || null;
  const maxStock = parseQuantity(row["INV. MÁXIMO"]) || null;
  const multiple = parseQuantity(row.MULTIPLO) || null;

  // Log warning if cost price is missing
  if (parsePrice(row.COSTO) === null) {
    console.warn(
      `⚠️  Missing cost price for product: ${row.PRODUCTO}, using default: 0`
    );
  }

  // Create new variant
  const newVariant = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO product_variants (
      id, product_id, sku, barcode, cost_price, minimum_stock, maximum_stock, multiple, is_active, is_deleted,
      created_at, updated_at, attributes, applies_to_discounts, name
    )
    VALUES (
      gen_random_uuid(),
      ${productId}::uuid,
      ${sku},
      ${barcode},
      ${costPrice},
      ${minStock},
      ${maxStock},
      ${multiple},
      true,
      false,
      NOW(),
      NOW(),
      '{}'::jsonb,
      true,
      ${name}
    )
    RETURNING id
  `;

  if (!newVariant || newVariant.length === 0) {
    throw new Error(`Failed to create variant for product: ${row.PRODUCTO}`);
  }

  console.log(
    `    ✨ Created variant for "${name}" (Cost: C$${costPrice.toFixed(2)})`
  );
  return newVariant[0].id;
}

/**
 * Transaction-aware version: Create product variant prices for all price types
 */
async function createProductVariantPricesWithTx(
  tx: TransactionClient,
  variantId: string,
  row: CSVRow
): Promise<void> {
  // Unitario price (P. VENTA (DETALLE))
  const unitarioPrice = parsePrice(row["P. VENTA (DETALLE)"]);
  if (unitarioPrice !== null && unitarioPrice > 0) {
    const priceTypeId = await getOrCreatePriceType(
      "Unitario",
      PRICE_TYPE_IDS.Unitario
    );

    await tx.$executeRaw`
      INSERT INTO product_variant_prices (
        product_variant_id, price_type_id, price, "minQuantity"
      )
      VALUES (
        ${variantId}::uuid,
        ${priceTypeId}::uuid,
        ${unitarioPrice},
        1
      )
      ON CONFLICT (product_variant_id, price_type_id) 
      DO UPDATE SET price = ${unitarioPrice}
    `;
  }

  // Emprendedor price (P. VENTA (EMPRENDEDOR))
  const emprendedorPrice = parsePrice(row["P. VENTA (EMPRENDEDOR)"]);
  if (emprendedorPrice !== null && emprendedorPrice > 0) {
    const priceTypeId = await getOrCreatePriceType(
      "Emprendedor",
      PRICE_TYPE_IDS.Emprendedor
    );

    await tx.$executeRaw`
      INSERT INTO product_variant_prices (
        product_variant_id, price_type_id, price, "minQuantity"
      )
      VALUES (
        ${variantId}::uuid,
        ${priceTypeId}::uuid,
        ${emprendedorPrice},
        1
      )
      ON CONFLICT (product_variant_id, price_type_id) 
      DO UPDATE SET price = ${emprendedorPrice}
    `;
  }

  // Mayorista price (P. VENTA (MAYOREO))
  const mayoristaPrice = parsePrice(row["P. VENTA (MAYOREO)"]);
  if (mayoristaPrice !== null && mayoristaPrice > 0) {
    const priceTypeId = await getOrCreatePriceType(
      "Mayorista",
      PRICE_TYPE_IDS.Mayorista
    );

    await tx.$executeRaw`
      INSERT INTO product_variant_prices (
        product_variant_id, price_type_id, price, "minQuantity"
      )
      VALUES (
        ${variantId}::uuid,
        ${priceTypeId}::uuid,
        ${mayoristaPrice},
        6
      )
      ON CONFLICT (product_variant_id, price_type_id) 
      DO UPDATE SET price = ${mayoristaPrice}
    `;
  }

  // Distribuidor price (P. VENTA (DISTRIBUIDOR))
  const distribuidorPrice = parsePrice(row["P. VENTA (DISTRIBUIDOR)"]);
  if (distribuidorPrice !== null && distribuidorPrice > 0) {
    const priceTypeId = await getOrCreatePriceType(
      "Distribuidor",
      PRICE_TYPE_IDS.Distribuidor
    );

    await tx.$executeRaw`
      INSERT INTO product_variant_prices (
        product_variant_id, price_type_id, price, "minQuantity"
      )
      VALUES (
        ${variantId}::uuid,
        ${priceTypeId}::uuid,
        ${distribuidorPrice},
        12
      )
      ON CONFLICT (product_variant_id, price_type_id) 
      DO UPDATE SET price = ${distribuidorPrice}
    `;
  }
}

/**
 * Transaction-aware version: Create stock movement
 */
async function createStockMovementWithTx(
  tx: TransactionClient,
  productId: string,
  variantId: string,
  locationDetails: LocationDetails,
  quantity: number,
  reference: string | null = null,
  movementType: string = "POSITIVE_ADJUSTMENT"
): Promise<string> {
  if (quantity <= 0) {
    return "";
  }

  // Verify location exists (this should already be done in initialization)
  const locationId = locationDetails.id;

  const newMovement = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO stock_movements (
      id, product_id, product_variant_id, to_location_id,
      movement_type, quantity, reference, created_at, metadata
    )
    VALUES (
      gen_random_uuid(),
      ${productId}::uuid,
      ${variantId}::uuid,
      ${locationId}::uuid,
      ${movementType}::"StockMovementType",
      ${quantity},
      ${reference},
      NOW(),
      '{"source": "csv_migration"}'::jsonb
    )
    RETURNING id
  `;

  if (!newMovement || newMovement.length === 0) {
    throw new Error(`Failed to create stock movement`);
  }

  return newMovement[0].id;
}

/**
 * Transaction-aware version: Upsert stock level (sets quantity, doesn't add)
 */
async function upsertStockLevelWithTx(
  tx: TransactionClient,
  productId: string,
  variantId: string,
  locationDetails: LocationDetails,
  quantity: number
): Promise<void> {
  if (quantity <= 0) {
    return;
  }

  const locationId = locationDetails.id;

  await tx.$executeRaw`
    INSERT INTO stock_levels (
      id, product_id, product_variant_id, location_id, quantity, reserved, updated_at
    )
    VALUES (
      gen_random_uuid(),
      ${productId}::uuid,
      ${variantId}::uuid,
      ${locationId}::uuid,
      ${quantity},
      0,
      NOW()
    )
    ON CONFLICT (product_id, product_variant_id, location_id)
    DO UPDATE SET 
      quantity = EXCLUDED.quantity,
      updated_at = NOW()
  `;
}

/**
 * Find product variant by product_id, sku, and barcode
 */
async function findProductVariantBySkuAndBarcode(
  tx: TransactionClient,
  productId: string,
  sku: string | null,
  barcode: string | null
): Promise<Array<{ id: string }>> {
  if (!sku && !barcode) {
    return [];
  }

  if (sku && barcode) {
    return await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM product_variants 
      WHERE product_id = ${productId}::uuid 
      AND sku = ${sku}
      AND barcode = ${barcode}
      AND is_deleted = false 
      LIMIT 1
    `;
  } else if (sku) {
    return await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM product_variants 
      WHERE product_id = ${productId}::uuid 
      AND sku = ${sku}
      AND is_deleted = false 
      LIMIT 1
    `;
  } else {
    return await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM product_variants 
      WHERE product_id = ${productId}::uuid 
      AND barcode = ${barcode}
      AND is_deleted = false 
      LIMIT 1
    `;
  }
}

/**
 * Check if variant has any SALE movements at a specific location
 */
async function hasSaleMovements(
  tx: TransactionClient,
  variantId: string,
  locationId: string
): Promise<boolean> {
  const movements = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM stock_movements 
    WHERE product_variant_id = ${variantId}::uuid 
    AND movement_type = 'SALE'
    AND to_location_id = ${locationId}::uuid
    LIMIT 1
  `;
  return movements && movements.length > 0;
}

/**
 * Delete all stock movements for a variant at a specific location
 */
async function deleteStockMovementsForVariant(
  tx: TransactionClient,
  variantId: string,
  locationId: string
): Promise<void> {
  await tx.$executeRaw`
    DELETE FROM stock_movements 
    WHERE product_variant_id = ${variantId}::uuid
    AND to_location_id = ${locationId}::uuid
  `;
}

/**
 * Delete all stock levels for a variant at a specific location
 */
async function deleteStockLevelsForVariant(
  tx: TransactionClient,
  variantId: string,
  locationId: string
): Promise<void> {
  await tx.$executeRaw`
    DELETE FROM stock_levels 
    WHERE product_variant_id = ${variantId}::uuid
    AND location_id = ${locationId}::uuid
  `;
}

/**
 * Initialize required data (price types, branches, locations)
 */
async function initializeRequiredData(): Promise<void> {
  console.log("🔧 Initializing required data...");

  // Pre-load price types
  console.log("  📋 Loading price types...");
  await getOrCreatePriceType("Unitario", PRICE_TYPE_IDS.Unitario);
  await getOrCreatePriceType("Emprendedor", PRICE_TYPE_IDS.Emprendedor);
  await getOrCreatePriceType("Mayorista", PRICE_TYPE_IDS.Mayorista);
  await getOrCreatePriceType("Distribuidor", PRICE_TYPE_IDS.Distribuidor);

  // Pre-load branches
  console.log("  🏢 Verifying branches...");
  for (const branch of Object.values(BRANCH_MAPPINGS)) {
    await getOrCreateBranch(branch.id, branch.name);
  }

  // Pre-load locations
  console.log("  📍 Verifying locations...");
  await getOrCreateLocation(LOCATION_MAPPINGS["SUCURSAL BELLO HORIZONTE"]);
  await getOrCreateLocation(LOCATION_MAPPINGS["Sucursal Centroamérica"]);

  console.log("  ✅ Required data initialized");
}

/**
 * Process all rows within a transaction
 */
async function processAllRowsInTransaction(records: CSVRow[]): Promise<{
  processed: number;
  errors: number;
  errorLog: Array<{ row: number; error: string }>;
}> {
  let processed = 0;
  let errors = 0;
  const errorLog: Array<{ row: number; error: string }> = [];

  // Wrap all operations in a single transaction
  await prisma.$transaction(
    async tx => {
      console.log("🔄 Starting transaction...");

      for (let i = 0; i < records.length; i++) {
        const row = records[i];

        try {
          // Skip rows without product name
          if (!row.PRODUCTO || row.PRODUCTO.trim() === "") {
            continue;
          }

          // Skip rows without brand/department
          if (!row.DEPARTAMENTO || row.DEPARTAMENTO.trim() === "") {
            continue;
          }

          // 0. Get or create brand
          const brandId = await getOrCreateBrandWithTx(tx, row.DEPARTAMENTO);

          // 1. Find or create product (by SKU AND barcode)
          const sku = row.SKU?.trim() || null;
          const barcode = row["CODIGO DE BARRA"]?.trim() || null;
          const productId = await createProductWithTx(tx, row, brandId);

          // 2. Extract location early (needed for stock operations)
          const ubicacion = row.UBICACION?.trim();
          const locationDetails = ubicacion
            ? getLocationFromUbicacion(ubicacion)
            : null;
          const existenciaQty = parseQuantity(row.EXISTENCIA);

          // 3. Try to find product variant by product_id, sku, and barcode
          const existingVariants = await findProductVariantBySkuAndBarcode(
            tx,
            productId,
            sku,
            barcode
          );

          let variantId: string;

          if (existingVariants.length > 0) {
            // 3.1. Variant exists
            variantId = existingVariants[0].id;

            // Check and delete stock movements/levels only if we have a valid location
            if (locationDetails && existenciaQty > 0) {
              // Check if there are any SALE movements at this location
              const hasSales = await hasSaleMovements(
                tx,
                variantId,
                locationDetails.id
              );

              if (hasSales) {
                // Skip this product - log it for manual adjustment
                console.log(
                  `    ⚠️  Skipping "${row.PRODUCTO}" (SKU: ${sku || "N/A"}) - has SALE movements at ${locationDetails.name}, manual adjustment required`
                );
                processed++;
                continue;
              }

              // No SALE movements at this location - delete existing movements and stock levels for this location
              await deleteStockMovementsForVariant(
                tx,
                variantId,
                locationDetails.id
              );
              await deleteStockLevelsForVariant(
                tx,
                variantId,
                locationDetails.id
              );
            } else if (!locationDetails && existenciaQty > 0) {
              console.warn(
                `⚠️  Unknown location "${ubicacion}" for product: ${row.PRODUCTO}, skipping stock operations`
              );
            }

            // Update variant with new data
            const name = row.PRODUCTO?.trim();
            const costPrice = parsePrice(row.COSTO) ?? 0;
            const minStock = parseQuantity(row["INV. MÍNIMO"]) || null;
            const maxStock = parseQuantity(row["INV. MÁXIMO"]) || null;
            const multiple = parseQuantity(row.MULTIPLO) || null;

            await tx.$executeRaw`
              UPDATE product_variants
              SET 
                cost_price = ${costPrice},
                minimum_stock = ${minStock},
                maximum_stock = ${maxStock},
                multiple = ${multiple},
                name = COALESCE(${name}, name),
                updated_at = NOW()
              WHERE id = ${variantId}::uuid
            `;
            console.log(
              `    📝 Updated variant for "${name}" (Cost: C$${costPrice.toFixed(2)})`
            );

            // Update prices
            await createProductVariantPricesWithTx(tx, variantId, row);
            console.log(`    📝 Updated prices for variant`);

            // Create new stock movement and stock level
            if (existenciaQty > 0 && locationDetails) {
              const referencia = row.RERENCIA?.trim() || null;
              await createStockMovementWithTx(
                tx,
                productId,
                variantId,
                locationDetails,
                existenciaQty,
                referencia
              );
              console.log(
                `    ✨ Created stock movement: ${existenciaQty} units at ${locationDetails.name}${referencia ? ` (Ref: ${referencia})` : ""}`
              );
              await upsertStockLevelWithTx(
                tx,
                productId,
                variantId,
                locationDetails,
                existenciaQty
              );
              console.log(
                `    ✨ Created stock level: ${existenciaQty} units at ${locationDetails.name}`
              );
            }
          } else {
            // 3.2. No variant exists - create variant, movement, and stock level
            variantId = await createProductVariantWithTx(tx, productId, row);

            // Create product variant prices
            await createProductVariantPricesWithTx(tx, variantId, row);
            console.log(`    📝 Created prices for variant`);

            // Create stock movements and stock levels
            if (existenciaQty > 0 && locationDetails) {
              const referencia = row.RERENCIA?.trim() || null;
              await createStockMovementWithTx(
                tx,
                productId,
                variantId,
                locationDetails,
                existenciaQty,
                referencia
              );
              console.log(
                `    ✨ Created stock movement: ${existenciaQty} units at ${locationDetails.name}${referencia ? ` (Ref: ${referencia})` : ""}`
              );
              await upsertStockLevelWithTx(
                tx,
                productId,
                variantId,
                locationDetails,
                existenciaQty
              );
              console.log(
                `    ✨ Created stock level: ${existenciaQty} units at ${locationDetails.name}`
              );
            } else if (existenciaQty > 0 && !locationDetails) {
              console.warn(
                `⚠️  Unknown location "${ubicacion}" for product: ${row.PRODUCTO}, skipping stock`
              );
            }
          }

          processed++;

          if (processed % 10 === 0) {
            console.log(`✅ Processed ${processed} products...`);
          }
        } catch (error) {
          errors++;
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          errorLog.push({ row: i + 1, error: errorMsg });
          console.error(`❌ Error processing row ${i + 1}: ${errorMsg}`);
          // Re-throw to rollback transaction
          throw error;
        }
      }
    },
    {
      maxWait: 60000, // 60 seconds
      timeout: 1800000, // 30 minutes (increased for large CSV migrations)
    }
  );

  return { processed, errors, errorLog };
}

/**
 * Main migration function
 */
async function main() {
  console.log("🚀 Starting CSV migration...");

  // Initialize required data first (outside transaction)
  await initializeRequiredData();

  // Read CSV file
  const csvPath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "catalogo_de_productos.csv"
  );
  console.log(`📖 Reading CSV from: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at: ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf-8");

  // Parse CSV (skip first empty line, use second line as headers)
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as CSVRow[];

  console.log(`📊 Found ${records.length} rows to process`);
  console.log("🔄 All operations will be wrapped in a single transaction...");

  let processed = 0;
  let errors = 0;
  const errorLog: Array<{ row: number; error: string }> = [];

  try {
    const result = await processAllRowsInTransaction(records);
    processed = result.processed;
    errors = result.errors;
    errorLog.push(...result.errorLog);
  } catch (error) {
    console.error(
      "\n💥 Transaction failed - all changes have been rolled back!"
    );
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Migration failed: ${errorMsg}`);
  }

  console.log("\n📈 Migration Summary:");
  console.log(`✅ Successfully processed: ${processed} products`);
  console.log(`❌ Errors: ${errors}`);

  if (errorLog.length > 0) {
    console.log("\n⚠️  Error Log (first 20):");
    errorLog.slice(0, 20).forEach(({ row, error }) => {
      console.log(`  Row ${row}: ${error}`);
    });
  }

  console.log("\n✨ Migration completed!");
}

// Run migration
main()
  .catch(error => {
    console.error("💥 Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

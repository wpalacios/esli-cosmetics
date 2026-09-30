# CSV Migration Script

This script migrates product data from `catalogo_de_productos.csv` to the duplicate tables in the database.

## Prerequisites

1. Ensure the duplicate tables exist in your database:
   - `brands_duplicate`
   - `products_duplicate`
   - `product_variants_duplicate`
   - `product_variant_prices_duplicate`
   - `stock_movements_duplicate`
   - `stock_levels_duplicate`

2. Install dependencies:
   ```bash
   cd apps/backend
   pnpm install
   ```

3. Ensure your `.env` file has the correct `DATABASE_URL` configured.

## Usage

Run the migration script:

```bash
cd apps/backend
pnpm db:migrate:csv
```

Or directly with tsx:

```bash
cd apps/backend
tsx prisma/migrate-csv.ts
```

## What the Script Does

1. **Brands**: Creates or updates brands from the "Departamento" column in the CSV
2. **Products**: Searches product by sku and barcode and creates products if they are not found in the db with:
   - SKU from "SKU" column
   - Barcode from "CODIGO DE BARRA" column
   - Name from "PRODUCTO" column
   - Brand ID from the created/updated brand

3. **Product Variants**: 
Creates one variant per product with:
   - Cost price from "COSTO" column
   - minQuantity from "INV. MÍNIMO" column
   - maxQuantity from "INV. MÁXIMO" column

4. **Product Variant Prices**: Creates prices for:
   - Unitario price (ID: `a1275fcc-80f9-4410-bb30-91a057c48dce`) from "P. VENTA (DETALLE)"
   - Emprendedor price (ID: `8f361e07-18c9-498f-90ef-0f3c8f56f7a2`) from "P. VENTA (EMPRENDEDOR)"
   - Mayorista price (ID: `a1275fcc-80f9-4410-bb30-91a057c48dce`) from "P. VENTA (MAYOREO)"
   - Distribuidor price (ID: `43bc2cce-89a2-4443-9412-72ee8442566a`) from "P. VENTA (DISTRIBUIDOR)"

5. **Stock Movements**: Creates stock movements for the location from the "UBICACION" column:
   - if value is BELLO HORIZONTTE use Location ID: `1f9bcdc5-365d-47a1-8b02-b70bfa458916`
   - if value is Centroamérica use Location ID: `5a5e3be7-918a-429e-8a42-20d28bd84776`

6. **Stock Levels**: 
Upserts stock levels based on the inventory quantities. Be carefule here, if the product variant stock level already exists in the database, then update the the record and update quantity with existing quantity + total of the new stock movements you're creatin

## Notes

- The script skips rows without product names or departments
- Prices are parsed from strings like "C$130.00" or "C$2,234.27" or "150.00"
- Zero or negative inventory quantities are skipped
- The script processes rows sequentially and logs errors without stopping
- Progress is logged every 10 processed products



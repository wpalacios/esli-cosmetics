import { PrismaClient, StockMovementType } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedStockInventory() {
  console.log("🌱 Seeding stock inventory...");

  // Get default warehouse and store locations
  const warehouse = await prisma.location.findFirst({
    where: { name: "Bodega Principal" },
  });

  const store = await prisma.location.findFirst({
    where: { name: "CENTROAMÉRICA" },
  });

  if (!warehouse) {
    console.log("⚠️  Warehouse not found, skipping stock inventory seed");
    return;
  }

  if (!store) {
    console.log("⚠️  Store not found, skipping stock inventory seed");
    return;
  }

  console.log(`📦 Warehouse: ${warehouse.name} (${warehouse.id})`);
  console.log(`🏪 Store: ${store.name} (${store.id})`);

  // Get the admin user to use as the creator
  const adminUser = await prisma.user.findFirst({
    where: { email: "admin@eslicosmetics.com" },
  });

  if (!adminUser) {
    console.log("⚠️  Admin user not found, skipping stock inventory seed");
    return;
  }

  // Get all product variants
  const productVariants = await prisma.productVariant.findMany({
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });

  console.log(`📊 Found ${productVariants.length} product variants to stock`);

  let purchaseCount = 0;
  let transferCount = 0;
  let stockLevelsCreated = 0;

  // Process each variant
  for (const variant of productVariants) {
    // Determine initial warehouse stock based on product category
    const categoryName = variant.product.category?.name || "";
    let warehouseQuantity = 0;
    let storeQuantity = 0;

    // Set realistic quantities based on product type
    if (
      categoryName === "Eyes" ||
      categoryName === "Face" ||
      categoryName === "Lips"
    ) {
      // Makeup products - higher volume
      warehouseQuantity = Math.floor(Math.random() * 50) + 100; // 100-150
      storeQuantity = Math.floor(Math.random() * 20) + 30; // 30-50
    } else if (categoryName === "Skincare") {
      // Skincare - medium volume
      warehouseQuantity = Math.floor(Math.random() * 40) + 60; // 60-100
      storeQuantity = Math.floor(Math.random() * 15) + 20; // 20-35
    } else if (categoryName === "Body") {
      // Body care - medium volume
      warehouseQuantity = Math.floor(Math.random() * 30) + 50; // 50-80
      storeQuantity = Math.floor(Math.random() * 10) + 15; // 15-25
    } else if (categoryName === "Tools & Accessories") {
      // Tools - lower volume
      warehouseQuantity = Math.floor(Math.random() * 20) + 30; // 30-50
      storeQuantity = Math.floor(Math.random() * 8) + 10; // 10-18
    } else {
      // Default for any other categories
      warehouseQuantity = Math.floor(Math.random() * 40) + 60;
      storeQuantity = Math.floor(Math.random() * 15) + 20;
    }

    // 1. Create PURCHASE movement to warehouse (initial stock arrival)
    const _purchaseMovement = await prisma.stockMovement.create({
      data: {
        productId: variant.productId,
        productVariantId: variant.id,
        toLocationId: warehouse.id,
        movementType: StockMovementType.PURCHASE,
        quantity: warehouseQuantity,
        reference: `PO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        note: `Initial stock purchase for ${variant.product.name} - ${variant.name}`,
        createdBy: adminUser.id,
      },
    });
    purchaseCount++;

    // 2. Check if warehouse stock level exists, then create/update
    const existingWarehouseStock = await prisma.stockLevel.findFirst({
      where: {
        productId: variant.productId,
        productVariantId: variant.id,
        locationId: warehouse.id,
      },
    });

    if (existingWarehouseStock) {
      await prisma.stockLevel.update({
        where: { id: existingWarehouseStock.id },
        data: {
          quantity: warehouseQuantity - storeQuantity, // Remaining after transfer
        },
      });
    } else {
      await prisma.stockLevel.create({
        data: {
          productId: variant.productId,
          productVariantId: variant.id,
          locationId: warehouse.id,
          quantity: warehouseQuantity - storeQuantity,
          reserved: 0,
        },
      });
    }
    stockLevelsCreated++;

    // 3. Create TRANSFER movement (transfer to store)
    await prisma.stockMovement.create({
      data: {
        productId: variant.productId,
        productVariantId: variant.id,
        fromLocationId: warehouse.id,
        toLocationId: store.id,
        movementType: StockMovementType.TRANSFER,
        quantity: storeQuantity,
        reference: `TRANSFER-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        note: `Initial stock transfer to ${store.name}`,
        createdBy: adminUser.id,
      },
    });
    transferCount++;

    // 4. Check if store stock level exists, then create/update
    const existingStoreStock = await prisma.stockLevel.findFirst({
      where: {
        productId: variant.productId,
        productVariantId: variant.id,
        locationId: store.id,
      },
    });

    if (existingStoreStock) {
      await prisma.stockLevel.update({
        where: { id: existingStoreStock.id },
        data: {
          quantity: storeQuantity,
        },
      });
    } else {
      await prisma.stockLevel.create({
        data: {
          productId: variant.productId,
          productVariantId: variant.id,
          locationId: store.id,
          quantity: storeQuantity,
          reserved: 0,
        },
      });
    }

    // Log progress every 10 variants
    if (purchaseCount % 10 === 0) {
      console.log(`  ✅ Processed ${purchaseCount} variants...`);
    }
  }

  console.log(`\n✨ Stock inventory seeded successfully!`);
  console.log(`  📥 Created ${purchaseCount} purchase movements`);
  console.log(`  🔄 Created ${transferCount} transfer movements`);
  console.log(`  📊 Created/Updated ${stockLevelsCreated} stock levels`);
  console.log(`  🏪 Store has ${transferCount} product variants in stock`);
  console.log(`  📦 Warehouse has ${purchaseCount} product variants in stock`);
}

// Run the seed if executed directly
if (require.main === module) {
  seedStockInventory()
    .catch(e => {
      console.error("❌ Error seeding stock inventory:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedWarehouseAltamira() {
  const existing = await prisma.location.findFirst({
    where: { name: "Bodega ALTAMIRA" },
  });

  let location;
  if (existing) {
    location = await prisma.location.update({
      where: { id: existing.id },
      data: {
        address: "DDF la Vicky, 4c hacia el Norte.",
        locationType: "WAREHOUSE",
        isDeleted: false,
        updatedAt: new Date(),
      },
    });
    console.log("  • Bodega ALTAMIRA [WAREHOUSE] (updated) ✓");
  } else {
    location = await prisma.location.create({
      data: {
        name: "Bodega ALTAMIRA",
        address: "DDF la Vicky, 4c hacia el Norte.",
        locationType: "WAREHOUSE",
        isDeleted: false,
      },
    });
    console.log("  • Bodega ALTAMIRA [WAREHOUSE] (created) ✓");
  }

  // Create or update cash register for this location
  const existingCashRegister = await prisma.cashRegister.findFirst({
    where: { locationId: location.id },
  });

  if (existingCashRegister) {
    await prisma.cashRegister.update({
      where: { id: existingCashRegister.id },
      data: {
        name: location.name,
        code: location.name,
        isActive: true,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.cashRegister.upsert({
      where: { code: location.name },
      update: {
        locationId: location.id,
        name: location.name,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        locationId: location.id,
        name: location.name,
        code: location.name,
        isActive: true,
      },
    });
  }
  console.log("  • Cash register for Bodega ALTAMIRA (created/updated) ✓");
}

export async function seedAdditionalLocations() {
  await seedWarehouseAltamira();
}

async function main() {
  try {
    await seedAdditionalLocations();
  } finally {
    await prisma.$disconnect();
  }
}

if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  main().catch(e => {
    console.error("❌ Error seeding locations:", e);
    process.exit(1);
  });
}

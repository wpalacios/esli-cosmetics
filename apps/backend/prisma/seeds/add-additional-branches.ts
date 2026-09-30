import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type BranchFixture = {
  code: string; // unique
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
};

const branches: BranchFixture[] = [
  {
    code: "BH",
    name: "BELLO HORIZONTE",
    address:
      "De la Iglesia Pio X, 1/2c al sur. Edificio color rosado, doble planta.",
    phone: null,
    isActive: true,
  },
];

async function seedBranches(fixtures: BranchFixture[]) {
  console.log(`grounded 🗻 Upserting ${fixtures.length} branches...`);

  for (const b of fixtures) {
    // Find existing branch by code (code is no longer unique, so we use findFirst)
    const existing = await prisma.branch.findFirst({
      where: { code: b.code, isDeleted: false },
    });

    const upserted = existing
      ? await prisma.branch.update({
          where: { id: existing.id },
          data: {
            name: b.name,
            address: b.address ?? null,
            phone: b.phone ?? null,
            isActive: b.isActive ?? false,
            isDeleted: false,
            updatedAt: new Date(),
          },
        })
      : await prisma.branch.create({
          data: {
            name: b.name,
            code: b.code,
            address: b.address ?? null,
            phone: b.phone ?? null,
            isActive: b.isActive ?? false,
            isDeleted: false,
          },
        });
    console.log(`  • ${upserted.name} [${upserted.code}] ✓`);
  }

  console.log("✅ Branch seeding completed.");
}

// Exported function to be used by the main seed.ts
export async function seedAdditionalBranches() {
  await seedBranches(branches);
}

async function main() {
  try {
    await seedAdditionalBranches();
  } finally {
    await prisma.$disconnect();
  }
}

// Guard standalone execution so it doesn't auto-run when imported
if (
  typeof require !== "undefined" &&
  typeof module !== "undefined" &&
  require.main === module
) {
  main().catch(e => {
    console.error("❌ Error seeding branches:", e);
    process.exit(1);
  });
}

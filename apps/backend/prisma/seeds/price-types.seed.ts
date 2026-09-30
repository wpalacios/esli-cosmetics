import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedPriceTypes() {
  console.log("💰 Seeding price types...");

  const priceTypes = [
    {
      id: "43bc2cce-89a2-4443-9412-72ee8442566a",
      name: "Distribuidor",
      priority: 1,
      minQuantity: 1,
      description: "Precio distribuidor",
      isActive: true,
    },
    {
      id: "a1275fcc-80f9-4410-bb30-91a057c48dce",
      name: "Mayorista",
      priority: 2,
      minQuantity: 1,
      description: "Precio mayorista para compras en volumen",
      isActive: true,
    },
    {
      id: "8f361e07-18c9-498f-90ef-0f3c8f56f7a2",
      name: "Emprendedor",
      priority: 3,
      minQuantity: 1,
      description: "Precio especial para emprendedores",
      isActive: true,
    },
    {
      id: "87fdf151-4601-4385-8471-463e3fd14194",
      name: "Unitario",
      priority: 4,
      minQuantity: 1,
      description: "Precio unitario para compras individuales",
      isActive: true,
    },
  ];

  const createdPriceTypes = [];
  for (const priceType of priceTypes) {
    const created = await prisma.priceType.upsert({
      where: { priority: priceType.priority },
      update: {
        name: priceType.name,
        minQuantity: priceType.minQuantity,
        description: priceType.description,
        isActive: priceType.isActive,
      },
      create: priceType,
      select: {
        id: true,
        name: true,
        priority: true,
        minQuantity: true,
        description: true,
        isActive: true,
      },
    });
    createdPriceTypes.push(created);
    console.log(
      `✅ Created price type: ${created.name} (priority: ${created.priority})`
    );
  }

  console.log(`✅ Created ${createdPriceTypes.length} price types`);
  return createdPriceTypes;
}

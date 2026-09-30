import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function seedCustomerTypes() {
  console.log("🌱 Seeding customer types...");

  const customerTypes = [
    {
      name: "Distribuidor",
      description:
        "Cliente distribuidor con descuentos especiales por volumen de compras",
      isActive: true,
    },
    {
      name: "Mayorista",
      description:
        "Cliente mayorista con descuentos especiales por volumen de compras",
      isActive: true,
    },
    {
      name: "Emprendedor",
      description: "Cliente emprendedor con precios preferenciales",
      isActive: true,
    },
    {
      name: "Ocasional",
      description: "Cliente ocasional con precios regulares",
      isActive: true,
    },
  ];

  for (const customerType of customerTypes) {
    await prisma.customerType.upsert({
      where: { name: customerType.name },
      update: customerType,
      create: customerType,
    });
  }

  console.log("✅ Customer types seeded successfully");
}

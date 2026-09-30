import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const brands = [
  {
    name: "Beauty Creations",
    description:
      "Beauty Creations is a fast-growing beauty brand founded in 2016 by Esmeralda Hernandez, committed to accessible luxury cosmetics for all and expanding into skincare.",
    websiteUrl: "https://www.beautycreationscosmetics.com",
    logoUrl:
      "https://seeklogo.com/vector-logo/373092/beauty-creations-logo-png-vector.ai",
    country: "USA",
  },
  {
    name: "Milani",
    description:
      'Milani Cosmetics is a Los Angeles–based makeup brand founded around 2001, with a mission of "luxury for all", offering prestige quality at affordable prices and strong inclusivity in shade range.',
    websiteUrl: "https://www.milanicosmetics.com",
    logoUrl:
      "https://www.milanicosmetics.com/wp-content/themes/milani/assets/img/logo.svg",
    country: "USA",
  },
  {
    name: "Rimmel",
    description:
      'Rimmel (aka Rimmel London) is a British cosmetics brand founded in London in 1834 by Eugène Rimmel; known for "Live the London Look" and its long history of accessible beauty.',
    websiteUrl: "https://www.rimmellondon.com",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/commons/7/79/Rimmel_logo.svg",
    country: "UK",
  },
  {
    name: "Maybelline",
    description:
      "Maybelline New York is a global cosmetics brand founded in 1915 in Chicago by Thomas Lyle Williams, now a subsidiary of L'Oréal; available in 120+ countries and with 1000+ shades.",
    websiteUrl: "https://www.maybelline.com",
    logoUrl:
      "https://upload.wikimedia.org/wikipedia/en/6/6e/Maybelline_logo.svg",
    country: "USA",
  },
];

export async function seedBrands() {
  console.log("🌱 Seeding brands...");

  for (const brandData of brands) {
    try {
      // Check if brand already exists
      const existingBrand = await prisma.brand.findFirst({
        where: {
          name: brandData.name,
        },
      });

      if (existingBrand) {
        console.log(
          `⚠️  Brand "${brandData.name}" already exists, skipping...`
        );
        continue;
      }

      // Create the brand
      const brand = await prisma.brand.create({
        data: brandData,
      });

      console.log(`✅ Created brand: ${brand.name}`);
    } catch (error) {
      console.error(`❌ Error creating brand "${brandData.name}":`, error);
    }
  }

  console.log("✅ Brands seeding completed!");
}

// Export brands for use in other seed files
export { brands };

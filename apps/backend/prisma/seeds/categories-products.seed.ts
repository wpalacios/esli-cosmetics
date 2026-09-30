import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface VariantSeedData {
  name: string;
  sku: string;
  price: number;
  costPrice: number;
  minQuantity?: number;
}

export interface ProductSeedData {
  name: string;
  description: string;
  sku: string;
  barcode: string;
  price: number;
  costPrice: number;
  isActive: boolean;
  categoryKey: string;
  variants: VariantSeedData[];
}

export async function seedCategoriesAndProducts() {
  console.log("🌱 Seeding categories and products...");

  // Get Beauty Creations brand ID (priority brand)
  const beautyCreationsBrand = await prisma.brand.findFirst({
    where: { name: "Beauty Creations" },
  });

  if (!beautyCreationsBrand) {
    console.error(
      "❌ Beauty Creations brand not found. Please run brands seed first."
    );
    return;
  }

  console.log(
    `✅ Using brand: ${beautyCreationsBrand.name} (ID: ${beautyCreationsBrand.id})`
  );

  // Create main categories with subcategories
  const categoriesData = [
    {
      name: "Eyes",
      description: "Eye makeup products for stunning looks",
      isActive: true,
      subcategories: [
        {
          name: "Eyeshadow Palettes",
          description: "Versatile color palettes for every occasion",
        },
        { name: "Eyeliner", description: "Precise and long-lasting eyeliners" },
        { name: "Mascara", description: "Volumizing and lengthening mascaras" },
        { name: "Eyebrows", description: "Brow products for perfect arches" },
        { name: "Eye Primer", description: "Long-lasting eye makeup base" },
        {
          name: "False Lashes",
          description: "Dramatic and natural false eyelashes",
        },
      ],
    },
    {
      name: "Face",
      description: "Complete face makeup collection",
      isActive: true,
      subcategories: [
        {
          name: "Foundation",
          description: "Flawless coverage for all skin types",
        },
        { name: "Concealer", description: "Hide imperfections and brighten" },
        { name: "Setting Powder", description: "Lock in your makeup all day" },
        { name: "Blush", description: "Add a natural flush to your cheeks" },
        {
          name: "Highlighter",
          description: "Glow and shine with illuminating products",
        },
        {
          name: "Contour & Bronzer",
          description: "Sculpt and define your features",
        },
        {
          name: "Face Primer",
          description: "Smooth canvas for makeup application",
        },
        {
          name: "Setting Spray",
          description: "Keep your makeup fresh all day",
        },
      ],
    },
    {
      name: "Lips",
      description: "Lip products for every style",
      isActive: true,
      subcategories: [
        {
          name: "Lipstick",
          description: "Classic lip color in various finishes",
        },
        {
          name: "Lip Gloss",
          description: "Shiny and moisturizing lip products",
        },
        { name: "Lip Oil", description: "Nourishing tinted lip oils" },
        { name: "Lip Liner", description: "Define and shape your lips" },
        { name: "Lip Plumper", description: "Fuller-looking lips instantly" },
        { name: "Lip Care", description: "Lip balms and treatments" },
      ],
    },
    {
      name: "Skincare",
      description: "Nourish and care for your skin",
      isActive: true,
      subcategories: [
        { name: "Cleansers", description: "Remove makeup and impurities" },
        { name: "Toners", description: "Balance and refresh your skin" },
        { name: "Moisturizers", description: "Hydrate and protect your skin" },
        { name: "Serums", description: "Targeted skin treatments" },
        { name: "Face Masks", description: "Deep treatment and pampering" },
        { name: "Makeup Remover", description: "Gentle makeup removal" },
      ],
    },
    {
      name: "Body",
      description: "Body care and beauty products",
      isActive: true,
      subcategories: [
        { name: "Body Lotion", description: "Moisturize and soften skin" },
        { name: "Body Scrub", description: "Exfoliate for smooth skin" },
        { name: "Body Glow", description: "Shimmer and illuminate your body" },
        { name: "Body Mist", description: "Light and refreshing fragrances" },
      ],
    },
    {
      name: "Tools & Accessories",
      description: "Essential beauty tools and accessories",
      isActive: true,
      subcategories: [
        {
          name: "Makeup Brushes",
          description: "Professional brush sets and individual brushes",
        },
        { name: "Beauty Sponges", description: "Blend your makeup flawlessly" },
        { name: "Mirrors", description: "Compact and vanity mirrors" },
        { name: "Makeup Bags", description: "Organize your beauty essentials" },
        { name: "Hair Tools", description: "Styling tools for perfect hair" },
      ],
    },
    {
      name: "Collections",
      description: "Special edition and themed collections",
      isActive: true,
      subcategories: [
        {
          name: "Limited Edition",
          description: "Exclusive limited-time collections",
        },
        { name: "Holiday Sets", description: "Festive makeup sets and gifts" },
        {
          name: "Bundles",
          description: "Complete makeup bundles at great value",
        },
        { name: "Best Sellers", description: "Our most popular products" },
      ],
    },
  ];

  // Create categories and subcategories (using upsert to avoid duplicates)
  const categoryMap = new Map<string, string>();

  for (const categoryData of categoriesData) {
    const { subcategories, ...mainCategoryData } = categoryData;
    const slug = mainCategoryData.name.toLowerCase().replace(/\s+/g, "-");

    // Check if main category exists, if not create it
    let mainCategory = await prisma.category.findUnique({
      where: { slug },
    });

    if (!mainCategory) {
      mainCategory = await prisma.category.create({
        data: {
          ...mainCategoryData,
          slug,
        },
      });
      console.log(`✅ Created category: ${mainCategory.name}`);
    } else {
      console.log(`ℹ️  Category already exists: ${mainCategory.name}`);
    }

    categoryMap.set(mainCategory.name, mainCategory.id);

    // Create subcategories
    for (const subCat of subcategories) {
      const subSlug = subCat.name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/&/g, "and");

      // Check if subcategory exists
      let subCategory = await prisma.category.findUnique({
        where: { slug: subSlug },
      });

      if (!subCategory) {
        subCategory = await prisma.category.create({
          data: {
            name: subCat.name,
            description: subCat.description,
            slug: subSlug,
            parentId: mainCategory.id,
            isActive: true,
          },
        });
        console.log(`  ✅ Created subcategory: ${subCat.name}`);
      } else {
        console.log(`  ℹ️  Subcategory already exists: ${subCat.name}`);
      }

      categoryMap.set(`${mainCategory.name}:${subCat.name}`, subCategory.id);
    }
  }

  // Sample products based on Beauty Creations categories
  const productsData = [
    // Eyeshadow Palettes - Single variant (palettes don't have color variations)
    {
      name: "Nude X Eyeshadow Palette",
      description: "12 highly pigmented nude shades perfect for everyday looks",
      sku: "ESL-EYE-001",
      barcode: "850016654321",
      price: 18.99,
      costPrice: 8.5,
      isActive: true,
      categoryKey: "Eyes:Eyeshadow Palettes",
      variants: [
        {
          name: "Standard",
          sku: "ESL-EYE-001-STD",
          price: 18.99,
          costPrice: 8.5,
        },
      ],
    },
    {
      name: "Pastel Dreams Palette",
      description: "18 soft pastel shades for dreamy eye looks",
      sku: "ESL-EYE-002",
      barcode: "850016654322",
      price: 22.99,
      costPrice: 10.0,
      isActive: true,
      categoryKey: "Eyes:Eyeshadow Palettes",
      variants: [
        {
          name: "Standard",
          sku: "ESL-EYE-002-STD",
          price: 22.99,
          costPrice: 10.0,
        },
      ],
    },
    {
      name: "Glitter Galaxy Palette",
      description: "15 sparkly shades with maximum shine",
      sku: "ESL-EYE-003",
      barcode: "850016654323",
      price: 24.99,
      costPrice: 11.0,
      isActive: true,
      categoryKey: "Eyes:Eyeshadow Palettes",
      variants: [
        {
          name: "Standard",
          sku: "ESL-EYE-003-STD",
          price: 24.99,
          costPrice: 11.0,
        },
      ],
    },

    // Eyeliners - Multiple color variants
    {
      name: "Precision Liquid Eyeliner",
      description: "Ultra-precise felt tip liner for perfect wings",
      sku: "ESL-EYE-101",
      barcode: "850016654401",
      price: 8.99,
      costPrice: 3.5,
      isActive: true,
      categoryKey: "Eyes:Eyeliner",
      variants: [
        { name: "Black", sku: "ESL-EYE-101-BLK", price: 8.99, costPrice: 3.5 },
        { name: "Brown", sku: "ESL-EYE-101-BRN", price: 8.99, costPrice: 3.5 },
        { name: "Navy", sku: "ESL-EYE-101-NVY", price: 8.99, costPrice: 3.5 },
      ],
    },
    {
      name: "Gel Pencil Eyeliner",
      description: "Smooth, smudge-proof gel pencil liner",
      sku: "ESL-EYE-102",
      barcode: "850016654402",
      price: 7.99,
      costPrice: 3.0,
      isActive: true,
      categoryKey: "Eyes:Eyeliner",
      variants: [
        {
          name: "Espresso",
          sku: "ESL-EYE-102-ESP",
          price: 7.99,
          costPrice: 3.0,
        },
        {
          name: "Midnight Black",
          sku: "ESL-EYE-102-BLK",
          price: 7.99,
          costPrice: 3.0,
        },
        {
          name: "Deep Plum",
          sku: "ESL-EYE-102-PLM",
          price: 7.99,
          costPrice: 3.0,
        },
      ],
    },

    // Mascaras - Color variants
    {
      name: "Lash Flex Volumizing Mascara",
      description: "Dramatic volume and length without clumping",
      sku: "ESL-EYE-201",
      barcode: "850016654501",
      price: 12.99,
      costPrice: 5.5,
      isActive: true,
      categoryKey: "Eyes:Mascara",
      variants: [
        {
          name: "Blackest Black",
          sku: "ESL-EYE-201-BLK",
          price: 12.99,
          costPrice: 5.5,
        },
        { name: "Brown", sku: "ESL-EYE-201-BRN", price: 12.99, costPrice: 5.5 },
        { name: "Navy", sku: "ESL-EYE-201-NVY", price: 12.99, costPrice: 5.5 },
      ],
    },
    {
      name: "Waterproof Mascara",
      description: "Long-lasting, smudge-proof formula",
      sku: "ESL-EYE-202",
      barcode: "850016654502",
      price: 13.99,
      costPrice: 6.0,
      isActive: true,
      categoryKey: "Eyes:Mascara",
      variants: [
        { name: "Black", sku: "ESL-EYE-202-BLK", price: 13.99, costPrice: 6.0 },
        { name: "Brown", sku: "ESL-EYE-202-BRN", price: 13.99, costPrice: 6.0 },
        { name: "Blue", sku: "ESL-EYE-202-BLU", price: 13.99, costPrice: 6.0 },
      ],
    },

    // Foundations - Based on Flawless Stay shade system (30 shades with undertones)
    {
      name: "Flawless Stay Matte Foundation",
      description:
        "Full coverage, long-lasting matte foundation with 30 shades",
      sku: "ESL-FAC-001",
      barcode: "850016655001",
      price: 14.0,
      costPrice: 6.5,
      isActive: true,
      categoryKey: "Face:Foundation",
      variants: [
        {
          name: "2N (Fair Neutral)",
          sku: "ESL-FAC-001-2N",
          price: 14.0,
          costPrice: 6.5,
        },
        {
          name: "10WG (Medium Warm Golden)",
          sku: "ESL-FAC-001-10WG",
          price: 14.0,
          costPrice: 6.5,
        },
        {
          name: "20C (Deep Cool)",
          sku: "ESL-FAC-001-20C",
          price: 14.0,
          costPrice: 6.5,
        },
      ],
    },
    {
      name: "Flawless Stay Liquid Foundation",
      description: "Lightweight liquid foundation with buildable coverage",
      sku: "ESL-FAC-002",
      barcode: "850016655002",
      price: 12.0,
      costPrice: 5.5,
      isActive: true,
      categoryKey: "Face:Foundation",
      variants: [
        {
          name: "FS1.0 (Fair)",
          sku: "ESL-FAC-002-FS10",
          price: 12.0,
          costPrice: 5.5,
        },
        {
          name: "FS5.0 (Medium)",
          sku: "ESL-FAC-002-FS50",
          price: 12.0,
          costPrice: 5.5,
        },
        {
          name: "FS10.0 (Deep)",
          sku: "ESL-FAC-002-FS100",
          price: 12.0,
          costPrice: 5.5,
        },
      ],
    },
    {
      name: "Pretty Pressed Matte Foundation",
      description: "Pressed powder foundation for natural coverage",
      sku: "ESL-FAC-003",
      barcode: "850016655003",
      price: 12.0,
      costPrice: 5.5,
      isActive: true,
      categoryKey: "Face:Foundation",
      variants: [
        {
          name: "Light Beige",
          sku: "ESL-FAC-003-LBG",
          price: 12.0,
          costPrice: 5.5,
        },
        {
          name: "Medium Tan",
          sku: "ESL-FAC-003-MTN",
          price: 12.0,
          costPrice: 5.5,
        },
        {
          name: "Deep Mocha",
          sku: "ESL-FAC-003-DMC",
          price: 12.0,
          costPrice: 5.5,
        },
      ],
    },

    // Concealers - Based on Flawless Stay Concealer system
    {
      name: "Flawless Stay Concealer",
      description: "Full coverage concealer for dark circles and blemishes",
      sku: "ESL-FAC-101",
      barcode: "850016655101",
      price: 7.0,
      costPrice: 3.5,
      isActive: true,
      categoryKey: "Face:Concealer",
      variants: [
        {
          name: "FSC1 (Fair)",
          sku: "ESL-FAC-101-FSC1",
          price: 7.0,
          costPrice: 3.5,
        },
        {
          name: "FSC6 (Medium)",
          sku: "ESL-FAC-101-FSC6",
          price: 7.0,
          costPrice: 3.5,
        },
        {
          name: "FSC11 (Deep)",
          sku: "ESL-FAC-101-FSC11",
          price: 7.0,
          costPrice: 3.5,
        },
      ],
    },
    {
      name: "Color Correcting Concealer",
      description: "Correct and brighten with targeted color correction",
      sku: "ESL-FAC-102",
      barcode: "850016655102",
      price: 8.99,
      costPrice: 4.0,
      isActive: true,
      categoryKey: "Face:Concealer",
      variants: [
        {
          name: "Green (Redness)",
          sku: "ESL-FAC-102-GRN",
          price: 8.99,
          costPrice: 4.0,
        },
        {
          name: "Peach (Dark Circles)",
          sku: "ESL-FAC-102-PCH",
          price: 8.99,
          costPrice: 4.0,
        },
        {
          name: "Lavender (Sallowness)",
          sku: "ESL-FAC-102-LAV",
          price: 8.99,
          costPrice: 4.0,
        },
      ],
    },

    // Blushes - Based on Stay Blushing Cute collection
    {
      name: "Stay Blushing Cute Lip and Cheek Balm",
      description: "Buildable cream blush for lips and cheeks",
      sku: "ESL-FAC-201",
      barcode: "850016655201",
      price: 7.0,
      costPrice: 3.5,
      isActive: true,
      categoryKey: "Face:Blush",
      variants: [
        {
          name: "As Usual (Soft Pink)",
          sku: "ESL-FAC-201-ASU",
          price: 7.0,
          costPrice: 3.5,
        },
        {
          name: "Born To Make It (Mauve)",
          sku: "ESL-FAC-201-BTM",
          price: 7.0,
          costPrice: 3.5,
        },
        {
          name: "Neverending (Coral)",
          sku: "ESL-FAC-201-NVE",
          price: 7.0,
          costPrice: 3.5,
        },
      ],
    },
    {
      name: "Liquid Blush",
      description: "Lightweight liquid blush for natural flush",
      sku: "ESL-FAC-202",
      barcode: "850016655202",
      price: 8.99,
      costPrice: 4.0,
      isActive: true,
      categoryKey: "Face:Blush",
      variants: [
        {
          name: "Pink Glow",
          sku: "ESL-FAC-202-PNG",
          price: 8.99,
          costPrice: 4.0,
        },
        {
          name: "Peachy Keen",
          sku: "ESL-FAC-202-PCK",
          price: 8.99,
          costPrice: 4.0,
        },
        {
          name: "Berry Blush",
          sku: "ESL-FAC-202-BRY",
          price: 8.99,
          costPrice: 4.0,
        },
      ],
    },

    // Highlighters - Multiple shade options
    {
      name: "Glow Getter Powder Highlighter",
      description: "Ultra-pigmented highlighter for radiant glow",
      sku: "ESL-FAC-301",
      barcode: "850016655301",
      price: 10.99,
      costPrice: 5.0,
      isActive: true,
      categoryKey: "Face:Highlighter",
      variants: [
        {
          name: "Champagne Glow",
          sku: "ESL-FAC-301-CHP",
          price: 10.99,
          costPrice: 5.0,
        },
        {
          name: "Rose Gold",
          sku: "ESL-FAC-301-RSG",
          price: 10.99,
          costPrice: 5.0,
        },
        {
          name: "Golden Hour",
          sku: "ESL-FAC-301-GLD",
          price: 10.99,
          costPrice: 5.0,
        },
      ],
    },
    {
      name: "Liquid Glow Highlighter",
      description: "Liquid highlighter for dewy, luminous skin",
      sku: "ESL-FAC-302",
      barcode: "850016655302",
      price: 11.99,
      costPrice: 5.5,
      isActive: true,
      categoryKey: "Face:Highlighter",
      variants: [
        { name: "Pearl", sku: "ESL-FAC-302-PRL", price: 11.99, costPrice: 5.5 },
        {
          name: "Bronze",
          sku: "ESL-FAC-302-BRZ",
          price: 11.99,
          costPrice: 5.5,
        },
        {
          name: "Pink Shimmer",
          sku: "ESL-FAC-302-PNK",
          price: 11.99,
          costPrice: 5.5,
        },
      ],
    },

    // Lipsticks - Multiple shades
    {
      name: "Velvet Matte Lipstick",
      description: "Long-lasting matte lipstick with rich color",
      sku: "ESL-LIP-001",
      barcode: "850016656001",
      price: 9.99,
      costPrice: 4.0,
      isActive: true,
      categoryKey: "Lips:Lipstick",
      variants: [
        {
          name: "Berry Kiss",
          sku: "ESL-LIP-001-BER",
          price: 9.99,
          costPrice: 4.0,
        },
        {
          name: "Nude Rose",
          sku: "ESL-LIP-001-NUD",
          price: 9.99,
          costPrice: 4.0,
        },
        {
          name: "Red Velvet",
          sku: "ESL-LIP-001-RED",
          price: 9.99,
          costPrice: 4.0,
        },
      ],
    },
    {
      name: "Satin Lipstick",
      description: "Smooth satin finish with vibrant color",
      sku: "ESL-LIP-002",
      barcode: "850016656002",
      price: 10.99,
      costPrice: 4.5,
      isActive: true,
      categoryKey: "Lips:Lipstick",
      variants: [
        {
          name: "Cherry Pop",
          sku: "ESL-LIP-002-CHR",
          price: 10.99,
          costPrice: 4.5,
        },
        {
          name: "Plum Perfect",
          sku: "ESL-LIP-002-PLM",
          price: 10.99,
          costPrice: 4.5,
        },
        {
          name: "Pink Passion",
          sku: "ESL-LIP-002-PNK",
          price: 10.99,
          costPrice: 4.5,
        },
      ],
    },

    // Lip Glosses - Multiple shades
    {
      name: "Ultra Shine Lip Gloss",
      description: "High-shine gloss with moisturizing formula",
      sku: "ESL-LIP-101",
      barcode: "850016656101",
      price: 8.99,
      costPrice: 3.5,
      isActive: true,
      categoryKey: "Lips:Lip Gloss",
      variants: [
        {
          name: "Pink Shimmer",
          sku: "ESL-LIP-101-PNK",
          price: 8.99,
          costPrice: 3.5,
        },
        {
          name: "Nude Glow",
          sku: "ESL-LIP-101-NUD",
          price: 8.99,
          costPrice: 3.5,
        },
        {
          name: "Clear Shine",
          sku: "ESL-LIP-101-CLR",
          price: 8.99,
          costPrice: 3.5,
        },
      ],
    },
    {
      name: "Plumping Lip Gloss",
      description: "Volumizing gloss with tingling sensation",
      sku: "ESL-LIP-102",
      barcode: "850016656102",
      price: 11.99,
      costPrice: 5.0,
      isActive: true,
      categoryKey: "Lips:Lip Gloss",
      variants: [
        { name: "Clear", sku: "ESL-LIP-102-CLR", price: 11.99, costPrice: 5.0 },
        {
          name: "Rose Quartz",
          sku: "ESL-LIP-102-RSQ",
          price: 11.99,
          costPrice: 5.0,
        },
        {
          name: "Berry Boost",
          sku: "ESL-LIP-102-BER",
          price: 11.99,
          costPrice: 5.0,
        },
      ],
    },

    // Lip Oils - Multiple tints
    {
      name: "Tinted Lip Oil",
      description: "Nourishing lip oil with sheer tint",
      sku: "ESL-LIP-201",
      barcode: "850016656201",
      price: 12.99,
      costPrice: 5.5,
      isActive: true,
      categoryKey: "Lips:Lip Oil",
      variants: [
        {
          name: "Raspberry",
          sku: "ESL-LIP-201-RAS",
          price: 12.99,
          costPrice: 5.5,
        },
        {
          name: "Cherry Blossom",
          sku: "ESL-LIP-201-CHR",
          price: 12.99,
          costPrice: 5.5,
        },
        {
          name: "Peach Nectar",
          sku: "ESL-LIP-201-PCH",
          price: 12.99,
          costPrice: 5.5,
        },
      ],
    },

    // Lip Liners - Multiple shades
    {
      name: "Wooden Lip Liner",
      description: "Creamy, long-lasting lip liner",
      sku: "ESL-LIP-301",
      barcode: "850016656301",
      price: 6.99,
      costPrice: 2.5,
      isActive: true,
      categoryKey: "Lips:Lip Liner",
      variants: [
        {
          name: "Natural",
          sku: "ESL-LIP-301-NAT",
          price: 6.99,
          costPrice: 2.5,
        },
        { name: "Mauve", sku: "ESL-LIP-301-MAU", price: 6.99, costPrice: 2.5 },
        { name: "Rose", sku: "ESL-LIP-301-RSE", price: 6.99, costPrice: 2.5 },
      ],
    },

    // Skincare - Single variant (not color-based)
    {
      name: "Gentle Foaming Cleanser",
      description: "pH-balanced cleanser for all skin types",
      sku: "ESL-SKN-001",
      barcode: "850016657001",
      price: 14.99,
      costPrice: 6.5,
      isActive: true,
      categoryKey: "Skincare:Cleansers",
      variants: [
        {
          name: "Standard",
          sku: "ESL-SKN-001-STD",
          price: 14.99,
          costPrice: 6.5,
        },
      ],
    },
    {
      name: "Micellar Water Makeup Remover",
      description: "Gentle, no-rinse makeup remover",
      sku: "ESL-SKN-002",
      barcode: "850016657002",
      price: 12.99,
      costPrice: 5.5,
      isActive: true,
      categoryKey: "Skincare:Makeup Remover",
      variants: [
        {
          name: "Standard",
          sku: "ESL-SKN-002-STD",
          price: 12.99,
          costPrice: 5.5,
        },
      ],
    },
    {
      name: "Hydrating Day Cream SPF 30",
      description: "Lightweight moisturizer with sun protection",
      sku: "ESL-SKN-101",
      barcode: "850016657101",
      price: 18.99,
      costPrice: 8.0,
      isActive: true,
      categoryKey: "Skincare:Moisturizers",
      variants: [
        {
          name: "Standard",
          sku: "ESL-SKN-101-STD",
          price: 18.99,
          costPrice: 8.0,
        },
      ],
    },
    {
      name: "Night Repair Cream",
      description: "Rich, nourishing night cream",
      sku: "ESL-SKN-102",
      barcode: "850016657102",
      price: 22.99,
      costPrice: 10.0,
      isActive: true,
      categoryKey: "Skincare:Moisturizers",
      variants: [
        {
          name: "Standard",
          sku: "ESL-SKN-102-STD",
          price: 22.99,
          costPrice: 10.0,
        },
      ],
    },
    {
      name: "Vitamin C Brightening Serum",
      description: "Antioxidant serum for radiant skin",
      sku: "ESL-SKN-201",
      barcode: "850016657201",
      price: 24.99,
      costPrice: 11.0,
      isActive: true,
      categoryKey: "Skincare:Serums",
      variants: [
        {
          name: "Standard",
          sku: "ESL-SKN-201-STD",
          price: 24.99,
          costPrice: 11.0,
        },
      ],
    },
    {
      name: "Hyaluronic Acid Hydrating Serum",
      description: "Intense hydration for plump skin",
      sku: "ESL-SKN-202",
      barcode: "850016657202",
      price: 26.99,
      costPrice: 12.0,
      isActive: true,
      categoryKey: "Skincare:Serums",
      variants: [
        {
          name: "Standard",
          sku: "ESL-SKN-202-STD",
          price: 26.99,
          costPrice: 12.0,
        },
      ],
    },

    // Body Products - Multiple scents/shades
    {
      name: "Shimmer Body Glow",
      description: "Luminous body shimmer for radiant skin",
      sku: "ESL-BDY-001",
      barcode: "850016658001",
      price: 15.99,
      costPrice: 7.0,
      isActive: true,
      categoryKey: "Body:Body Glow",
      variants: [
        { name: "Gold", sku: "ESL-BDY-001-GLD", price: 15.99, costPrice: 7.0 },
        {
          name: "Rose Gold",
          sku: "ESL-BDY-001-RSG",
          price: 15.99,
          costPrice: 7.0,
        },
        {
          name: "Bronze",
          sku: "ESL-BDY-001-BRZ",
          price: 15.99,
          costPrice: 7.0,
        },
      ],
    },
    {
      name: "Exfoliating Body Scrub",
      description: "Sugar scrub for smooth, soft skin",
      sku: "ESL-BDY-002",
      barcode: "850016658002",
      price: 16.99,
      costPrice: 7.5,
      isActive: true,
      categoryKey: "Body:Body Scrub",
      variants: [
        {
          name: "Coconut",
          sku: "ESL-BDY-002-COC",
          price: 16.99,
          costPrice: 7.5,
        },
        {
          name: "Lavender",
          sku: "ESL-BDY-002-LAV",
          price: 16.99,
          costPrice: 7.5,
        },
        { name: "Rose", sku: "ESL-BDY-002-RSE", price: 16.99, costPrice: 7.5 },
      ],
    },
    {
      name: "Whipped Body Butter",
      description: "Rich, moisturizing body cream",
      sku: "ESL-BDY-003",
      barcode: "850016658003",
      price: 14.99,
      costPrice: 6.5,
      isActive: true,
      categoryKey: "Body:Body Lotion",
      variants: [
        {
          name: "Vanilla",
          sku: "ESL-BDY-003-VAN",
          price: 14.99,
          costPrice: 6.5,
        },
        {
          name: "Shea Butter",
          sku: "ESL-BDY-003-SHE",
          price: 14.99,
          costPrice: 6.5,
        },
        {
          name: "Coconut Milk",
          sku: "ESL-BDY-003-COC",
          price: 14.99,
          costPrice: 6.5,
        },
      ],
    },

    // Tools & Accessories - Single variant (not color-based for tools)
    {
      name: "Pro Makeup Brush Set - 12 Pieces",
      description: "Professional quality brush set for all makeup needs",
      sku: "ESL-TLS-001",
      barcode: "850016659001",
      price: 34.99,
      costPrice: 15.0,
      isActive: true,
      categoryKey: "Tools & Accessories:Makeup Brushes",
      variants: [
        {
          name: "Standard",
          sku: "ESL-TLS-001-STD",
          price: 34.99,
          costPrice: 15.0,
        },
      ],
    },
    {
      name: "Beauty Blender Sponge Set - 3 Pack",
      description: "Latex-free makeup sponges for flawless blending",
      sku: "ESL-TLS-002",
      barcode: "850016659002",
      price: 18.99,
      costPrice: 8.0,
      isActive: true,
      categoryKey: "Tools & Accessories:Beauty Sponges",
      variants: [
        { name: "Pink", sku: "ESL-TLS-002-PNK", price: 18.99, costPrice: 8.0 },
        { name: "Black", sku: "ESL-TLS-002-BLK", price: 18.99, costPrice: 8.0 },
        { name: "Nude", sku: "ESL-TLS-002-NUD", price: 18.99, costPrice: 8.0 },
      ],
    },
    {
      name: "LED Vanity Mirror",
      description: "Adjustable LED mirror with 3 light settings",
      sku: "ESL-TLS-003",
      barcode: "850016659003",
      price: 29.99,
      costPrice: 13.0,
      isActive: true,
      categoryKey: "Tools & Accessories:Mirrors",
      variants: [
        {
          name: "Standard",
          sku: "ESL-TLS-003-STD",
          price: 29.99,
          costPrice: 13.0,
        },
      ],
    },
    {
      name: "Makeup Organizer Bag",
      description: "Spacious travel-friendly makeup bag",
      sku: "ESL-TLS-004",
      barcode: "850016659004",
      price: 12.99,
      costPrice: 5.5,
      isActive: true,
      categoryKey: "Tools & Accessories:Makeup Bags",
      variants: [
        { name: "Pink", sku: "ESL-TLS-004-PNK", price: 12.99, costPrice: 5.5 },
        { name: "Black", sku: "ESL-TLS-004-BLK", price: 12.99, costPrice: 5.5 },
        {
          name: "Rose Gold",
          sku: "ESL-TLS-004-RSG",
          price: 12.99,
          costPrice: 5.5,
        },
      ],
    },
  ];

  const defaultPriceType = await prisma.priceType.findFirst({
    where: { priority: 1, isDeleted: false },
    select: { id: true },
  });

  if (!defaultPriceType) {
    throw new Error(
      "❌ No se encontró ningún PriceType con prioridad 1. ¡Asegúrate de ejecutar el PriceType seeder primero!"
    );
  }

  const DEFAULT_PRICE_TYPE_ID = defaultPriceType.id;

  // Create products with variants (skip if SKU already exists)
  for (const productData of productsData) {
    const {
      price: _price,
      costPrice: _costPrice,
      categoryKey,
      variants,
      ...baseProductData
    } = productData;

    // Check if product already exists by SKU
    let product = await prisma.product.findUnique({
      where: { sku: baseProductData.sku },
    });

    if (!product) {
      product = await prisma.product.create({
        data: {
          ...baseProductData,
          categoryId: categoryMap.get(categoryKey),
          brandId: beautyCreationsBrand.id,
        },
      });
      console.log(`✅ Created product: ${product.name} (${product.sku})`);
    } else {
      console.log(
        `ℹ️  Product already exists: ${product.name} (${product.sku})`
      );
    }

    // Create variants for each product (skip if SKU already exists for this product)
    for (const [index, variantData] of variants.entries()) {
      const existingVariant = await prisma.productVariant.findFirst({
        where: {
          sku: variantData.sku,
          productId: product.id,
          isDeleted: false,
        },
      });

      if (!existingVariant) {
        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: variantData.sku,
            barcode: product.barcode
              ? `${product.barcode}-${index + 1}`
              : undefined,
            name: variantData.name,
            prices: {
              create: [
                {
                  priceTypeId: DEFAULT_PRICE_TYPE_ID,
                  price: variantData.price,
                  minQuantity: 1,
                },
              ],
            },
            costPrice: variantData.costPrice,
            isActive: true,
          },
        });
        console.log(`  ✅ Created variant: ${variant.name} (${variant.sku})`);
      } else {
        console.log(
          `  ℹ️  Variant already exists: ${variantData.name} (${variantData.sku})`
        );
      }
    }
  }

  console.log("✨ Categories and products seeded successfully!");
}

// Run the seed if executed directly
if (require.main === module) {
  seedCategoriesAndProducts()
    .catch(e => {
      console.error("❌ Error seeding categories and products:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

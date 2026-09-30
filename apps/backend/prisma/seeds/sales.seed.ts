import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedSalesOptions = {
  // Base entities
  customersCount?: number; // NEW: cuántos clientes crear
  ordersPerCustomer?: number; // NEW: cuántas órdenes por cliente

  // Purchase Orders
  purchaseOrders?: number;
  minItemsPerPO?: number;
  maxItemsPerPO?: number;
  minQty?: number;
  maxQty?: number;

  // Sales Orders
  minItemsPerSale?: number;
  maxItemsPerSale?: number;
  minSaleQty?: number;
  maxSaleQty?: number;
  applyDiscountEvery?: number; // aplica descuento en cada N-ésima orden de CADA cliente
};

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Date helpers
function randomDateWithinPastDays(maxDaysBack: number, minDaysBack = 0) {
  // Returns a date between now - maxDaysBack and now - minDaysBack (in days)
  const now = new Date();
  const min = now.getTime() - maxDaysBack * 24 * 60 * 60 * 1000;
  const max = now.getTime() - minDaysBack * 24 * 60 * 60 * 1000;
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Date(t);
}

function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

// Ensure there is an employee on the branch to attribute orders
async function ensureEmployee(branchId: string) {
  // Get or create a location for the branch
  let location = await prisma.location.findFirst({
    where: { branchId, isDeleted: false },
  });
  if (!location) {
    location = await prisma.location.create({
      data: {
        branchId,
        name: "Sala de Ventas",
        locationType: "STORE",
      },
    });
  }

  let employee = await prisma.employee.findFirst({
    where: { locationId: location.id },
    include: { user: true },
  });

  if (employee) return employee;

  // Find admin user (created by main seed) or fallback to any user
  const adminUser =
    (await prisma.user.findUnique({
      where: { email: "admin@eslicosmetics.com" },
    })) || (await prisma.user.findFirst());

  // Find or create a person for the user
  let person = await prisma.person.findFirst({
    where: { email: adminUser?.email || undefined },
  });
  if (!person) {
    person = await prisma.person.create({
      data: {
        firstName: "System",
        lastName: "User",
        email: adminUser?.email ?? `system+${Date.now()}@eslicosmetics.com`,
      },
    });
  }

  employee = await prisma.employee.create({
    data: {
      personId: person.id,
      userId: adminUser?.id,
      locationId: location.id,
      employeeCode: `EMP-${Date.now()}`,
      roleTitle: "Sales Rep",
      isActive: true,
    },
    include: { user: true },
  });

  return employee;
}

// Ensure a discount code exists
async function ensureDiscountCode() {
  const codeKey = "ESLI10OFF";
  let discount = await prisma.discountCode.findUnique({
    where: { code: codeKey },
  });

  if (!discount) {
    // Optional: set a validity window around "now"
    const now = new Date();
    const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // -90 days
    const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000); // +90 days

    discount = await prisma.discountCode.create({
      data: {
        code: codeKey,
        name: "10% OFF",
        discountType: "PERCENTAGE",
        value: 10,
        isActive: true,
        startDate: start,
        endDate: end,
      },
    });
  }

  return discount;
}

function buildCustomerFixtures(count: number) {
  const firstNames = [
    "María",
    "Juan",
    "Luis",
    "Ana",
    "Sofía",
    "Pedro",
    "Elena",
    "Carlos",
    "Lucía",
    "Andrés",
  ];
  const lastNames = [
    "García",
    "Martínez",
    "López",
    "Hernández",
    "Pérez",
    "Gómez",
    "Díaz",
    "Ruiz",
    "Vargas",
    "Castro",
  ];
  const fixtures = Array.from({ length: count }).map((_, i) => {
    const fn = pickRandom(firstNames);
    const ln = pickRandom(lastNames);
    const slug = `${fn.toLowerCase()}.${ln.toLowerCase()}.${i + 1}`;
    return {
      firstName: fn,
      lastName: ln,
      email: `${slug}@example.com`,
      phone: `+5037${randomInt(1000000, 9999999)}`,
      docType: "DUI",
      docNumber: `${randomInt(10000000, 99999999)}-${randomInt(0, 9)}`,
    };
  });
  return fixtures;
}

async function createCustomers(count: number) {
  const fixtures = buildCustomerFixtures(count);
  const customers = [];
  for (const fx of fixtures) {
    const person = await prisma.person.create({
      data: {
        firstName: fx.firstName,
        lastName: fx.lastName,
        email: fx.email,
        phone: fx.phone,
        docType: fx.docType,
        docNumber: fx.docNumber,
      },
    });
    const customer = await prisma.customer.create({
      data: {
        personId: person.id,
        isDeleted: false,
      },
      include: {
        person: true,
      },
    });
    customers.push(customer);
  }
  return customers;
}

export async function seedSalesData(options: SeedSalesOptions = {}) {
  const {
    // NEW: clientes y órdenes por cliente
    customersCount = 5,
    ordersPerCustomer = 5,

    // Purchase Orders
    purchaseOrders = 10,
    minItemsPerPO = 1,
    maxItemsPerPO = 3,
    minQty = 10,
    maxQty = 100,

    // Sales Orders
    minItemsPerSale = 1,
    maxItemsPerSale = 3,
    minSaleQty = 1,
    maxSaleQty = 4,
    applyDiscountEvery = 2,
  } = options;

  console.log("📈 Seeding sales data (Purchases and Orders)...");

  // Base data
  const [
    productVariants,
    suppliers,
    branchInit,
    warehouseLocationInit,
    storeLocationInit,
    taxRateInit,
  ] = await Promise.all([
    prisma.productVariant.findMany({
      include: { prices: true, product: true },
      take: 200,
    }),
    prisma.supplier.findMany(),
    prisma.branch.findFirst({ where: { code: "CA" } }),
    prisma.location.findFirst({ where: { locationType: "WAREHOUSE" } }),
    prisma.location.findFirst({ where: { locationType: "STORE" } }),
    prisma.taxRate.findFirst({ where: { code: "IVA15" } }),
  ]);

  const branch = branchInit ?? (await prisma.branch.findFirst());
  const warehouseLocation =
    warehouseLocationInit ?? (await prisma.location.findFirst());
  const storeLocation =
    storeLocationInit ?? (await prisma.location.findFirst());
  const taxRate = taxRateInit ?? (await prisma.taxRate.findFirst());

  if (
    !productVariants.length ||
    !suppliers.length ||
    !branch ||
    !warehouseLocation ||
    !storeLocation
  ) {
    console.error(
      "❌ Missing base data: {variants, suppliers, branch, warehouse, store}."
    );
    return;
  }

  const employee = await ensureEmployee(branch.id);
  const createdByUserId = employee.userId ?? undefined;

  // Helper: create a Purchase Order with items and update warehouse stock
  async function createPurchaseOrderWithItems() {
    const itemsCount = randomInt(minItemsPerPO, maxItemsPerPO);

    const usedVariantIds = new Set<string>();
    const items = Array.from({ length: itemsCount }).map(() => {
      let variant = pickRandom(productVariants);
      let guard = 0;
      while (usedVariantIds.has(variant.id) && guard < 10) {
        variant = pickRandom(productVariants);
        guard++;
      }
      usedVariantIds.add(variant.id);

      const quantity = randomInt(minQty, maxQty);
      const unitCostNum = variant.costPrice.toNumber();
      const lineTotalNum = unitCostNum * quantity;

      return {
        productVariantId: variant.id,
        productId: variant.productId,
        quantity,
        unitCost: unitCostNum,
        lineTotal: lineTotalNum,
      };
    });

    const supplier = pickRandom(suppliers);
    const totalAmount = items.reduce((acc, it) => acc + it.lineTotal, 0);

    // PO date between 30–60 days ago (older than sales)
    const poDate = randomDateWithinPastDays(60, 30);
    const expectedDate = addMinutes(poDate, 60 * 24 * 7); // +7 days

    const created = await prisma.$transaction(async tx => {
      const po = await tx.purchaseOrder.create({
        data: {
          supplierId: supplier.id,
          branchId: branch!.id,
          status: "COMPLETED",
          total: totalAmount,
          createdBy: createdByUserId,
          createdAt: poDate, // date the PO was created
          expectedDate, // optional delivery expectation
          purchaseOrderItems: {
            create: items.map(
              ({ productVariantId, quantity, unitCost, lineTotal }) => ({
                productVariantId,
                quantity,
                unitCost,
                lineTotal,
              })
            ),
          },
        },
        include: { purchaseOrderItems: true },
      });

      // Update warehouse stock with the same date as PO
      for (const it of items) {
        await tx.stockLevel.upsert({
          where: {
            // unique composite named in schema: uk_stock_level_product_location
            uk_stock_level_product_location: {
              productId: it.productId,
              productVariantId: it.productVariantId,
              locationId: warehouseLocation!.id,
            },
          },
          update: { quantity: { increment: it.quantity }, updatedAt: poDate },
          create: {
            productId: it.productId,
            productVariantId: it.productVariantId,
            locationId: warehouseLocation!.id,
            quantity: it.quantity,
            updatedAt: poDate,
          },
        });
      }

      return po;
    });

    return created;
  }

  // Create N PurchaseOrders
  const poResults = [];
  for (let i = 0; i < purchaseOrders; i++) {
    const po = await createPurchaseOrderWithItems();
    poResults.push(po);
    console.log(`✓ PurchaseOrder ${i + 1}/${purchaseOrders} created: ${po.id}`);
  }
  console.log(`🎯 Total PurchaseOrders: ${poResults.length}`);

  // Crear 5 clientes (por defecto)
  const customers = await createCustomers(customersCount);
  console.log(`👥 Customers created: ${customers.length}`);

  // Asegurar código de descuento
  const globalDiscount = await ensureDiscountCode();

  // Helper: create 1 Order with employeeId, payment and optional discount FOR A SPECIFIC CUSTOMER
  async function createSaleOrderForCustomer(
    customerId: string,
    indexWithinCustomer: number
  ) {
    const itemsCount = randomInt(minItemsPerSale, maxItemsPerSale);

    const usedVariantIds = new Set<string>();
    const items = Array.from({ length: itemsCount }).map(() => {
      let variant = pickRandom(productVariants);
      let guard = 0;
      while (usedVariantIds.has(variant.id) && guard < 10) {
        variant = pickRandom(productVariants);
        guard++;
      }
      usedVariantIds.add(variant.id);

      const qty = randomInt(minSaleQty, maxSaleQty);
      // Use a sale price if available; otherwise 1.5x cost
      const priceRow = variant.prices.find(p => p.price.toNumber() > 0);
      const unitPriceNum =
        priceRow?.price.toNumber() ?? variant.costPrice.toNumber() * 1.5;
      const lineTotal = unitPriceNum * qty;

      return {
        variantId: variant.id,
        productId: variant.productId,
        quantity: qty,
        unitPrice: unitPriceNum,
        lineTotal,
        productName: variant.product?.name ?? "",
      };
    });

    const subtotal = items.reduce((acc, it) => acc + it.lineTotal, 0);

    // Sales date within the last 30 days
    const orderDate = randomDateWithinPastDays(30, 0);

    const shouldApplyDiscount =
      applyDiscountEvery > 0 && indexWithinCustomer % applyDiscountEvery === 0;

    let discountAmount = 0;
    let discountCodeId: string | undefined;

    if (shouldApplyDiscount) {
      discountCodeId = globalDiscount.id;

      // Asignar el code al cliente ANTES de la orden (o actualizarlo)
      const assignedAt = addMinutes(orderDate, -60); // 1 hour earlier
      await prisma.customerDiscountCode.upsert({
        where: {
          customerId_discountCodeId: {
            customerId,
            discountCodeId: globalDiscount.id,
          },
        },
        update: {
          assignedAt,
          isRedeemed: false,
          redeemedAt: null,
        },
        create: {
          customerId,
          discountCodeId: globalDiscount.id,
          assignedAt,
          isRedeemed: false,
        },
      });

      // 10% off the subtotal
      discountAmount = subtotal * 0.1;
    }

    // Taxes (based on IVA15 if present; fallback 0 if not found)
    const taxRateValue = taxRate?.rate ? Number(taxRate.rate.toString()) : 0;
    const taxes = subtotal * (taxRateValue / 100);
    const totalAmount = subtotal - discountAmount + taxes;

    // Build order create payload using relation connects
    const orderPayload: any = {
      orderNumber: `ORD-${orderDate.getFullYear()}${String(
        orderDate.getMonth() + 1
      ).padStart(
        2,
        "0"
      )}${String(orderDate.getDate()).padStart(2, "0")}-${Math.floor(
        Math.random() * 100000
      )}`,
      // connect relations instead of scalar FK fields
      customer: { connect: { id: customerId } },
      branch: { connect: { id: branch!.id } },
      location: { connect: { id: storeLocation!.id } },
      // use the employee created for the branch as the seller
      seller: { connect: { id: employee.id } },
      status: "COMPLETED",
      subtotal,
      taxes,
      discountAmount: discountAmount || undefined,
      totalAmount,
      createdAt: orderDate,
      orderItems: {
        create: items.map(it => ({
          productVariantId: it.variantId,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountAmount: 0,
          taxAmount: subtotal ? (taxes * it.lineTotal) / subtotal : 0,
          lineTotal: it.lineTotal,
        })),
      },
    };

    // Attach discount code relation only if present
    if (discountCodeId) {
      orderPayload.discountCode = { connect: { id: discountCodeId } };
    }

    const order = await prisma.order.create({
      data: orderPayload,
      include: { orderItems: true },
    });

    // Create a payment (paid at +5 minutes from order date)
    await prisma.payment.create({
      data: {
        orderId: order.id,
        paymentType: "CASH",
        provider: "CASH",
        amount: totalAmount,
        createdBy: createdByUserId,
        paidAt: addMinutes(orderDate, 5),
      },
    });

    // Reduce store stock according to order items and timestamp the update
    for (const it of items) {
      await prisma.stockLevel.upsert({
        where: {
          uk_stock_level_product_location: {
            productId: it.productId,
            productVariantId: it.variantId,
            locationId: storeLocation!.id,
          },
        },
        update: {
          quantity: { decrement: it.quantity },
          updatedAt: orderDate,
        },
        create: {
          productId: it.productId,
          productVariantId: it.variantId,
          locationId: storeLocation!.id,
          quantity: 0, // empieza en 0 si no existía (puede quedar negativo)
          updatedAt: orderDate,
        },
      });
    }

    // If a discount was applied, mark it as redeemed at the order date
    if (discountCodeId) {
      await prisma.customerDiscountCode.update({
        where: {
          customerId_discountCodeId: {
            customerId,
            discountCodeId,
          },
        },
        data: {
          isRedeemed: true,
          redeemedAt: orderDate,
        },
      });
    }

    return order;
  }

  // Crear órdenes por cada cliente
  const allSales = [];
  for (const [idx, c] of customers.entries()) {
    console.log(
      `🧾 Creating orders for customer ${idx + 1}/${customers.length} (${c.person.firstName} ${c.person.lastName})`
    );
    for (let i = 1; i <= ordersPerCustomer; i++) {
      const sale = await createSaleOrderForCustomer(c.id, i);
      allSales.push(sale);
      console.log(`  ✓ Order ${i}/${ordersPerCustomer} → ${sale.orderNumber}`);
    }
  }

  console.log(`🧾 Total Orders created: ${allSales.length}`);
  console.log("✅ Seeding purchases and sales finished.");
}

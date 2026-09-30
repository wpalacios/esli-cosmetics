import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Utilities
function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomDateWithinPastDays(maxDaysBack: number, minDaysBack = 0) {
  const now = new Date();
  const min = now.getTime() - maxDaysBack * 24 * 60 * 60 * 1000;
  const max = now.getTime() - minDaysBack * 24 * 60 * 60 * 1000;
  const t = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Date(t);
}
function addMinutes(base: Date, minutes: number) {
  return new Date(base.getTime() + minutes * 60 * 1000);
}

async function ensureDiscountCode() {
  const codeKey = "ESLI10OFF";
  let discount = await prisma.discountCode.findUnique({
    where: { code: codeKey },
  });
  if (!discount) {
    const now = new Date();
    const start = addMinutes(now, -90 * 24 * 60);
    const end = addMinutes(now, 90 * 24 * 60);
    discount = await prisma.discountCode.create({
      data: {
        code: codeKey,
        name: "10% OFF",
        discountType: "PERCENTAGE",
        value: new Prisma.Decimal(10),
        isActive: true,
        startDate: start,
        endDate: end,
      },
    });
  }
  return discount;
}

const TARGET_BRANCH_CODES = ["MSYA", "LEON", "GRAN", "ESTE", "MZ2"];

async function getTargetBranches() {
  // Try to fetch the 5 by code; if not found, fallback to any 5 branches
  const byCode = await prisma.branch.findMany({
    where: { code: { in: TARGET_BRANCH_CODES } },
    orderBy: { createdAt: "asc" },
  });
  if (byCode.length >= 5) return byCode.slice(0, 5);

  const any = await prisma.branch.findMany({
    take: 5,
    orderBy: { createdAt: "asc" },
  });
  return any;
}

async function ensureStoreLocation(branchId: string) {
  let loc = await prisma.location.findFirst({
    where: { branchId, locationType: "STORE" },
  });
  if (!loc) {
    loc = await prisma.location.create({
      data: {
        branchId,
        name: "Sala de Ventas",
        locationType: "STORE",
        address: null,
        contact: null,
      },
    });
  }
  return loc;
}

const FIRST_NAMES = [
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
  "Miguel",
  "Laura",
  "Javier",
  "Paola",
];
const LAST_NAMES = [
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
  "Mendoza",
  "Ríos",
];

function buildEmployeeFixture(code: string) {
  const firstName = pickRandom(FIRST_NAMES);
  const lastName = pickRandom(LAST_NAMES);
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${Math.floor(Math.random() * 10000)}@example.com`;
  return {
    firstName,
    lastName,
    email,
    employeeCode: `SR-${code}-${Date.now()}-${randomInt(100, 999)}`, // not unique in schema; only for reference
  };
}

async function createEmployeeForBranch(branch: {
  id: string;
  code: string | null;
}) {
  // Get the first location from this branch (employees now relate to locations, not branches)
  const location = await prisma.location.findFirst({
    where: {
      branchId: branch.id,
      isDeleted: false,
    },
  });

  if (!location) {
    throw new Error(`No location found for branch ${branch.code ?? branch.id}`);
  }

  // Respect the current schema: there is no unique constraint on employeeCode
  // Simple idempotency: if a Sales Representative already exists for this location, reuse it
  const existing = await prisma.employee.findFirst({
    where: {
      locationId: location.id,
      roleTitle: "Sales Representative",
      isDeleted: false,
    },
  });
  if (existing) return existing;

  const code = branch.code ?? "BR";
  const fx = buildEmployeeFixture(code);

  const person = await prisma.person.create({
    data: {
      firstName: fx.firstName,
      lastName: fx.lastName,
      email: fx.email,
    },
  });

  const employee = await prisma.employee.create({
    data: {
      personId: person.id,
      userId: null,
      employeeCode: fx.employeeCode, // may repeat across runs; not unique
      roleTitle: "Sales Representative",
      locationId: location.id,
      isActive: true,
      hiredAt: randomDateWithinPastDays(365, 30),
    },
  });

  return employee;
}

async function createCustomersForBranch(branchName: string, count: number) {
  const customers: Array<{ id: string; personId: string }> = [];
  for (let i = 0; i < count; i++) {
    const firstName = pickRandom(FIRST_NAMES);
    const lastName = pickRandom(LAST_NAMES);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${branchName.toLowerCase().replace(/\s+/g, "")}.${randomInt(100, 999)}@example.com`;

    const person = await prisma.person.create({
      data: {
        firstName,
        lastName,
        email,
        phone: `+5037${randomInt(1000000, 9999999)}`,
        docType: "DUI",
        docNumber: `${randomInt(10000000, 99999999)}-${randomInt(0, 9)}`,
      },
    });

    const customer = await prisma.customer.create({
      data: {
        personId: person.id,
        isDeleted: false,
      },
      include: { person: true },
    });

    customers.push({ id: customer.id, personId: person.id });
  }
  return customers;
}

// Exported function to be used by the main seed.ts
export async function seedEmployeesAndOrders() {
  console.log("🚀 Seeding Employees + Orders…");

  // Base data
  const branches = await getTargetBranches();
  if (!branches.length) {
    console.error(
      "❌ No hay branches disponibles. Ejecuta primero el seed de branches."
    );
    return;
  }

  const productVariants = await prisma.productVariant.findMany({
    include: { prices: true, product: true },
    take: 200,
  });
  if (!productVariants.length) {
    console.error(
      "❌ No hay product variants disponibles. Carga productos/variantes primero."
    );
    return;
  }

  const taxRate = await prisma.taxRate.findFirst({ where: { code: "IVA15" } });
  const discount = await ensureDiscountCode();

  // Create 5 employees (one per target branch, or fewer if fewer branches)
  const employees = [];
  for (let i = 0; i < Math.min(5, branches.length); i++) {
    const b = branches[i];
    const emp = await createEmployeeForBranch(b);
    console.log(`👤 Employee creado: ${emp.id} @ branch ${b.code ?? b.id}`);
    employees.push({ emp, branch: b });
  }

  // For each employee: ensure a STORE location, create 2 customers, and generate 3 orders
  for (const { emp, branch } of employees) {
    const storeLoc = await ensureStoreLocation(branch.id);

    const customers = await createCustomersForBranch(branch.name, 2);

    const ordersToCreate = 3;
    for (let oi = 0; oi < ordersToCreate; oi++) {
      const orderDate = randomDateWithinPastDays(30, 0);
      const itemsCount = randomInt(1, 3);

      const usedVariantIds = new Set<string>();
      const items = Array.from({ length: itemsCount }).map(() => {
        let variant = pickRandom(productVariants);
        let guard = 0;
        while (usedVariantIds.has(variant.id) && guard < 10) {
          variant = pickRandom(productVariants);
          guard++;
        }
        usedVariantIds.add(variant.id);

        const qty = randomInt(1, 4);
        const priceRow = variant.prices.find(p => p.price.toNumber() > 0);
        const unitPriceNum =
          priceRow?.price.toNumber() ??
          (variant as any).costPrice?.toNumber?.() ??
          10;
        const lineTotal = unitPriceNum * qty;

        return {
          variantId: variant.id,
          productId: variant.productId,
          quantity: qty,
          unitPrice: unitPriceNum,
          lineTotal,
        };
      });

      const subtotal = items.reduce((acc, it) => acc + it.lineTotal, 0);
      const applyDiscount = Math.random() < 0.5; // ~50% of orders apply a discount
      const discountAmount = applyDiscount ? subtotal * 0.1 : 0;
      const discountCodeId = applyDiscount ? discount.id : undefined;

      const taxRateValue = taxRate?.rate ? Number(taxRate.rate.toString()) : 0;
      const taxes = subtotal * (taxRateValue / 100);
      const totalAmount = subtotal - discountAmount + taxes;

      const customer = pickRandom(customers);

      // If a discount will be applied, ensure it is assigned to the customer beforehand
      if (discountCodeId) {
        await prisma.customerDiscountCode.upsert({
          where: {
            customerId_discountCodeId: {
              customerId: customer.id,
              discountCodeId,
            },
          },
          update: {
            assignedAt: addMinutes(orderDate, -60),
            isRedeemed: false,
            redeemedAt: null,
          },
          create: {
            customerId: customer.id,
            discountCodeId,
            assignedAt: addMinutes(orderDate, -60),
            isRedeemed: false,
          },
        });
      }

      const orderNumber = `ORD-${orderDate.getFullYear()}${String(orderDate.getMonth() + 1).padStart(2, "0")}${String(
        orderDate.getDate()
      ).padStart(2, "0")}-${Math.floor(Math.random() * 100000)}`;

      // Build order data using relation connect (instead of scalar foreign-key fields)
      const orderData: any = {
        orderNumber,
        // connect relations instead of scalar foreign keys
        customer: { connect: { id: customer.id } },
        branch: { connect: { id: branch.id } },
        location: { connect: { id: storeLoc.id } },
        // the schema introduced 'seller' and 'cashier' relations; seed uses sales reps as seller
        seller: { connect: { id: emp.id } },
        status: "COMPLETED",
        subtotal,
        taxes,
        discountAmount: discountAmount
          ? new Prisma.Decimal(discountAmount)
          : undefined,
        totalAmount,
        createdAt: orderDate,
        orderItems: {
          create: items.map(it => ({
            productVariantId: it.variantId,
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: new Prisma.Decimal(it.unitPrice),
            discountAmount: new Prisma.Decimal(0),
            taxAmount: subtotal
              ? new Prisma.Decimal((taxes * it.lineTotal) / subtotal)
              : new Prisma.Decimal(0),
            lineTotal: new Prisma.Decimal(it.lineTotal),
          })),
        },
      };

      // Attach discount code relation only if present
      if (discountCodeId) {
        orderData.discountCode = { connect: { id: discountCodeId } };
      }

      const order = await prisma.order.create({
        data: orderData,
        include: { orderItems: true },
      });

      // Payment
      await prisma.payment.create({
        data: {
          orderId: order.id,
          paymentType: "CASH",
          provider: "CASH",
          amount: new Prisma.Decimal(totalAmount),
          paidAt: addMinutes(orderDate, 5),
        },
      });

      // If a discount was applied, mark it as redeemed on the order date
      if (discountCodeId) {
        await prisma.customerDiscountCode.update({
          where: {
            customerId_discountCodeId: {
              customerId: customer.id,
              discountCodeId,
            },
          },
          data: {
            isRedeemed: true,
            redeemedAt: orderDate,
          },
        });
      }

      console.log(
        `🧾 Orden creada ${order.orderNumber} @ ${branch.code ?? branch.name} por empleado ${emp.employeeCode}`
      );
    }
  }

  console.log("✅ Seeding de empleados y órdenes finalizado.");
}

async function main() {
  try {
    await seedEmployeesAndOrders();
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
    console.error("❌ Error en seed de empleados/órdenes:", e);
    process.exit(1);
  });
}

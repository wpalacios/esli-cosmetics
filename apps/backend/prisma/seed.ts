import { LocationType, PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
// import { seedCategoriesAndProducts } from "./seeds/categories-products.seed";
// import { seedStockInventory } from "./seeds/stock-inventory.seed";
// import { seedBrands } from "./seeds/brands.seed";
// import { seedPriceTypes } from "./seeds/price-types.seed";
// import { seedCustomerTypes } from "./seeds/customer-types.seed";
// import { seedSalesData } from "./seeds/sales.seed";
// import { seedAdditionalBranches } from "./seeds/add-additional-branches";
// import { seedAdditionalLocations } from "./seeds/add-locations";
import { seedEmployeesAndOrders } from "./seeds/seed-employees-and-orders";
import { seedUsersRolesPermissions } from "./seeds/users-roles-permissions.seed";
import { seedPriceTypes } from "./seeds/price-types.seed";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // Seed users, roles, and permissions first
  console.log("\n👥 Seeding users, roles, and permissions...");
  await seedUsersRolesPermissions();

  // Get roles for later use
  const adminRole = await prisma.role.findUnique({
    where: { key: "admin" },
  });

  const cashierRole = await prisma.role.findUnique({
    where: { key: "cashier" },
  });

  if (!adminRole || !cashierRole) {
    throw new Error("Failed to find required roles");
  }

  // Get admin user for employee creation
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@eslicosmetics.com" },
  });

  const esliUser = await prisma.user.findUnique({
    where: { email: "esli@eslicosmetics.com" },
  });

  if (!adminUser || !esliUser) {
    throw new Error("Failed to find admin users");
  }

  // Get admin person records
  const adminPerson = await prisma.person.findFirst({
    where: { email: "admin@eslicosmetics.com" },
  });

  const esliPerson = await prisma.person.findFirst({
    where: { email: "esli@eslicosmetics.com" },
  });

  if (!adminPerson || !esliPerson) {
    throw new Error("Failed to find admin person records");
  }

  // Create Default Branch
  console.log("Creating default branch...");
  // Find existing branch by code (code is no longer unique, so we use findFirst)
  const existingBranch = await prisma.branch.findFirst({
    where: { code: "CA", isDeleted: false },
  });

  const defaultBranch = existingBranch
    ? await prisma.branch.update({
        where: { id: existingBranch.id },
        data: {
          name: "CENTROAMÉRICA",
          address:
            "Rotonda Centroamérica 2c al este (contiguo a Farma 911, módulo esquinero)",
          phone: "+1234567890",
          isActive: true,
        },
      })
    : await prisma.branch.create({
        data: {
          name: "CENTROAMÉRICA",
          code: "CA",
          address:
            "Rotonda Centroamérica 2c al este (contiguo a Farma 911, módulo esquinero)",
          phone: "+1234567890",
          isActive: true,
        },
      });

  console.log(`✓ Created default branch: ${defaultBranch.name}`);

  // Create Default Location
  let defaultLocation = await prisma.location.findFirst({
    where: {
      branchId: defaultBranch.id,
      name: "CENTROAMÉRICA",
      locationType: LocationType.STORE,
    },
  });

  if (!defaultLocation) {
    defaultLocation = await prisma.location.create({
      data: {
        branchId: defaultBranch.id,
        name: "CENTROAMÉRICA",
        locationType: LocationType.STORE,
        address:
          "Rotonda Centroamérica 2c al este (contiguo a Farma 911, módulo esquinero)",
        contact: "tienda.principal@eslicosmetics.com",
      },
    });
  }

  console.log(`✓ Created default location: ${defaultLocation.name}`);

  // Create Cashier User and Employee
  console.log("Creating cashier user and employee...");

  // Get cashier person
  let cashierPerson = await prisma.person.findFirst({
    where: {
      email: "cajero@eslicosmetics.com",
    },
  });

  if (!cashierPerson) {
    cashierPerson = await prisma.person.create({
      data: {
        firstName: "Cajero",
        lastName: "Principal",
        email: "cajero@eslicosmetics.com",
        phone: "+50588884447",
      },
    });
  }

  // Hash the cashier password
  const cashierPassword = "#eccaja2025*";
  const hashedCashierPassword = await bcrypt.hash(cashierPassword, 10);

  // Create cashier user
  const cashierUser = await prisma.user.upsert({
    where: { email: "cajero@eslicosmetics.com" },
    update: {
      password: hashedCashierPassword,
      isActive: true,
      isDeleted: false,
    },
    create: {
      id: uuidv4(),
      email: "cajero@eslicosmetics.com",
      password: hashedCashierPassword,
      isActive: true,
    },
  });

  // Assign cashier role to user at the branch
  await prisma.userRole.upsert({
    where: {
      userId_roleId_branchId: {
        userId: cashierUser.id,
        roleId: cashierRole.id,
        branchId: defaultBranch.id,
      },
    },
    update: {
      isDeleted: false,
    },
    create: {
      userId: cashierUser.id,
      roleId: cashierRole.id,
      branchId: defaultBranch.id,
    },
  });

  // Create employee record
  let cashierEmployee = await prisma.employee.findFirst({
    where: {
      personId: cashierPerson.id,
    },
  });

  if (!cashierEmployee) {
    cashierEmployee = await prisma.employee.create({
      data: {
        personId: cashierPerson.id,
        userId: cashierUser.id,
        employeeCode: "EMP-CAJ-001",
        hiredAt: new Date(),
        isActive: true,
      },
    });
  } else {
    // Update existing employee to ensure it's linked to the user
    cashierEmployee = await prisma.employee.update({
      where: { id: cashierEmployee.id },
      data: {
        userId: cashierUser.id,
        isActive: true,
      },
    });
  }

  console.log(
    `✓ Created cashier employee: ${cashierPerson.firstName} ${cashierPerson.lastName}`
  );
  console.log(`✓ Cashier user: ${cashierUser.email}`);

  // Create Employee Records for Admin Users
  console.log("Creating employee records for admin users...");

  // Create employee record for first admin
  let adminEmployee = await prisma.employee.findFirst({
    where: {
      personId: adminPerson.id,
    },
  });

  if (!adminEmployee) {
    adminEmployee = await prisma.employee.create({
      data: {
        personId: adminPerson.id,
        userId: adminUser.id,
        employeeCode: "EMP-ADM-002",
        roleTitle: "Administrador",
        locationId: defaultLocation.id,
        hiredAt: new Date(),
        isActive: true,
      },
    });
  } else {
    // Update existing employee to ensure it's assigned to the location
    adminEmployee = await prisma.employee.update({
      where: { id: adminEmployee.id },
      data: {
        userId: adminUser.id,
        locationId: defaultLocation.id,
        isActive: true,
      },
    });
  }

  console.log(
    `✓ Created admin employee: ${adminPerson.firstName} ${adminPerson.lastName}`
  );
  console.log(`✓ Admin employee assigned to branch: ${defaultBranch.name}`);

  // Create employee record for second admin (esli)
  let esliEmployee = await prisma.employee.findFirst({
    where: {
      personId: esliPerson.id,
    },
  });

  if (!esliEmployee) {
    esliEmployee = await prisma.employee.create({
      data: {
        personId: esliPerson.id,
        userId: esliUser.id,
        employeeCode: "EMP-ADM-001",
        roleTitle: "Administrador",
        locationId: defaultLocation.id,
        hiredAt: new Date(),
        isActive: true,
      },
    });
  } else {
    // Update existing employee to ensure it's assigned to the location
    esliEmployee = await prisma.employee.update({
      where: { id: esliEmployee.id },
      data: {
        userId: esliUser.id,
        locationId: defaultLocation.id,
        isActive: true,
      },
    });
  }

  console.log(
    `✓ Created esli admin employee: ${esliPerson.firstName} ${esliPerson.lastName}`
  );
  console.log(
    `✓ Esli admin employee assigned to branch: ${defaultBranch.name}`
  );

  // Create Sample Warehouse
  console.log("Creating sample warehouse...");
  let sampleWarehouse = await prisma.location.findFirst({
    where: {
      name: "Bodega Principal",
      locationType: LocationType.WAREHOUSE,
    },
  });

  if (!sampleWarehouse) {
    sampleWarehouse = await prisma.location.create({
      data: {
        name: "Bodega Principal",
        locationType: LocationType.WAREHOUSE,
        address:
          "Bello Horizonte: A una cuadra de la Iglesia Pío X hacia arriba.",
        contact: "bodega@eslicosmetics.com",
      },
    });
  }

  console.log(`✓ Created sample warehouse: ${sampleWarehouse.name}`);

  // Seed additional branches (MSYA, LEON, GRAN, ESTE, MZ2, CAM, BELL)
  console.log("\n🏬 Seeding additional branches...");
  // await seedAdditionalBranches();

  // Seed additional locations (Bodega ALTAMIRA)
  console.log("\n🏬 Seeding additional locations...");
  // await seedAdditionalLocations();

  // Create cash registers for all branch and warehouse locations
  console.log("\n💰 Creating cash registers for branches and warehouses...");

  let cashRegisterCount = 0;

  // Get all branches and their locations
  const allBranches = await prisma.branch.findMany({
    where: { isDeleted: false },
    include: {
      locations: {
        where: { isDeleted: false },
      },
    },
  });

  console.log(`\n  Processing ${allBranches.length} branches...`);
  for (const branch of allBranches) {
    for (const location of branch.locations) {
      // Check if cash register already exists for this location
      const existingCashRegister = await prisma.cashRegister.findFirst({
        where: {
          locationId: location.id,
        },
      });

      if (!existingCashRegister) {
        // Check if a cash register with this code already exists (from a different location)
        const existingByCode = await prisma.cashRegister.findUnique({
          where: { code: location.name },
        });

        if (existingByCode) {
          // Update the existing cash register to point to this location
          await prisma.cashRegister.update({
            where: { id: existingByCode.id },
            data: {
              locationId: location.id,
              name: location.name,
              code: location.name,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          console.log(
            `    ✓ Updated cash register for branch location: ${location.name} [${branch.code}]`
          );
        } else {
          await prisma.cashRegister.create({
            data: {
              locationId: location.id,
              name: location.name,
              code: location.name,
              isActive: true,
            },
          });
          cashRegisterCount++;
          console.log(
            `    ✓ Created cash register for branch location: ${location.name} [${branch.code}]`
          );
        }
      } else {
        // Update existing cash register to ensure it matches location
        await prisma.cashRegister.update({
          where: { id: existingCashRegister.id },
          data: {
            name: location.name,
            code: location.name,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        console.log(
          `    ✓ Updated cash register for branch location: ${location.name} [${branch.code}]`
        );
      }
    }
  }

  // Get all warehouse locations
  const allWarehouses = await prisma.location.findMany({
    where: {
      isDeleted: false,
      locationType: LocationType.WAREHOUSE,
    },
  });

  console.log(`\n  Processing ${allWarehouses.length} warehouses...`);
  for (const warehouse of allWarehouses) {
    // Check if cash register already exists for this location
    const existingCashRegister = await prisma.cashRegister.findFirst({
      where: {
        locationId: warehouse.id,
      },
    });

    if (!existingCashRegister) {
      // Check if a cash register with this code already exists (from a different location)
      const existingByCode = await prisma.cashRegister.findUnique({
        where: { code: warehouse.name },
      });

      if (existingByCode) {
        // Update the existing cash register to point to this location
        await prisma.cashRegister.update({
          where: { id: existingByCode.id },
          data: {
            locationId: warehouse.id,
            name: warehouse.name,
            code: warehouse.name,
            isActive: true,
            updatedAt: new Date(),
          },
        });
        console.log(
          `    ✓ Updated cash register for warehouse: ${warehouse.name}`
        );
      } else {
        await prisma.cashRegister.create({
          data: {
            locationId: warehouse.id,
            name: warehouse.name,
            code: warehouse.name,
            isActive: true,
          },
        });
        cashRegisterCount++;
        console.log(
          `    ✓ Created cash register for warehouse: ${warehouse.name}`
        );
      }
    } else {
      // Update existing cash register to ensure it matches location
      await prisma.cashRegister.update({
        where: { id: existingCashRegister.id },
        data: {
          name: warehouse.name,
          code: warehouse.name,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      console.log(
        `    ✓ Updated cash register for warehouse: ${warehouse.name}`
      );
    }
  }

  console.log(`\n✓ Created/updated ${cashRegisterCount} cash registers`);

  // Note: Categories are now created in seedCategoriesAndProducts()
  // This section has been removed to avoid duplicate category creation
  console.log(
    "Skipping basic category creation (handled in seedCategoriesAndProducts)..."
  );

  // Create Sample Tax Rate
  const defaultTaxRate = await prisma.taxRate.create({
    data: {
      name: "IVA 15%",
      code: "IVA15",
      rate: 15.0,
      active: true,
    },
  });

  console.log(
    `✓ Created default tax rate: ${defaultTaxRate.name} (${defaultTaxRate.rate}%)`
  );

  // Create Sample Suppliers
  console.log("Creating sample suppliers...");
  const suppliers = [
    {
      name: "Beauty Supply Co.",
      contactName: "John Smith",
      phone: "+1234567890",
      email: "contact@beautysupply.com",
      address: "123 Business St, City, State 12345",
    },
    {
      name: "Cosmetic Distributors Inc.",
      contactName: "Sarah Johnson",
      phone: "+1987654321",
      email: "orders@cosmeticdist.com",
      address: "456 Distribution Ave, City, State 54321",
    },
    {
      name: "Premium Beauty Solutions",
      contactName: "Mike Davis",
      phone: "+1555123456",
      email: "sales@premiumbeauty.com",
      address: "789 Premium Blvd, City, State 67890",
    },
  ];

  const createdSuppliers = [];
  for (const supplier of suppliers) {
    const created = await prisma.supplier.create({
      data: supplier,
    });
    createdSuppliers.push(created);
  }

  console.log(`✓ Created ${createdSuppliers.length} sample suppliers`);

  // Create Sample Customers
  console.log("Creating sample customers...");
  const customerPeople = [
    {
      firstName: "Clientex",
      lastName: "Clientex",
      email: "clientex@email.com",
      phone: "+50588884444",
      docType: "CEDULA",
      docNumber: "0000-000000-0001A",
    },
    {
      firstName: "Clientey",
      lastName: "Clientey",
      email: "clientey@email.com",
      phone: "+50588884445",
      docType: "CEDULA",
      docNumber: "0000-000000-0002A",
    },
    {
      firstName: "Clientez",
      lastName: "Clientez",
      email: "clientez@email.com",
      phone: "+50588884446",
      docType: "CEDULA",
      docNumber: "0000-000000-0003A",
    },
  ];

  const createdCustomerPeople = [];
  for (const personData of customerPeople) {
    const person = await prisma.person.create({
      data: personData,
    });
    createdCustomerPeople.push(person);
  }

  // Create customers for the people
  const customers = [
    {
      personId: createdCustomerPeople[0].id,
      externalId: "CUST001",
    },
    {
      personId: createdCustomerPeople[1].id,
      externalId: "CUST002",
    },
    {
      personId: createdCustomerPeople[2].id,
      externalId: "CUST003",
    },
  ];

  const createdCustomers = [];
  for (const customerData of customers) {
    const customer = await prisma.customer.create({
      data: customerData,
    });
    createdCustomers.push(customer);
  }

  console.log(`✓ Created ${createdCustomers.length} sample customers`);

  // // Seed brands first
  // console.log("\n🏷️  Seeding brands...");
  // await seedBrands();

  // // Seed price types
  // console.log("\n💰 Seeding price types...");
  await seedPriceTypes();

  // // Seed customer types
  // console.log("\n👥 Seeding customer types...");
  // await seedCustomerTypes();

  // // Seed comprehensive categories and products from Beauty Creations
  // console.log("\n📦 Seeding comprehensive categories and products...");
  // await seedCategoriesAndProducts();

  // // Seed stock inventory for warehouse and store
  // console.log("\n📊 Seeding stock inventory...");
  // await seedStockInventory();

  // Seed employees and sample orders (uses product variants and IVA15)
  console.log("\n🧑‍💼 Seeding employees and sample orders...");
  await seedEmployeesAndOrders();

  // Seed sales data (existing)
  console.log("\n💵 Seeding sales data...");
  // await seedSalesData({
  //   purchaseOrders: 10,
  //   ordersPerCustomer: 3,
  //   customersCount: 5,
  //   applyDiscountEvery: 2,
  // });

  console.log("\n Database seeding completed successfully!");
  console.log("\n Default users created. Check seed.ts for credentials.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error("❌ Seeding error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });

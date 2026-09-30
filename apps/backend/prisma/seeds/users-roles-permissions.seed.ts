import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

export async function seedUsersRolesPermissions() {
  console.log("🌱 Seeding users, roles, and permissions...");

  // Create Roles
  console.log("Creating roles...");
  const adminRole = await prisma.role.upsert({
    where: { key: "admin" },
    update: {},
    create: {
      key: "admin",
      name: "Administrador",
      description: "Acceso completo al sistema y capacidades de gestión",
    },
  });

  const storeManagerRole = await prisma.role.upsert({
    where: { key: "store_manager" },
    update: {},
    create: {
      key: "store_manager",
      name: "Gerente de Tienda",
      description: "Gestión y operaciones a nivel de sucursal",
    },
  });

  const salesRepRole = await prisma.role.upsert({
    where: { key: "sales_rep" },
    update: {},
    create: {
      key: "sales_rep",
      name: "Representante de Ventas",
      description: "Operaciones de ventas y atención al cliente",
    },
  });

  const cashierRole = await prisma.role.upsert({
    where: { key: "cashier" },
    update: {},
    create: {
      key: "cashier",
      name: "Cajero",
      description: "Operaciones de punto de venta y manejo de efectivo",
    },
  });

  const inventoryManagerRole = await prisma.role.upsert({
    where: { key: "inventory_manager" },
    update: {},
    create: {
      key: "inventory_manager",
      name: "Gerente de Inventario",
      description: "Operaciones de gestión de inventario y existencias",
    },
  });

  console.log(
    `✓ Created roles: ${adminRole.name}, ${storeManagerRole.name}, ${salesRepRole.name}, ${cashierRole.name}, ${inventoryManagerRole.name}`
  );

  // Create Permissions
  console.log("Creating permissions...");
  const permissions = [
    // User Management
    {
      key: "users.read",
      name: "Leer Usuarios",
      description: "Ver información de usuarios",
    },
    {
      key: "users.create",
      name: "Crear Usuarios",
      description: "Crear nuevos usuarios",
    },
    {
      key: "users.update",
      name: "Actualizar Usuarios",
      description: "Modificar información de usuarios",
    },
    {
      key: "users.delete",
      name: "Eliminar Usuarios",
      description: "Eliminar usuarios",
    },

    // Profile Management (Self-service)
    {
      key: "profile.read",
      name: "Leer Perfil",
      description: "Ver información de su propio perfil",
    },
    {
      key: "profile.update",
      name: "Actualizar Perfil",
      description: "Modificar información de su propio perfil",
    },

    // Customer Management
    {
      key: "customers.read",
      name: "Leer Clientes",
      description: "Ver información de clientes",
    },
    {
      key: "customers.create",
      name: "Crear Clientes",
      description: "Crear nuevos clientes",
    },
    {
      key: "customers.update",
      name: "Actualizar Clientes",
      description: "Modificar información de clientes",
    },
    {
      key: "customers.delete",
      name: "Eliminar Clientes",
      description: "Eliminar clientes",
    },

    // Product Management
    {
      key: "products.read",
      name: "Leer Productos",
      description: "Ver información de productos",
    },
    {
      key: "products.create",
      name: "Crear Productos",
      description: "Crear nuevos productos",
    },
    {
      key: "products.update",
      name: "Actualizar Productos",
      description: "Modificar información de productos",
    },
    {
      key: "products.delete",
      name: "Eliminar Productos",
      description: "Eliminar productos",
    },

    // Product Variants Management (CRUD)
    {
      key: "products.variants.read",
      name: "Leer Variantes de Producto",
      description: "Ver información de variantes de producto",
    },
    {
      key: "products.variants.create",
      name: "Crear Variantes de Producto",
      description:
        "Crear nuevas variantes (hijo) para un producto existente (padre)",
    },
    {
      key: "products.variants.update",
      name: "Actualizar Variantes de Producto",
      description: "Modificar información de variantes de producto",
    },
    {
      key: "products.variants.delete",
      name: "Eliminar Variantes de Producto",
      description: "Eliminar variantes de producto",
    },

    // Category Management
    {
      key: "categories.read",
      name: "Leer Categorías",
      description: "Ver información de categorías",
    },
    {
      key: "categories.create",
      name: "Crear Categorías",
      description: "Crear nuevas categorías",
    },
    {
      key: "categories.update",
      name: "Actualizar Categorías",
      description: "Modificar información de categorías",
    },
    {
      key: "categories.delete",
      name: "Eliminar Categorías",
      description: "Eliminar categorías",
    },

    // Prices Management
    {
      key: "prices.read",
      name: "Leer Precios",
      description: "Ver información de precios",
    },
    {
      key: "prices.create",
      name: "Crear Tipos de Precio",
      description: "Crear nuevos precios",
    },
    {
      key: "prices.update",
      name: "Actualizar Precios",
      description: "Modificar información de precios",
    },
    {
      key: "prices.delete",
      name: "Eliminar Precios",
      description: "Eliminar precios",
    },

    //TaxRates Management
    {
      key: "tax.rates.read",
      name: "Leer Tasas de Impuesto",
      description: "Ver información de tasas de impuesto",
    },
    {
      key: "tax.rates.create",
      name: "Crear Tasas de Impuesto",
      description: "Crear nuevas tasas de impuesto",
    },
    {
      key: "tax.rates.update",
      name: "Actualizar Tasas de Impuesto",
      description: "Modificar información de tasas de impuesto",
    },
    {
      key: "tax.rates.delete",
      name: "Eliminar Tasas de Impuesto",
      description: "Eliminar tasas de impuesto",
    },

    // Customer Types Management
    {
      key: "customer_types.read",
      name: "Leer Tipos de Cliente",
      description: "Ver información de tipos de cliente",
    },
    {
      key: "customer_types.create",
      name: "Crear Tipos de Cliente",
      description: "Crear nuevos tipos de cliente",
    },
    {
      key: "customer_types.update",
      name: "Actualizar Tipos de Cliente",
      description: "Modificar información de tipos de cliente",
    },
    {
      key: "customer_types.delete",
      name: "Eliminar Tipos de Cliente",
      description: "Eliminar tipos de cliente",
    },

    // Supplier Management
    {
      key: "suppliers.read",
      name: "Leer Proveedores",
      description: "Ver información de proveedores",
    },
    {
      key: "suppliers.create",
      name: "Crear Proveedores",
      description: "Crear nuevos proveedores",
    },
    {
      key: "suppliers.update",
      name: "Actualizar Proveedores",
      description: "Modificar información de proveedores",
    },
    {
      key: "suppliers.delete",
      name: "Eliminar Proveedores",
      description: "Eliminar proveedores",
    },

    // Inventory Management
    {
      key: "inventory.read",
      name: "Leer Inventario",
      description: "Ver niveles de inventario y movimientos",
    },
    {
      key: "inventory.update",
      name: "Actualizar Inventario",
      description: "Modificar niveles de inventario",
    },
    {
      key: "inventory.movements",
      name: "Movimientos de Inventario",
      description: "Crear y gestionar movimientos de stock",
    },

    {
      key: "stock-levels.read",
      name: "Leer Niveles de Stock",
      description: "Ver niveles de stock",
    },
    {
      key: "stock-levels.create",
      name: "Crear Niveles de Stock",
      description: "Crear nuevos niveles de stock",
    },
    {
      key: "stock-levels.update",
      name: "Actualizar Niveles de Stock",
      description: "Modificar niveles de stock",
    },
    {
      key: "stock-levels.delete",
      name: "Eliminar Niveles de Stock",
      description: "Eliminar niveles de stock",
    },
    {
      key: "stock-movements.read",
      name: "Leer Movimientos de Stock",
      description: "Ver movimientos de stock",
    },
    {
      key: "stock-movements.create",
      name: "Crear Movimientos de Stock",
      description: "Crear nuevos movimientos de stock",
    },
    {
      key: "stock-movements.update",
      name: "Actualizar Movimientos de Stock",
      description: "Modificar movimientos de stock",
    },
    {
      key: "stock-movements.delete",
      name: "Eliminar Movimientos de Stock",
      description: "Eliminar movimientos de stock",
    },

    // Stock Transfers Management
    {
      key: "stock-transfers.create",
      name: "Crear Transferencias de Stock",
      description: "Crear nuevas transferencias de stock",
    },
    {
      key: "stock-transfers.read",
      name: "Leer Transferencias de Stock",
      description: "Ver transferencias de stock",
    },
    {
      key: "stock-transfers.update",
      name: "Actualizar Transferencias de Stock",
      description: "Modificar transferencias de stock",
    },
    {
      key: "stock-transfers.cancel",
      name: "Cancelar Transferencias de Stock",
      description: "Cancelar transferencias de stock",
    },

    //Notifications Management
    {
      key: "notifications.read",
      name: "Leer Notificaciones",
      description: "Ver y listar notificaciones",
    },
    {
      key: "notifications.create",
      name: "Crear Notificaciones",
      description: "Crear nuevas notificaciones manualmente",
    },
    {
      key: "notifications.update",
      name: "Actualizar Notificaciones",
      description: "Marcar notificaciones como leídas",
    },
    {
      key: "notifications.delete",
      name: "Eliminar Notificaciones",
      description: "Eliminar notificaciones propias",
    },

    // Order Management
    {
      key: "orders.read",
      name: "Leer Pedidos",
      description: "Ver información de pedidos",
    },
    {
      key: "orders.create",
      name: "Crear Pedidos",
      description: "Crear nuevos pedidos",
    },
    {
      key: "orders.annul",
      name: "Anular Pedidos",
      description: "Anular pedidos existentes",
    },
    {
      key: "orders.update",
      name: "Actualizar Pedidos",
      description: "Modificar información de pedidos",
    },
    {
      key: "orders.delete",
      name: "Eliminar Pedidos",
      description: "Eliminar pedidos",
    },

    // Quotes Management
    {
      key: "quotes.read",
      name: "Leer Cotizaciones",
      description: "Ver información de cotizaciones",
    },
    {
      key: "quotes.create",
      name: "Crear Cotizaciones",
      description: "Crear nuevas cotizaciones",
    },
    {
      key: "quotes.update",
      name: "Actualizar Cotizaciones",
      description: "Modificar información de cotizaciones",
    },
    {
      key: "quotes.delete",
      name: "Eliminar Cotizaciones",
      description: "Eliminar cotizaciones",
    },
    {
      key: "quotes.convert",
      name: "Convertir Cotizaciones",
      description: "Convertir una cotización en pedido/venta",
    },

    // POS Operations
    {
      key: "pos.access",
      name: "Acceso a POS",
      description: "Acceder al sistema de punto de venta",
    },
    {
      key: "pos.transactions",
      name: "Transacciones POS",
      description: "Procesar transacciones de venta",
    },

    // Reports
    {
      key: "reports.sales",
      name: "Reportes de Ventas",
      description: "Ver reportes y análisis de ventas",
    },
    {
      key: "reports.inventory",
      name: "Reportes de Inventario",
      description: "Ver reportes de inventario",
    },
    {
      key: "reports.financial",
      name: "Reportes Financieros",
      description: "Ver reportes financieros",
    },
    {
      key: "reports.export",
      name: "Exportar Reportes",
      description: "Exportar reportes en varios formatos",
    },

    // Employee Management
    {
      key: "employees.read",
      name: "Leer Empleados",
      description: "Ver información de empleados",
    },
    {
      key: "employees.create",
      name: "Crear Empleados",
      description: "Crear nuevos empleados",
    },
    {
      key: "employees.update",
      name: "Actualizar Empleados",
      description: "Modificar información de empleados",
    },
    {
      key: "employees.delete",
      name: "Eliminar Empleados",
      description: "Eliminar empleados",
    },
    // People Management
    {
      key: "people.read",
      name: "Leer Personas",
      description: "Ver información de personas",
    },
    {
      key: "people.create",
      name: "Crear Personas",
      description: "Crear nuevas personas",
    },
    {
      key: "people.update",
      name: "Actualizar Personas",
      description: "Modificar información de personas",
    },
    {
      key: "people.delete",
      name: "Eliminar Personas",
      description: "Eliminar personas",
    },

    // Store branch Management
    {
      key: "branch.read",
      name: "Leer Sucursal",
      description: "Ver información de sucursales",
    },
    {
      key: "branch.create",
      name: "Crear Sucursal",
      description: "Crear nuevas sucursales",
    },
    {
      key: "branch.update",
      name: "Actualizar Sucursal",
      description: "Modificar información de sucursales",
    },
    {
      key: "branch.delete",
      name: "Eliminar Sucursal",
      description: "Eliminar sucursales",
    },

    // Store warehouse Management
    {
      key: "warehouse.read",
      name: "Leer Bodega",
      description: "Ver información de bodegas",
    },
    {
      key: "warehouse.create",
      name: "Crear Bodega",
      description: "Crear nuevas bodegas",
    },
    {
      key: "warehouse.update",
      name: "Actualizar Bodega",
      description: "Modificar información de bodegas",
    },
    {
      key: "warehouse.delete",
      name: "Eliminar Bodega",
      description: "Eliminar bodegas",
    },

    // Brand Management
    {
      key: "brands.read",
      name: "Leer Marcas",
      description: "Ver información de marcas",
    },
    {
      key: "brands.create",
      name: "Crear Marcas",
      description: "Crear nuevas marcas",
    },
    {
      key: "brands.update",
      name: "Actualizar Marcas",
      description: "Modificar información de marcas",
    },
    {
      key: "brands.delete",
      name: "Eliminar Marcas",
      description: "Eliminar marcas",
    },

    // Discount Codes Management
    {
      key: "discount_codes.read",
      name: "Leer Códigos de Descuento",
      description: "Ver información de códigos de descuento",
    },
    {
      key: "discount_codes.create",
      name: "Crear Códigos de Descuento",
      description: "Crear nuevos códigos de descuento",
    },
    {
      key: "discount_codes.update",
      name: "Actualizar Códigos de Descuento",
      description: "Modificar información de códigos de descuento",
    },
    {
      key: "discount_codes.delete",
      name: "Eliminar Códigos de Descuento",
      description: "Eliminar códigos de descuento",
    },

    // Supplier Management (duplicate - keeping for compatibility)
    {
      key: "supplier.read",
      name: "Leer Proveedor",
      description: "Ver información de proveedores",
    },
    {
      key: "supplier.create",
      name: "Crear Proveedor",
      description: "Crear nuevos proveedores",
    },
    {
      key: "supplier.update",
      name: "Actualizar Proveedor",
      description: "Modificar información de proveedores",
    },
    {
      key: "supplier.delete",
      name: "Eliminar Proveedor",
      description: "Eliminar proveedores",
    },

    // Supplier Orders Management
    {
      key: "supplier-orders.read",
      name: "Leer pedidos a Proveedor",
      description: "Ver información de pedidos a proveedor",
    },
    {
      key: "supplier-orders.create",
      name: "Crear pedidos a Proveedor",
      description: "Crear nuevas pedidos a proveedor",
    },
    {
      key: "supplier-orders.update",
      name: "Actualizar pedidos a Proveedor",
      description: "Modificar información de pedidos a proveedor",
    },
    {
      key: "supplier-orders.delete",
      name: "Eliminar pedidos a Proveedor",
      description: "Eliminar pedidos a proveedor",
    },

    // System Administration
    {
      key: "system.admin",
      name: "Administración del Sistema",
      description: "Acceso completo a la administración del sistema",
    },
    {
      key: "system.settings",
      name: "Configuración del Sistema",
      description: "Modificar configuración del sistema",
    },
    {
      key: "system.roles",
      name: "Gestión de Roles",
      description: "Gestionar roles y permisos",
    },
    // Cash Register Permissions
    {
      key: "cash_registers.create",
      name: "Crear Caja Registradora",
      description: "Crear nuevas cajas registradoras",
    },
    {
      key: "cash_registers.view",
      name: "Ver Cajas Registradoras",
      description: "Ver información de cajas registradoras",
    },
    {
      key: "cash_registers.update",
      name: "Actualizar Caja Registradora",
      description: "Actualizar información de cajas registradoras",
    },
    {
      key: "cash_registers.delete",
      name: "Eliminar Caja Registradora",
      description: "Eliminar cajas registradoras",
    },
    {
      key: "cash_sessions.open",
      name: "Abrir Sesión de Caja",
      description: "Abrir una nueva sesión de caja",
    },
    {
      key: "cash_sessions.close",
      name: "Cerrar Sesión de Caja",
      description: "Cerrar una sesión de caja",
    },
    {
      key: "cash_sessions.view",
      name: "Ver Sesiones de Caja",
      description: "Ver información de sesiones de caja",
    },
    {
      key: "cash_movements.create",
      name: "Crear Movimiento de Caja",
      description: "Registrar movimientos de efectivo (entradas/salidas)",
    },
    {
      key: "cash_movements.view",
      name: "Ver Movimientos de Caja",
      description: "Ver movimientos de efectivo",
    },
  ];

  const createdPermissions = [];
  for (const permission of permissions) {
    const created = await prisma.permission.upsert({
      where: { key: permission.key },
      update: {},
      create: permission,
    });
    createdPermissions.push(created);
  }

  console.log(`✓ Created ${createdPermissions.length} permissions`);

  // Assign Permissions to Roles
  console.log("Assigning permissions to roles...");

  // Admin gets all permissions
  const adminPermissions = createdPermissions.map(permission => ({
    roleId: adminRole.id,
    permissionId: permission.id,
  }));

  // Clear existing admin permissions first to ensure clean state
  await prisma.rolePermission.deleteMany({
    where: { roleId: adminRole.id },
  });

  await prisma.rolePermission.createMany({
    data: adminPermissions,
    skipDuplicates: true,
  });

  console.log(
    `✓ Assigned ${adminPermissions.length} permissions to admin role`
  );

  // Store Manager permissions
  const storeManagerPermissionKeys = [
    // Product Management
    "products.read",
    "products.create",
    "products.update",
    "products.variants.create",

    // Category Management
    "categories.read",
    "categories.create",
    "categories.update",

    // Price Management
    "prices.read",
    "prices.create",
    "prices.update",
    "prices.delete",

    // Customer Management
    "customers.read",
    "customers.create",
    "customers.update",

    // Customer Types Management
    "customer_types.read",
    "customer_types.create",
    "customer_types.update",

    // Supplier Management
    "suppliers.read",
    "suppliers.create",
    "suppliers.update",

    // Inventory Management
    "inventory.read",
    "inventory.update",
    "inventory.movements",

    "stock-levels.read",
    "stock-levels.create",
    "stock-levels.update",

    "stock-movements.read",
    "stock-movements.create",
    "stock-movements.update",

    "stock-transfers.create",
    "stock-transfers.read",
    "stock-transfers.update",
    "stock-transfers.cancel",

    // Order Management
    "orders.read",
    "orders.create",
    "orders.update",

    // Quotes Management
    "quotes.read",
    "quotes.create",
    "quotes.update",
    "quotes.delete",
    "orders.read",
    "orders.create",
    "orders.update",

    // POS Operations
    "pos.access",
    "pos.transactions",

    // Reports
    "reports.sales",
    "reports.inventory",
    "reports.export",

    // User & Employee Management (Read Only)
    "users.read",
    "employees.read",
    "people.read",

    // Branch Management
    "branch.read",
    "branch.create",
    "branch.update",

    // Warehouse Management
    "warehouse.read",
    "warehouse.create",
    "warehouse.update",

    // Brand Management
    "brands.read",
    "brands.create",
    "brands.update",

    // Discount Codes Management
    "discount_codes.read",
    "discount_codes.create",
    "discount_codes.update",

    // Profile Management (Self-service)
    "profile.read",
    "profile.update",

    // Cash Register Management
    "cash_registers.create",
    "cash_registers.view",
    "cash_registers.update",
    "cash_registers.delete",
    "cash_sessions.open",
    "cash_sessions.close",
    "cash_sessions.view",
    "cash_movements.create",
    "cash_movements.view",
  ];

  const storeManagerPermissions = createdPermissions
    .filter(permission => storeManagerPermissionKeys.includes(permission.key))
    .map(permission => ({
      roleId: storeManagerRole.id,
      permissionId: permission.id,
    }));

  // Clear existing store manager permissions
  await prisma.rolePermission.deleteMany({
    where: { roleId: storeManagerRole.id },
  });

  await prisma.rolePermission.createMany({
    data: storeManagerPermissions,
    skipDuplicates: true,
  });

  // Sales Rep permissions
  const salesRepPermissionKeys = [
    "branch.read",
    "warehouse.read",
    "products.read",
    "stock-levels.read",
    "products.variants.read",
    "discount_codes.read",
    "prices.read",
    "customer_types.read",
    "employees.read",
    "categories.read",
    "customers.read",
    "customers.create",
    "customers.update",
    "inventory.read",
    "orders.read",
    "orders.create",
    "quotes.read",
    "quotes.create",
    "quotes.update",
    "quotes.delete",
    "pos.access",
    "pos.transactions",
    "reports.export",
    // Profile Management (Self-service)
    "profile.read",
    "profile.update",
    // Cash Register Operations
    "cash_registers.view",
    "cash_sessions.open",
    "cash_sessions.close",
    "cash_sessions.view",
    "cash_movements.create",
    "cash_movements.view",
  ];

  const salesRepPermissions = createdPermissions
    .filter(permission => salesRepPermissionKeys.includes(permission.key))
    .map(permission => ({
      roleId: salesRepRole.id,
      permissionId: permission.id,
    }));

  // Clear existing sales rep permissions
  await prisma.rolePermission.deleteMany({
    where: { roleId: salesRepRole.id },
  });

  await prisma.rolePermission.createMany({
    data: salesRepPermissions,
    skipDuplicates: true,
  });

  // Cashier permissions
  const cashierPermissionKeys = [
    "branch.read",
    "warehouse.read",
    "products.read",
    "discount_codes.read",
    "stock-levels.read",
    "prices.read",
    "products.variants.read",
    "customer_types.read",
    "customer_types.create",
    "customers.read",
    "categories.read",
    "customers.read",
    "customers.create",
    "customers.update",
    "inventory.read",
    "orders.read",
    "orders.create",
    "quotes.read",
    "quotes.create",
    "quotes.update",
    "quotes.delete",
    "quotes.convert",
    "pos.access",
    "pos.transactions",
    "reports.export",
    // Profile Management (Self-service)
    "profile.read",
    "profile.update",
    // Cash Register Operations
    "cash_registers.view",
    "cash_sessions.open",
    "cash_sessions.close",
    "cash_sessions.view",
    "cash_movements.create",
    "cash_movements.view",
    "employees.read",
  ];

  const cashierPermissions = createdPermissions
    .filter(permission => cashierPermissionKeys.includes(permission.key))
    .map(permission => ({
      roleId: cashierRole.id,
      permissionId: permission.id,
    }));

  // Clear existing cashier permissions
  await prisma.rolePermission.deleteMany({
    where: { roleId: cashierRole.id },
  });

  await prisma.rolePermission.createMany({
    data: cashierPermissions,
    skipDuplicates: true,
  });

  // Inventory Manager permissions
  const inventoryManagerPermissionKeys = [
    "products.read",
    "categories.read",
    "inventory.read",
    "inventory.update",
    "inventory.movements",
    "stock-levels.read",
    "stock-levels.create",
    "stock-levels.update",
    "stock-movements.read",
    "stock-movements.create",
    "stock-movements.update",
    "stock-transfers.create",
    "stock-transfers.read",
    "stock-transfers.update",
    "stock-transfers.cancel",
    "warehouse.read",
    "warehouse.create",
    "warehouse.update",
    "suppliers.read",
    "quotes.read",
    "reports.inventory",
    "reports.export",
    // Profile Management (Self-service)
    "profile.read",
    "profile.update",
  ];

  const inventoryManagerPermissions = createdPermissions
    .filter(permission =>
      inventoryManagerPermissionKeys.includes(permission.key)
    )
    .map(permission => ({
      roleId: inventoryManagerRole.id,
      permissionId: permission.id,
    }));

  // Clear existing inventory manager permissions
  await prisma.rolePermission.deleteMany({
    where: { roleId: inventoryManagerRole.id },
  });

  await prisma.rolePermission.createMany({
    data: inventoryManagerPermissions,
    skipDuplicates: true,
  });

  console.log("✓ Assigned permissions to all roles");

  // Get default branch for user assignment
  const defaultBranch = await prisma.branch.findFirst({
    where: { code: "CA" },
  });

  // Create Default Admin Users
  console.log("Creating default admin users...");

  // Admin User 1
  let adminPerson = await prisma.person.findFirst({
    where: {
      email: "admin@eslicosmetics.com",
    },
  });

  if (!adminPerson) {
    adminPerson = await prisma.person.create({
      data: {
        firstName: "System",
        lastName: "Administrador",
        email: "admin@eslicosmetics.com",
      },
    });
  }

  const adminPassword = "#ec2025*";
  const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@eslicosmetics.com" },
    update: {
      password: hashedAdminPassword,
      isActive: true,
      isDeleted: false,
    },
    create: {
      id: uuidv4(),
      email: "admin@eslicosmetics.com",
      password: hashedAdminPassword,
      isActive: true,
    },
  });

  // Assign admin role to user (branchId is null for admin users)
  const existingAdminUserRole = await prisma.userRole.findFirst({
    where: {
      userId: adminUser.id,
      roleId: adminRole.id,
      branchId: null,
    },
  });

  if (existingAdminUserRole) {
    await prisma.userRole.update({
      where: { id: existingAdminUserRole.id },
      data: {
        isDeleted: false,
      },
    });
  } else {
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: adminRole.id,
        branchId: null,
      },
    });
  }

  console.log(`✓ Created admin user: ${adminUser.email}`);

  // Admin User 2
  let esliPerson = await prisma.person.findFirst({
    where: {
      email: "esli@eslicosmetics.com",
    },
  });

  if (!esliPerson) {
    esliPerson = await prisma.person.create({
      data: {
        firstName: "Esli",
        lastName: "Cosmetics",
        email: "esli@eslicosmetics.com",
      },
    });
  }

  const esliPassword = "#Esli2025*";
  const hashedEsliPassword = await bcrypt.hash(esliPassword, 10);

  const esliUser = await prisma.user.upsert({
    where: { email: "esli@eslicosmetics.com" },
    update: {
      password: hashedEsliPassword,
      isActive: true,
      isDeleted: false,
    },
    create: {
      id: uuidv4(),
      email: "esli@eslicosmetics.com",
      password: hashedEsliPassword,
      isActive: true,
    },
  });

  // Assign admin role to esli user (branchId is null for admin users)
  const existingEsliUserRole = await prisma.userRole.findFirst({
    where: {
      userId: esliUser.id,
      roleId: adminRole.id,
      branchId: null,
    },
  });

  if (existingEsliUserRole) {
    await prisma.userRole.update({
      where: { id: existingEsliUserRole.id },
      data: {
        isDeleted: false,
      },
    });
  } else {
    await prisma.userRole.create({
      data: {
        userId: esliUser.id,
        roleId: adminRole.id,
        branchId: null,
      },
    });
  }

  console.log(`✓ Created esli admin user: ${esliUser.email}`);

  // Create Store Manager User
  console.log("Creating store manager user...");

  let storeManagerPerson = await prisma.person.findFirst({
    where: {
      email: "manager@eslicosmetics.com",
    },
  });

  if (!storeManagerPerson) {
    storeManagerPerson = await prisma.person.create({
      data: {
        firstName: "Store",
        lastName: "Manager",
        email: "manager@eslicosmetics.com",
        phone: "+50588884448",
      },
    });
  }

  const managerPassword = "#ecmanager2025*";
  const hashedManagerPassword = await bcrypt.hash(managerPassword, 10);

  const managerUser = await prisma.user.upsert({
    where: { email: "manager@eslicosmetics.com" },
    update: {
      password: hashedManagerPassword,
      isActive: true,
      isDeleted: false,
    },
    create: {
      id: uuidv4(),
      email: "manager@eslicosmetics.com",
      password: hashedManagerPassword,
      isActive: true,
    },
  });

  // Assign store manager role to user
  if (defaultBranch) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId_branchId: {
          userId: managerUser.id,
          roleId: storeManagerRole.id,
          branchId: defaultBranch.id,
        },
      },
      update: {
        isDeleted: false,
      },
      create: {
        userId: managerUser.id,
        roleId: storeManagerRole.id,
        branchId: defaultBranch.id,
      },
    });
  }

  console.log(`✓ Created store manager user: ${managerUser.email}`);

  // Create Sales Rep User
  console.log("Creating sales rep user...");

  let salesRepPerson = await prisma.person.findFirst({
    where: {
      email: "sales@eslicosmetics.com",
    },
  });

  if (!salesRepPerson) {
    salesRepPerson = await prisma.person.create({
      data: {
        firstName: "Sales",
        lastName: "Representative",
        email: "sales@eslicosmetics.com",
        phone: "+50588884449",
      },
    });
  }

  const salesPassword = "#ecventas2025*";
  const hashedSalesPassword = await bcrypt.hash(salesPassword, 10);

  const salesUser = await prisma.user.upsert({
    where: { email: "sales@eslicosmetics.com" },
    update: {
      password: hashedSalesPassword,
      isActive: true,
      isDeleted: false,
    },
    create: {
      id: uuidv4(),
      email: "sales@eslicosmetics.com",
      password: hashedSalesPassword,
      isActive: true,
    },
  });

  // Assign sales rep role to user
  if (defaultBranch) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId_branchId: {
          userId: salesUser.id,
          roleId: salesRepRole.id,
          branchId: defaultBranch.id,
        },
      },
      update: {
        isDeleted: false,
      },
      create: {
        userId: salesUser.id,
        roleId: salesRepRole.id,
        branchId: defaultBranch.id,
      },
    });
  }

  console.log(`✓ Created sales rep user: ${salesUser.email}`);

  // Verify admin user permissions
  const adminUserWithPermissions = await prisma.user.findUnique({
    where: { id: adminUser.id },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePermissions: {
                include: {
                  permission: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const adminUserPermissions =
    adminUserWithPermissions?.userRoles
      .flatMap(ur => ur.role.rolePermissions)
      .map(rp => rp.permission.key) || [];

  console.log(`✓ Admin user has ${adminUserPermissions.length} permissions`);
  console.log(
    `✓ Admin can manage users: ${
      adminUserPermissions.includes("users.read") &&
      adminUserPermissions.includes("users.create") &&
      adminUserPermissions.includes("users.update") &&
      adminUserPermissions.includes("users.delete")
    }`
  );
  console.log(
    `✓ Admin can manage roles: ${adminUserPermissions.includes("system.roles")}`
  );

  console.log("✅ Users, roles, and permissions seeded successfully");
}

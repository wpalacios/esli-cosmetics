import type { PermissionKey } from "@esli-cosmetics/types/auth";

export type SidebarSubItem = {
  titleKey: string;
  url: string;
  requiredPermission?: PermissionKey;
};

export type SidebarItem = {
  titleKey: string;
  icon: string;
  url?: string;
  requiredPermission?: PermissionKey;
  items: SidebarSubItem[];
};

export type SidebarSection = {
  labelKey: string;
  items: SidebarItem[];
};

// Navigation data for the sidebar - uses i18n translation keys
export const NAV_DATA: SidebarSection[] = [
  {
    labelKey: "nav.mainMenu",
    items: [
      {
        titleKey: "nav.dashboard.title",
        icon: "HomeIcon",
        items: [
          {
            titleKey: "nav.dashboard.overview",
            url: "/dashboard",
            requiredPermission: "system.admin",
          },
        ],
      },
      {
        titleKey: "nav.inventory.title",
        icon: "PackageIcon",
        items: [
          {
            titleKey: "nav.inventory.branches",
            url: "/inventory/branches",
            requiredPermission: "branch.create",
          },
          {
            titleKey: "nav.inventory.warehouses",
            url: "/inventory/warehouse",
            requiredPermission: "warehouse.create",
          },
          {
            titleKey: "nav.inventory.categories",
            url: "/inventory/categories",
            requiredPermission: "categories.create",
          },
          {
            titleKey: "nav.inventory.brands",
            url: "/inventory/brands",
            requiredPermission: "brands.create",
          },
          {
            titleKey: "nav.inventory.products",
            url: "/inventory/products",
            requiredPermission: "products.create",
          },
          {
            titleKey: "nav.inventory.prices",
            url: "/inventory/prices",
            requiredPermission: "prices.create",
          },
          {
            titleKey: "nav.inventory.suppliers",
            url: "/inventory/suppliers",
            requiredPermission: "supplier.create",
          },
          {
            titleKey: "nav.inventory.supplierOrders",
            url: "/inventory/supplier-orders",
            requiredPermission: "supplier-orders.create",
          },
          {
            titleKey: "nav.stock.stockLevels",
            url: "/stock/stock-levels",
            requiredPermission: "stock-levels.create",
          },
          {
            titleKey: "nav.stock.stockMovements",
            url: "/stock/stock-movements",
            requiredPermission: "stock-movements.create",
          },
          {
            titleKey: "nav.stock.stockTransfers",
            url: "/stock/transfers",
            requiredPermission: "stock-transfers.create",
          },
        ],
      },
      {
        titleKey: "nav.sales.title",
        icon: "ShoppingCartIcon",
        items: [
          {
            titleKey: "nav.sales.pos",
            url: "/sales/pos",
            requiredPermission: "pos.access",
          },
          {
            titleKey: "nav.sales.orders",
            url: "/sales/orders",
            requiredPermission: "orders.create",
          },
          {
            titleKey: "nav.sales.quotes",
            url: "/sales/quotes",
            requiredPermission: "quotes.create",
          },
          {
            titleKey: "nav.sales.customerTypes",
            url: "/sales/customer-types",
            requiredPermission: "customer_types.create",
          },
          {
            titleKey: "nav.sales.customers",
            url: "/sales/customers",
            requiredPermission: "customers.create",
          },
          {
            titleKey: "nav.sales.discountCodes",
            url: "/sales/discount-codes",
            requiredPermission: "discount_codes.create",
          },
        ],
      },
      {
        titleKey: "nav.reports.title",
        icon: "ChartBarIcon",
        items: [
          {
            titleKey: "nav.reports.salesReport",
            url: "/reports/sales/customers",
            requiredPermission: "reports.sales",
          },
          {
            titleKey: "nav.reports.salesProductsReport",
            url: "/reports/sales/products",
            requiredPermission: "reports.sales",
          },
          {
            titleKey: "nav.reports.stockMovementsReport",
            url: "/reports/stock-movements",
            requiredPermission: "reports.inventory",
          },
        ],
      },
    ],
  },
  {
    labelKey: "nav.system",
    items: [
      {
        titleKey: "nav.admin.title",
        icon: "ShieldIcon",
        items: [
          {
            titleKey: "nav.admin.roles",
            url: "/admin/roles",
            requiredPermission: "system.roles",
          },
          {
            titleKey: "nav.admin.permissions",
            url: "/admin/permissions",
            requiredPermission: "system.roles",
          },
          {
            titleKey: "nav.admin.users",
            url: "/admin/users",
            requiredPermission: "users.create",
          },
          {
            titleKey: "nav.hr.employees",
            url: "/admin/employees",
            requiredPermission: "employees.create",
          },
          {
            titleKey: "nav.admin.cashRegisters",
            url: "/admin/cash-registers",
            requiredPermission: "cash_registers.create",
          },
        ],
      },
      {
        titleKey: "nav.notifications",
        icon: "BellSidebarIcon",
        url: "/notifications",
        items: [],
      },
      {
        titleKey: "nav.profile",
        icon: "UsersIcon",
        url: "/profile",
        items: [],
      },
    ],
  },
];

import { Metadata } from "next";
import { redirect } from "next/navigation";
import { SupplierOrdersPageClient } from "./supplier-order-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getSupplierOrders } from "@/actions/supplier-order";
import { getSuppliers } from "@/actions/suppliers";
import { searchProductVariants } from "@/actions/product-variants";
import { getBrands } from "@/actions/brands";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Supplier Orders | Esli Cosmetics",
  description: "Manage purchase orders to suppliers",
};

export default async function SupplierOrdersPage() {
  // Check authentication - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canRead = await hasPermission("supplier-orders.read");
  if (!canRead) redirect("/login");

  // Fetch Orders and Catalogs for Form
  const [initialData, suppliersData, productVariants, brandsData] =
    await Promise.all([
      getSupplierOrders({ page: 1, limit: 10 }),
      getSuppliers({ limit: 100 }),
      searchProductVariants({ query: "*" }),
      getBrands({ limit: 100 }),
    ]);

  return (
    <SupplierOrdersPageClient
      initialData={initialData}
      supplierOptions={suppliersData.data}
      productVariantOptions={productVariants ?? []}
      brandOptions={brandsData.data}
    />
  );
}

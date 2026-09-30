import { getProducts } from "@/actions";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { ProductsResponse } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProductsPageClient } from "./products-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Productos",
  description: "Administra tus productos",
};

async function getProductsData(): Promise<ProductsResponse> {
  try {
    const data = await getProducts({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch products:", error);
    // Return empty data structure on error
    return {
      products: [],
      total: 0,
      page: 1,
      limit: 10,
    };
  }
}

export default async function ProductsPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadProducts = await hasPermission("products.read");
  if (!canReadProducts) {
    redirect("/login");
  }

  const initialData = await getProductsData();

  return <ProductsPageClient initialData={initialData} />;
}

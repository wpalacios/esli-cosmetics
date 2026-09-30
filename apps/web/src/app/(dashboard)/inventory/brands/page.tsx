import { Metadata } from "next";
import { BrandsPageClient } from "./brands-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getBrands } from "@/actions/brands";
import { BrandsResponse } from "@esli-cosmetics/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Brands | Esli Cosmetics",
  description: "Manage your product brands and suppliers",
};

// Server-side data fetching with authentication
async function getBrandsData(): Promise<BrandsResponse> {
  try {
    // Fetch data using server action
    const data = await getBrands({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch brands:", error);
    // Return empty data structure on error
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
      },
    };
  }
}

export default async function BrandsPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Check if user has permission to read brands
  const canReadBrands = await hasPermission("brands.read");
  if (!canReadBrands) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getBrandsData();

  return <BrandsPageClient initialData={initialData} />;
}

import { getWarehouses } from "@/actions/warehouses";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { WarehousesResponse } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { WarehousesPageClient } from "./warehouse-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Warehouses | Esli Cosmetics",
  description: "Manage your warehouses and storage locations",
};

// Server-side data fetching with authentication
async function getWarehousesData(): Promise<WarehousesResponse> {
  try {
    // Fetch data using server action
    const data = await getWarehouses({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch warehouses:", error);
    // Return empty data structure on error
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
}

export default async function WarehousesPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Check if user has permission to read warehouses
  const canReadWarehouses = await hasPermission("warehouse.read");
  if (!canReadWarehouses) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getWarehousesData();

  return <WarehousesPageClient initialData={initialData} />;
}

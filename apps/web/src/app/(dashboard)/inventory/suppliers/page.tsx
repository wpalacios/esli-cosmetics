import { Metadata } from "next";
import { SuppliersPageClient } from "./suppliers-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getSuppliers } from "@/actions/suppliers";
import { SuppliersResponse } from "@esli-cosmetics/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Suppliers | Esli Cosmetics",
  description: "Manage your suppliers and vendors",
};

// Server-side data fetching with authentication
async function getSuppliersData(): Promise<SuppliersResponse> {
  try {
    // Fetch data using server action
    const data = await getSuppliers({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch suppliers:", error);
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

export default async function SuppliersPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Check if user has permission to read suppliers
  const canReadSuppliers = await hasPermission("supplier.read");
  if (!canReadSuppliers) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getSuppliersData();

  return <SuppliersPageClient initialData={initialData} />;
}

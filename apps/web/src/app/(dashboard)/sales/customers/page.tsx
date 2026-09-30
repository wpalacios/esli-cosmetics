import { getCustomers } from "@/actions/customers";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { CustomersResponse } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomersPageClient } from "./customers-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customers | Esli Cosmetics",
  description: "Manage your customers and their information",
};

// Server-side data fetching with authentication
async function getCustomersData(): Promise<CustomersResponse> {
  try {
    // Fetch data using server action
    const data = await getCustomers({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch customers:", error);
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

export default async function CustomersPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Check if user has permission to read customers
  const canReadCustomers = await hasPermission("customers.read");
  if (!canReadCustomers) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getCustomersData();

  return <CustomersPageClient initialData={initialData} />;
}

import { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  hasRole,
  hasPermission,
  shouldRedirectToLogin,
} from "@/lib/auth/server-auth";
import { getSalesItems } from "@/actions/reports";
import ReportSalesCustomersPageClient from "./reports-page-client";
import type { SalesItemsResponse } from "@esli-cosmetics/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports | Esli Cosmetics",
  description: "Preview and export sales by customer reports",
};

async function getInitialData(): Promise<SalesItemsResponse> {
  try {
    const canExport = await hasPermission("reports.export");
    if (!canExport) {
      throw new Error("Insufficient permissions");
    }

    return await getSalesItems({ page: 1, limit: 20 });
  } catch (error) {
    console.error("Failed to fetch sales-by-customer initial data:", error);
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

export default async function SalesByCustomerReportPage() {
  // Check authentication - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Reports are only accessible to ADMIN
  const isAdmin = await hasRole("admin");
  if (!isAdmin) {
    redirect("/dashboard");
  }

  const initialData = await getInitialData();

  return <ReportSalesCustomersPageClient initialData={initialData} />;
}

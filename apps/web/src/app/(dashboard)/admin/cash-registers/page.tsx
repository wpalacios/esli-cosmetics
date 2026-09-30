import { Metadata } from "next";
import { redirect } from "next/navigation";
import { CashRegistersPageClient } from "./cash-registers-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getCashRegisters } from "@/actions/cash-register";
import { CashRegistersResponse } from "@esli-cosmetics/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cash Registers | Esli Cosmetics",
  description: "Manage cash registers for your locations",
};

// Server-side data fetching with authentication
async function getCashRegistersData(): Promise<CashRegistersResponse> {
  try {
    // Fetch data using server action
    const data = await getCashRegisters({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch cash registers:", error);
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

export default async function CashRegistersPage() {
  // Check authentication - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadCashRegisters = await hasPermission("cash_registers.view");
  if (!canReadCashRegisters) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getCashRegistersData();

  return <CashRegistersPageClient initialData={initialData} />;
}

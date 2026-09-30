import { getDiscountCodes } from "@/actions/discount-codes";
import {
  hasPermission,
  hasRole,
  shouldRedirectToLogin,
} from "@/lib/auth/server-auth";
import { DiscountCodesResponse } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { DiscountCodesPageClient } from "./discount-codes-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discount Codes | Esli Cosmetics",
  description: "Manage discount codes and promotions",
};

// Server-side data fetching with authentication
async function getDiscountCodesData(): Promise<DiscountCodesResponse> {
  try {
    // Fetch data using server action
    const data = await getDiscountCodes({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch discount codes:", error);
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

export default async function DiscountCodesPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const isAdmin = await hasRole("admin");
  const isStoreManager = await hasRole("store_manager");

  // Check if user has permission to read discount codes
  const canReadDiscountCodes = await hasPermission("discount_codes.read");
  if (!canReadDiscountCodes) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getDiscountCodesData();

  return <DiscountCodesPageClient initialData={initialData} />;
}

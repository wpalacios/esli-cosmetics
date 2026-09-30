import { getStockLevels } from "@/actions";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { StockLevelsResponse } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { StockLevelsPageClient } from "./stock-levels-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stock Config - Esli Cosmetics",
  description: "Manage stock levels across all locations",
};

async function getStockLevelsData(): Promise<StockLevelsResponse> {
  try {
    const data = await getStockLevels(1, 10);
    return data;
  } catch (error) {
    console.error("Failed to fetch stock levels:", error);
    return {
      stockLevels: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    };
  }
}

export default async function StockConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canRead = await hasPermission("stock-levels.read");
  if (!canRead) {
    redirect("/login");
  }

  const initialData = await getStockLevelsData();
  const resolvedSearchParams = await searchParams;
  const initialSearchQuery = resolvedSearchParams?.q || "";

  return (
    <StockLevelsPageClient
      initialData={initialData}
      initialSearchQuery={initialSearchQuery}
    />
  );
}

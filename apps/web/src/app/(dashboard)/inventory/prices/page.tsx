import { getPrices } from "@/actions/prices";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { PricesResponse } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { PricesPageClient } from "./prices-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Precios",
  description: "Administra los tipos de precios",
};

const initialEmptyData: PricesResponse = {
  data: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  },
};

async function getInitialPricesData(canRead: boolean): Promise<PricesResponse> {
  if (!canRead) {
    return initialEmptyData;
  }

  try {
    const data = await getPrices({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch prices initial data:", error);
    return initialEmptyData;
  }
}

export default async function PricesPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadPrices = await hasPermission("prices.read");
  if (!canReadPrices) {
    redirect("/login");
  }
  const initialData = await getInitialPricesData(canReadPrices);

  return <PricesPageClient initialData={initialData} />;
}

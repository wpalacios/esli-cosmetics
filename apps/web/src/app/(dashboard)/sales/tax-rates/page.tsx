import { getTaxRates } from "@/actions/tax-rates";
import {
  hasPermission,
  hasRole,
  shouldRedirectToLogin,
} from "@/lib/auth/server-auth";
import { PaginatedTaxRates } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { TaxRatesPageClient } from "./tax-rates-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tasas de Impuestos",
  description: "Administra las tasas de impuestos (IVA, etc.)",
};

const initialEmptyData: PaginatedTaxRates = {
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

async function getInitialTaxRatesData(
  canRead: boolean
): Promise<PaginatedTaxRates> {
  if (!canRead) {
    return initialEmptyData;
  }

  try {
    const data = await getTaxRates({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch tax rates initial data:", error);
    return initialEmptyData;
  }
}

export default async function TaxRatesPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const isAdmin = await hasRole("admin");
  const isStoreManager = await hasRole("store_manager");

  if (!isAdmin && !isStoreManager) {
    redirect("/dashboard");
  }

  const canReadTaxRates = await hasPermission("tax.rates.read");
  if (!canReadTaxRates) {
    redirect("/login");
  }
  const initialData = await getInitialTaxRatesData(canReadTaxRates);

  return <TaxRatesPageClient initialData={initialData} />;
}

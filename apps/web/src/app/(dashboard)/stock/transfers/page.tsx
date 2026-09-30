import {
  getStockTransfers,
  StockTransfersResponse,
} from "@/actions/stock-transfers";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { StockTransfersPageClient } from "./stock-transfers-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stock Transfers",
  description: "Manage and view stock transfers",
};

async function getTransfersData(): Promise<StockTransfersResponse> {
  try {
    const data = await getStockTransfers({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Error fetching stock transfers:", error);
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

export default async function StockTransfersPage() {
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadTransfers = await hasPermission("stock-transfers.read");
  if (!canReadTransfers) {
    redirect("/login");
  }

  const initialData = await getTransfersData();

  return <StockTransfersPageClient initialData={initialData} />;
}

import { getStockTransfer } from "@/actions/stock-transfers";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { StockTransferDetailClient } from "./stock-transfer-detail-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stock Transfer Details",
  description: "View stock transfer details",
};

async function getTransferData(id: string) {
  try {
    const data = await getStockTransfer(id);
    return data;
  } catch (error) {
    console.error("Error fetching stock transfer:", error);
    return null;
  }
}

export default async function StockTransferDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadTransfers = await hasPermission("stock-transfers.read");
  if (!canReadTransfers) {
    redirect("/login");
  }

  const transfer = await getTransferData(params.id);

  if (!transfer) {
    notFound();
  }

  return <StockTransferDetailClient initialData={transfer} />;
}

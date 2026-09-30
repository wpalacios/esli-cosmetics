import { getOrders, OrdersResponse } from "@/actions/orders";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrdersPageClient } from "./orders-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders",
  description: "Manage and view orders",
};

async function getOrdersData(): Promise<OrdersResponse> {
  try {
    const data = await getOrders({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Error fetching orders:", error);
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

export default async function OrdersPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadOrders = await hasPermission("orders.read");
  if (!canReadOrders) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getOrdersData();

  return <OrdersPageClient initialData={initialData} />;
}

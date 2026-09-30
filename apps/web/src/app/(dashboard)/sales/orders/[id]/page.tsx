import { getOrder } from "@/actions/orders";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { OrderViewPageClient } from "./order-view-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Details",
  description: "View order details",
};

export default async function OrderViewPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = await params; // Get order ID from params for dinamyc rendering

  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadOrders = await hasPermission("orders.read");
  if (!canReadOrders) {
    redirect("/login");
  }

  // Fetch order data
  let order = null;
  try {
    order = await getOrder(id);
  } catch (error) {
    console.error("Error fetching order:", error);
  }

  if (!order) {
    redirect("/sales/orders");
  }

  return <OrderViewPageClient order={order} />;
}

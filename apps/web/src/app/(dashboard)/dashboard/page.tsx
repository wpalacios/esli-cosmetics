import { Suspense } from "react";
import { redirect } from "next/navigation";
import { DashboardClient } from "./dashboard-client";
import { DashboardSkeleton } from "./dashboard-skeleton";
import {
  hasRole,
  getServerUser,
  shouldRedirectToLogin,
} from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Check authentication - only redirect if no user AND no refresh token
  // If refresh token exists, let client-side handle refresh via RouteGuard
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Get user (may be null if token expired but refresh token exists)
  const user = await getServerUser();

  // If no user but refresh token exists, render page anyway
  // RouteGuard will handle client-side refresh and redirect if needed
  if (!user) {
    return (
      <div className="space-y-6">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardClient />
        </Suspense>
      </div>
    );
  }

  // Dashboard is only accessible to ADMIN
  const isAdmin = await hasRole("admin");
  if (!isAdmin) {
    // Redirect based on role
    const isStoreManager = await hasRole("store_manager");
    const isInventoryManager = await hasRole("inventory_manager");
    const isCashier = await hasRole("cashier");

    if (isStoreManager) {
      redirect("/sales/orders");
    } else if (isInventoryManager) {
      redirect("/stock/stock-levels");
    } else if (isCashier) {
      redirect("/sales/pos");
    } else {
      redirect("/login");
    }
  }

  return (
    <div className="space-y-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardClient />
      </Suspense>
    </div>
  );
}

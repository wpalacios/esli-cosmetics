import { getCustomerTypes } from "@/actions/customer-types";
import {
  hasPermission,
  hasRole,
  shouldRedirectToLogin,
} from "@/lib/auth/server-auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CustomerTypesPageClient } from "./customer-types-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customer Types",
  description: "Manage customer types",
};

export default async function CustomerTypesPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const isAdmin = await hasRole("admin");
  const isStoreManager = await hasRole("store_manager");

  if (!isAdmin && !isStoreManager) {
    redirect("/dashboard");
  }

  const canAccessCustomerTypes = await hasPermission("customer_types.read");

  if (!canAccessCustomerTypes) {
    redirect("/login");
  }

  const initialData = await getCustomerTypes({ page: 1, limit: 10 });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CustomerTypesPageClient initialData={initialData} />
    </Suspense>
  );
}

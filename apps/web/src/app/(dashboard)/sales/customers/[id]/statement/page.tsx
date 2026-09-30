import { getCustomer, getCustomerAccountStatement } from "@/actions/customers";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { StatementPageClient } from "./statement-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Account Statement | Esli Cosmetics",
  description: "View customer account statement",
};

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; page?: string }>;
}) {
  // Check authentication
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Check if user has permission to read customers
  const canReadCustomers = await hasPermission("customers.read");
  if (!canReadCustomers) {
    redirect("/login");
  }

  // Await params and searchParams (Next.js 15+ requirement)
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  // Fetch customer and initial statement data
  const [customer, initialStatement] = await Promise.all([
    getCustomer(id).catch(() => null),
    getCustomerAccountStatement({
      customerId: id,
      ...(resolvedSearchParams.from && { from: resolvedSearchParams.from }),
      ...(resolvedSearchParams.to && { to: resolvedSearchParams.to }),
      ...(resolvedSearchParams.page && {
        page: Number.parseInt(resolvedSearchParams.page, 10),
      }),
      limit: 10,
    }).catch(() => null),
  ]);

  if (!customer) {
    redirect("/sales/customers");
  }

  return (
    <StatementPageClient
      customer={customer}
      initialStatement={initialStatement}
      customerId={id}
    />
  );
}

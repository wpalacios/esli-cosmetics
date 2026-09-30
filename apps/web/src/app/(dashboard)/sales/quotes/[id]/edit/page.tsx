import { redirect } from "next/navigation";
import { shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { RouteGuard } from "@/components/guards/route-guard";
import { EditQuotePageClient } from "./edit-quote-page-client";
import { getQuote } from "@/actions/quotes";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Await params before using its properties (Next.js 15+ requirement)
  const { id } = await params;

  // Check authentication server-side - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Fetch quote server-side to check if it exists and is not deleted
  let quote;
  try {
    quote = await getQuote(id);
  } catch (error) {
    console.error("Error fetching quote:", error);
    redirect("/sales/quotes");
  }

  if (!quote) {
    redirect("/sales/quotes");
  }

  return (
    <RouteGuard
      allowedRoles={["admin", "store_manager", "cashier", "sales_rep"]}
      checkSession={false}
    >
      <EditQuotePageClient quoteId={id} initialQuote={quote} />
    </RouteGuard>
  );
}

import { redirect } from "next/navigation";
import { shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { RouteGuard } from "@/components/guards/route-guard";
import { NewQuotePageClient } from "./new-quote-page-client";

export const dynamic = "force-dynamic";

export default async function NewQuotePage() {
  // Check authentication server-side - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Session is validated server-side, now check roles client-side
  // checkSession=false because authentication is already validated server-side
  return (
    <RouteGuard
      allowedRoles={["admin", "store_manager", "cashier", "sales_rep"]}
      checkSession={false}
    >
      <NewQuotePageClient />
    </RouteGuard>
  );
}

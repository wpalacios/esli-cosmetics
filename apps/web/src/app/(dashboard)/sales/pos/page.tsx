import { redirect } from "next/navigation";
import { shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { POSPage } from "./pos-page-client";
import { RouteGuard } from "@/components/guards/route-guard";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Check authentication server-side - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Session is validated server-side, now check roles client-side
  // checkSession=false because authentication is already validated server-side
  return (
    <RouteGuard
      allowedRoles={["admin", "store_manager", "cashier"]}
      checkSession={false}
    >
      <POSPage />
    </RouteGuard>
  );
}

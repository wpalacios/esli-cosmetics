import { getQuote } from "@/actions/quotes";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuoteViewPageClient } from "./quote-view-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quote Details",
  description: "View quote details",
};

export default async function QuoteViewPage({
  params,
}: {
  params: { id: string };
}) {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadQuotes = await hasPermission("quotes.read");
  if (!canReadQuotes) {
    redirect("/login");
  }

  let quote;
  try {
    quote = await getQuote(params.id);
  } catch (error) {
    console.error("Error fetching quote:", error);
    redirect("/sales/quotes");
  }

  if (!quote) {
    redirect("/sales/quotes");
  }

  return <QuoteViewPageClient quote={quote} />;
}

import { getQuotes } from "@/actions/quotes";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import type { PaginatedQuotes } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { QuotesPageClient } from "./quotes-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quotes",
  description: "Manage and view quotes",
};

async function getQuotesData(): Promise<PaginatedQuotes> {
  try {
    const data = await getQuotes({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Error fetching quotes:", error);
    return {
      data: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    };
  }
}

export default async function QuotesPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadQuotes = await hasPermission("quotes.read");
  if (!canReadQuotes) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getQuotesData();

  return <QuotesPageClient initialData={initialData} />;
}

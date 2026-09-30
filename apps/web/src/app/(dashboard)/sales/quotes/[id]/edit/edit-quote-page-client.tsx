"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { QuotePage } from "../../quote-page-client";
import { useQuote } from "~/hooks/use-quotes";
import { Quote } from "@esli-cosmetics/types";

type EditQuotePageClientProps = {
  quoteId: string;
  initialQuote?: Quote;
};

export function EditQuotePageClient({
  quoteId,
  initialQuote,
}: EditQuotePageClientProps) {
  const { t } = useTranslation("quotes");
  const router = useRouter();
  // Load existing quote if in edit mode, using server-fetched quote as initialData to avoid double fetch
  const { data: existingQuote, isLoading: isLoadingQuote } = useQuote(
    quoteId,
    initialQuote
  );

  // Validate mathematical consistency to detect stale browser cache
  useEffect(() => {
    if (
      existingQuote &&
      existingQuote.items &&
      existingQuote.items.length > 0
    ) {
      const headerTotal = Number(existingQuote.totalAmount || 0);

      // Calculate current items total sum (raw subtotal)
      const itemsSum = existingQuote.items.reduce(
        (acc, item) => acc + Number(item.unitPrice) * item.quantity,
        0
      );

      // If difference between header and items sum is greater than 15%, force refresh
      // This solves the issue where Chrome serves a new header with old items
      const diffPercentage =
        headerTotal > 0 ? Math.abs(headerTotal - itemsSum) / headerTotal : 0;

      if (diffPercentage > 0.15) {
        const sessionKey = `sync_check_${existingQuote.id}`;
        if (!window.sessionStorage.getItem(sessionKey)) {
          window.sessionStorage.setItem(sessionKey, "1");
          console.error(
            `Data inconsistency detected (${(diffPercentage * 100).toFixed(2)}%). Forcing fresh sync.`
          );
          window.location.reload();
        }
      } else {
        window.sessionStorage.removeItem(`sync_check_${existingQuote.id}`);
      }
    }
  }, [existingQuote]);

  // Stable key: avoid remount on approve/save (updatedAt changes) or the cart resets to [].
  // Data inconsistency between header and lines is handled by the sync check effect above (reload).
  const quoteKey = quoteId;

  // Redirect if quote is annulled
  useEffect(() => {
    if (existingQuote && existingQuote.status === "ANNULLED") {
      router.back();
    }
  }, [existingQuote, router]);

  if (isLoadingQuote) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md rounded-lg bg-white p-8 text-center shadow-lg dark:bg-gray-800">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[#ff48b0]" />
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
            {t("common.loading") || "Loading..."}
          </h2>
        </div>
      </div>
    );
  }

  // Don't render if quote is annulled (redirecting)
  if (existingQuote && existingQuote.status === "ANNULLED") {
    return null;
  }

  return (
    <QuotePage
      key={quoteKey}
      title={t("page.editTitle", {
        quoteNumber: existingQuote?.quoteNumber || existingQuote?.id || "",
      })}
      existingQuote={(existingQuote as Quote) || undefined}
    />
  );
}

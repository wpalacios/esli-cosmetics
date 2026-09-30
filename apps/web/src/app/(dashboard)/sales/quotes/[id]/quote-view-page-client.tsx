"use client";

import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/toast/use-toast";
import { Button } from "@esli-cosmetics/ui";
import type { Quote } from "@esli-cosmetics/types";
import { useConvertQuoteToOrder } from "@/hooks/use-quotes";
import { formatCurrency } from "@esli-cosmetics/utils";
import { useHasRole } from "@/hooks/use-auth";

interface QuoteViewPageClientProps {
  quote: Quote;
}

export function QuoteViewPageClient({ quote }: QuoteViewPageClientProps) {
  const { t } = useTranslation("quotes");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();
  const { toast } = useToast();
  const convertMutation = useConvertQuoteToOrder();

  const isSalesRep = useHasRole("sales_rep");
  const canConvert = quote.status !== "CONVERTED" && quote.status !== "EXPIRED";

  const handleConvertToOrder = async () => {
    // This would open a modal similar to checkout modal
    // For now, we'll show a placeholder
    toast({
      type: "info",
      title: t("convertToOrder"),
      description: t("errors.noCashSessionMessage"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("view.title", {
              quoteNumber: quote.quoteNumber || `#${quote.id.slice(0, 8)}`,
            })}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("view.createdOn")}{" "}
            {new Date(quote.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
          {canConvert && !isSalesRep && (
            <Button onClick={handleConvertToOrder} className="w-full md:w-auto">
              {t("convertToOrder")}
            </Button>
          )}
          {quote.status !== "CONVERTED" && (
            <Button
              variant="outline"
              onClick={() => router.push(`/sales/quotes/${quote.id}/edit`)}
              className="w-full md:w-auto"
            >
              {t("table.edit")}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push("/sales/quotes")}
            className="w-full md:w-auto"
          >
            {tCommon("common.back")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            {t("view.quoteDetails")}
          </h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t("table.status")}
              </dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {quote.status}
              </dd>
            </div>
            {quote.customer && (
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  {t("table.customer")}
                </dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {quote.customer.person
                    ? `${quote.customer.person.firstName || ""} ${quote.customer.person.lastName || ""}`.trim()
                    : t("view.unknown")}
                </dd>
              </div>
            )}
            {quote.location && (
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  {t("table.location")}
                </dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {quote.location.name}
                </dd>
              </div>
            )}
            {quote.validUntil && (
              <div>
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  {t("view.validUntil")}
                </dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {new Date(quote.validUntil).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
            {t("view.totals")}
          </h2>
          <dl className="space-y-2">
            <div className="flex justify-between">
              <dt className="text-sm text-gray-500 dark:text-gray-400">
                {t("view.subtotal")}
              </dt>
              <dd className="font-medium text-gray-900 dark:text-white">
                {formatCurrency(quote.subtotal || 0)}
              </dd>
            </div>
            {quote.discountAmount && quote.discountAmount > 0 && (
              <div className="flex justify-between text-red-600 dark:text-red-400">
                <dt className="text-sm">{t("view.discount")}</dt>
                <dd className="font-medium">
                  -{formatCurrency(quote.discountAmount)}
                </dd>
              </div>
            )}
            {quote.taxes && quote.taxes > 0 && (
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">
                  {t("view.tax")}
                </dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(quote.taxes)}
                </dd>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900 dark:border-gray-700 dark:text-white">
              <dt>{t("view.total")}</dt>
              <dd className="text-[#ff48b0]">
                {formatCurrency(quote.totalAmount || 0)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
          {t("view.items")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="p-2 text-left text-gray-900 dark:text-white">
                  {t("view.product")}
                </th>
                <th className="p-2 text-right text-gray-900 dark:text-white">
                  {t("view.quantity")}
                </th>
                <th className="p-2 text-right text-gray-900 dark:text-white">
                  {t("view.unitPrice")}
                </th>
                <th className="p-2 text-right text-gray-900 dark:text-white">
                  {t("view.discount")}
                </th>
                <th className="p-2 text-right text-gray-900 dark:text-white">
                  {t("view.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.items?.map(item => (
                <tr
                  key={item.id}
                  className="border-b border-gray-200 dark:border-gray-700"
                >
                  <td className="p-2 text-gray-900 dark:text-gray-100">
                    {item.productVariant?.product?.name ||
                      item.product?.name ||
                      t("view.unknown")}
                  </td>
                  <td className="p-2 text-right text-gray-900 dark:text-gray-100">
                    {item.quantity}
                  </td>
                  <td className="p-2 text-right text-gray-900 dark:text-gray-100">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="p-2 text-right text-red-600 dark:text-red-400">
                    {item.discountAmount
                      ? `-${formatCurrency(item.discountAmount)}`
                      : "-"}
                  </td>
                  <td className="p-2 text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(item.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

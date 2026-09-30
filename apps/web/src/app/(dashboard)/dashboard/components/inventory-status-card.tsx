import { Card } from "@esli-cosmetics/ui";
import { useTranslation } from "react-i18next";
import { FaExclamationTriangle, FaCheckCircle, FaBox } from "react-icons/fa";
import { formatNumber } from "@esli-cosmetics/utils";
import Link from "next/link";

type InventoryStatusCardProps = {
  lowStockCount: number;
  totalItems: number;
};

export function InventoryStatusCard({
  lowStockCount,
  totalItems,
}: InventoryStatusCardProps) {
  const { t } = useTranslation("dashboard");
  const hasLowStock = lowStockCount > 0;
  const stockStatus = hasLowStock ? "warning" : "success";

  return (
    <Card
      title={t("cards.inventory.title")}
      subtitle={t("cards.inventory.subtitle")}
      variant="glass"
      padding="md"
      className="lg:col-span-1"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-3 ${
                stockStatus === "warning"
                  ? "bg-yellow-100 dark:bg-yellow-900/20"
                  : "bg-green-100 dark:bg-green-900/20"
              }`}
            >
              {hasLowStock ? (
                <FaExclamationTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              ) : (
                <FaCheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              )}
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatNumber(lowStockCount)}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t("cards.inventory.lowStockItems")}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
          <FaBox className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {t("cards.inventory.totalItems")}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatNumber(totalItems)} {t("cards.inventory.trackedItems")}
            </p>
          </div>
        </div>

        {hasLowStock && (
          <Link
            href="/inventory/stock-levels"
            className="block rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-center text-sm font-medium text-yellow-800 transition-colors hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 dark:hover:bg-yellow-900/30"
          >
            {t("cards.inventory.viewLowStock")}
          </Link>
        )}
      </div>
    </Card>
  );
}

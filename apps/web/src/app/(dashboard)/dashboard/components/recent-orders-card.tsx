import { Card } from "@esli-cosmetics/ui";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "@esli-cosmetics/utils";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { FaShoppingCart } from "react-icons/fa";
import type { Order } from "@/actions/orders";

type RecentOrdersCardProps = {
  orders: Order[];
};

export function RecentOrdersCard({ orders }: RecentOrdersCardProps) {
  const { t } = useTranslation("dashboard");

  if (!orders || orders.length === 0) {
    return (
      <Card
        title={t("cards.recentOrders.title")}
        subtitle={t("cards.recentOrders.subtitle")}
        variant="glass"
        padding="md"
        className="lg:col-span-1"
      >
        <div className="flex h-64 flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <FaShoppingCart className="mb-2 h-8 w-8" />
          <p className="text-sm">{t("cards.recentOrders.noOrders")}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={t("cards.recentOrders.title")}
      subtitle={t("cards.recentOrders.subtitle")}
      variant="glass"
      padding="md"
      className="lg:col-span-1"
      footer={
        <Link
          href="/sales/orders"
          className="block text-center text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
        >
          {t("cards.recentOrders.viewAll")} →
        </Link>
      }
    >
      <div className="space-y-3">
        {orders.map(order => (
          <Link
            key={order.id}
            href={`/sales/orders/${order.id}`}
            className="block rounded-lg border border-gray-200 p-3 transition-colors hover:border-primary-300 hover:bg-primary-50/50 dark:border-gray-700 dark:hover:border-primary-700 dark:hover:bg-primary-900/20"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {order.orderNumber || "N/A"}
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {order.customer?.name ||
                    t("cards.recentOrders.walkInCustomer")}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                  {formatDistanceToNow(new Date(order.createdAt), {
                    addSuffix: true,
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatCurrency(order.totalAmount || 0)}
                </p>
                {order.status && (
                  <span
                    className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      order.status === "COMPLETED"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : order.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                    }`}
                  >
                    {order.status}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}

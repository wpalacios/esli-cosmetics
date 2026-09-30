"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDashboardStats,
  useDashboardSalesTrend,
  useDashboardRevenue,
  useDashboardTopProducts,
  useDashboardStockInCost,
  getDefaultDashboardChartRange,
} from "@/hooks/use-dashboard";
import { formatCurrency, formatNumber } from "@esli-cosmetics/utils";
import { StatCard } from "./components/stat-card";
import { SalesTrendChart } from "./components/sales-trend-chart";
import { RevenueChart } from "./components/revenue-chart";
import { TopProductsChart } from "./components/top-products-chart";
import { PeriodTotalChart } from "./components/period-total-chart";
import { DashboardHeader } from "./dashboard-header";
import {
  StoreIcon,
  ShoppingCartIcon,
  DollarSignIcon,
  PackageIcon,
  UsersIcon,
} from "./components/icons";
import { DashboardSkeleton } from "./dashboard-skeleton";

export function DashboardClient() {
  const { t, i18n } = useTranslation("dashboard");
  const [selectedLocationId, setSelectedLocationId] = useState<
    string | undefined
  >();
  const [chartRange, setChartRange] = useState(getDefaultDashboardChartRange);
  const [revenueBranchId, setRevenueBranchId] = useState<string | undefined>();

  const { data: stats, isLoading: statsLoading } =
    useDashboardStats(selectedLocationId);

  const chartParams = useMemo(
    () => ({
      from: chartRange.from,
      to: chartRange.to,
    }),
    [chartRange.from, chartRange.to]
  );

  const { data: salesTrendRaw, isLoading: salesTrendLoading } =
    useDashboardSalesTrend({
      from: chartParams.from,
      to: chartParams.to,
      ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
    });

  const { data: revenueRaw, isLoading: revenueLoading } = useDashboardRevenue({
    from: chartParams.from,
    to: chartParams.to,
    ...(revenueBranchId ? { branchId: revenueBranchId } : {}),
  });

  const { data: topProductsRaw, isLoading: topProductsLoading } =
    useDashboardTopProducts({
      from: chartParams.from,
      to: chartParams.to,
      ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
    });

  const { data: stockInCostRaw, isLoading: stockInCostLoading } =
    useDashboardStockInCost({
      from: chartParams.from,
      to: chartParams.to,
      ...(selectedLocationId ? { locationId: selectedLocationId } : {}),
    });

  const locale = i18n.language === "es" ? "es-ES" : "en-US";

  const salesTrendChartData = useMemo(() => {
    if (!salesTrendRaw) return [];
    return salesTrendRaw.map(d => ({
      date: new Date(d.date + "T12:00:00.000Z").toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      sales: d.sales,
      count: d.count,
    }));
  }, [salesTrendRaw, locale]);

  const revenueChartData = useMemo(() => {
    if (!revenueRaw) return [];
    return revenueRaw.map(d => ({
      date: new Date(d.date + "T12:00:00.000Z").toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      revenue: d.revenue,
    }));
  }, [revenueRaw, locale]);

  const topProductsData = useMemo(() => topProductsRaw ?? [], [topProductsRaw]);

  const stockInCostChartData = useMemo(() => {
    if (!stockInCostRaw) return [];
    return stockInCostRaw.map(d => ({
      date: new Date(d.date + "T12:00:00.000Z").toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      value: d.cost,
    }));
  }, [stockInCostRaw, locale]);

  const totalSalesPeriodChartData = useMemo(() => {
    if (!salesTrendRaw) return [];
    return salesTrendRaw.map(d => ({
      date: new Date(d.date + "T12:00:00.000Z").toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      value: d.sales,
    }));
  }, [salesTrendRaw, locale]);

  if (!stats && statsLoading) {
    return (
      <div className="space-y-6">
        <DashboardHeader
          selectedLocationId={selectedLocationId}
          onLocationChange={setSelectedLocationId}
        />
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        selectedLocationId={selectedLocationId}
        onLocationChange={setSelectedLocationId}
      />

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title={t("stats.activeStores")}
          value={stats?.activeStores ?? 0}
          icon={StoreIcon}
          trend={null}
          variant="primary"
        />
        <StatCard
          title={t("stats.todaysOrders")}
          value={formatNumber(stats?.salesUnits.today ?? 0)}
          subtitle={`${formatNumber(stats?.salesUnits.month ?? 0)} ${t("stats.thisMonth")}`}
          icon={ShoppingCartIcon}
          trend={null}
          variant="success"
        />
        <StatCard
          title={t("stats.todaysSales")}
          value={formatCurrency(stats?.salesAmount.today ?? 0)}
          subtitle={`${formatCurrency(stats?.salesAmount.month ?? 0)} ${t("stats.thisMonth")}`}
          icon={DollarSignIcon}
          trend={null}
          variant="primary"
        />
        <StatCard
          title={t("stats.inventoryItems")}
          value={formatNumber(stats?.inventory.items ?? 0)}
          subtitle={`${stats?.inventory.lowStock ?? 0} ${t("stats.lowStock")}`}
          icon={PackageIcon}
          trend={null}
          variant={(stats?.inventory.lowStock ?? 0) > 0 ? "warning" : "success"}
        />
        <StatCard
          title={t("stats.inventoryValue")}
          value={formatCurrency(stats?.inventory.value ?? 0)}
          subtitle={t("stats.totalInventoryCost")}
          icon={DollarSignIcon}
          trend={null}
          variant="secondary"
        />
        <StatCard
          title={t("stats.lowStockItems")}
          value={formatNumber(stats?.inventory.lowStock ?? 0)}
          subtitle={t("stats.belowLimit")}
          icon={PackageIcon}
          trend={null}
          variant={(stats?.inventory.lowStock ?? 0) > 0 ? "warning" : "success"}
        />
        <StatCard
          title={t("stats.totalCustomers")}
          value={formatNumber(stats?.customersTotal ?? 0)}
          icon={UsersIcon}
          trend={null}
          variant="secondary"
        />
      </div>

      <div className="rounded-xl border border-pink-100/60 bg-white/40 p-4 shadow-sm backdrop-blur-sm dark:border-gray-700 dark:bg-gray-900/40">
        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("charts.periodHint")}
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex min-w-[160px] flex-col gap-1">
            <label
              htmlFor="dashboard-chart-from"
              className="text-xs font-medium text-gray-600 dark:text-gray-400"
            >
              {t("charts.dateFrom")}
            </label>
            <input
              id="dashboard-chart-from"
              type="date"
              value={chartRange.from}
              onChange={e =>
                setChartRange(r => ({ ...r, from: e.target.value }))
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
          <div className="flex min-w-[160px] flex-col gap-1">
            <label
              htmlFor="dashboard-chart-to"
              className="text-xs font-medium text-gray-600 dark:text-gray-400"
            >
              {t("charts.dateTo")}
            </label>
            <input
              id="dashboard-chart-to"
              type="date"
              value={chartRange.to}
              onChange={e => setChartRange(r => ({ ...r, to: e.target.value }))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SalesTrendChart
          data={salesTrendChartData}
          isLoading={salesTrendLoading}
        />
        <PeriodTotalChart
          title={t("charts.salesTotal.title")}
          subtitle={t("charts.salesTotal.subtitle")}
          totalLabel={t("charts.salesTotal.totalLabel")}
          seriesName={t("charts.salesTotal.series")}
          color="#ff48b0"
          data={totalSalesPeriodChartData}
          isLoading={salesTrendLoading}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-1">
        <RevenueChart
          data={revenueChartData}
          isLoading={revenueLoading}
          {...(revenueBranchId ? { branchId: revenueBranchId } : {})}
          onBranchChange={setRevenueBranchId}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PeriodTotalChart
          title={t("charts.stockInCost.title")}
          subtitle={t("charts.stockInCost.subtitle")}
          totalLabel={t("charts.stockInCost.totalLabel")}
          seriesName={t("charts.stockInCost.series")}
          color="#f5b1cc"
          data={stockInCostChartData}
          isLoading={stockInCostLoading}
        />
        <TopProductsChart
          data={topProductsData}
          isLoading={topProductsLoading}
        />
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Card } from "@esli-cosmetics/ui";
import { formatCurrency } from "@esli-cosmetics/utils";
import { BranchSelect } from "@/components/ui/branch-select";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type RevenueChartProps = {
  data: Array<{
    date: string;
    revenue: number;
  }>;
  isLoading?: boolean;
  /** Filter revenue by branch (sucursal); all branches when undefined. */
  branchId?: string;
  onBranchChange?: (branchId: string | undefined) => void;
};

export function RevenueChart({
  data,
  isLoading = false,
  branchId,
  onBranchChange,
}: RevenueChartProps) {
  const { t } = useTranslation("dashboard");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [chartHeight, setChartHeight] = useState(250);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHeight = () => {
      if (window.innerWidth >= 1024) {
        setChartHeight(350);
      } else if (window.innerWidth >= 640) {
        setChartHeight(300);
      } else {
        setChartHeight(250);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const options: ApexOptions = {
    colors: ["#ff48b0"],
    chart: {
      type: "bar",
      toolbar: {
        show: false,
      },
      fontFamily: "inherit",
      foreColor: isDark ? "#9ca3af" : "#374151",
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "50%",
        borderRadius: 4,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"],
    },
    grid: {
      strokeDashArray: 5,
      borderColor: isDark ? "#374151" : "#e5e7eb",
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    xaxis: {
      categories: data.map(d => d.date),
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    yaxis: {
      labels: {
        formatter: value => formatCurrency(value),
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      y: {
        formatter: value => formatCurrency(value),
      },
    },
  };

  const series = [
    {
      name: t("charts.revenue.revenue"),
      data: data.map(d => d.revenue),
    },
  ];

  const showBranchFilter = onBranchChange !== undefined;

  return (
    <Card
      title={t("charts.revenue.title")}
      subtitle={t("charts.revenue.subtitle")}
      variant="glass"
      padding="md"
    >
      {showBranchFilter ? (
        <div className="mb-4 w-full max-w-md">
          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
            {t("charts.revenue.branch")}
          </label>
          <BranchSelect
            value={branchId}
            onChange={onBranchChange}
            placeholder={t("charts.revenue.selectBranch")}
          />
        </div>
      ) : null}
      {isLoading ? (
        <div
          className="flex w-full animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-pink-50/80 to-white dark:from-gray-800/50 dark:to-gray-900/50"
          style={{ height: chartHeight }}
        >
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t("charts.loading")}
          </span>
        </div>
      ) : (
        <div className="-ml-4 -mr-5">
          <Chart
            options={options}
            series={series}
            type="bar"
            height={chartHeight}
          />
        </div>
      )}
    </Card>
  );
}

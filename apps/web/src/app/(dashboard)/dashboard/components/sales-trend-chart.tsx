"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Card } from "@esli-cosmetics/ui";
import { formatCurrency, formatNumber } from "@esli-cosmetics/utils";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type SalesTrendChartProps = {
  data: Array<{
    date: string;
    sales: number;
    count: number;
  }>;
  isLoading?: boolean;
};

export function SalesTrendChart({
  data,
  isLoading = false,
}: SalesTrendChartProps) {
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
    colors: ["#ff48b0", "#f5b1cc"],
    chart: {
      type: "area",
      toolbar: {
        show: false,
      },
      fontFamily: "inherit",
      foreColor: isDark ? "#9ca3af" : "#374151",
    },
    fill: {
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
        stops: [0, 100],
      },
    },
    stroke: {
      curve: "smooth",
      width: 3,
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
    dataLabels: {
      enabled: false,
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
    yaxis: [
      {
        title: {
          text: t("charts.salesTrend.sales"),
        },
        labels: {
          formatter: value => formatCurrency(value),
        },
      },
      {
        opposite: true,
        title: {
          text: t("charts.salesTrend.orders"),
        },
        labels: {
          formatter: value => formatNumber(value),
        },
      },
    ],
    tooltip: {
      theme: isDark ? "dark" : "light",
      shared: true,
      y: {
        formatter: (
          value: number,
          { seriesIndex }: { seriesIndex: number }
        ) => {
          if (seriesIndex === 0) {
            // Sales - format as currency
            return formatCurrency(value);
          } else {
            // Orders - format as number
            return `${formatNumber(value)} ${t("charts.salesTrend.ordersLabel")}`;
          }
        },
      },
    },
    legend: {
      position: "top",
      horizontalAlign: "left",
    },
  };

  const series = [
    {
      name: t("charts.salesTrend.sales"),
      type: "area" as const,
      data: data.map(d => d.sales),
    },
    {
      name: t("charts.salesTrend.orders"),
      type: "line" as const,
      data: data.map(d => d.count),
      yAxisIndex: 1, // Use the second y-axis for orders
    },
  ];

  return (
    <Card
      title={t("charts.salesTrend.title")}
      subtitle={t("charts.salesTrend.subtitle")}
      variant="glass"
      padding="md"
    >
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
            series={series as ApexOptions["series"]}
            type="area"
            height={chartHeight}
          />
        </div>
      )}
    </Card>
  );
}

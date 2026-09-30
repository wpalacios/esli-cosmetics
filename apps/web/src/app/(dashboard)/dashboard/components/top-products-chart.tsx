"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { Card } from "@esli-cosmetics/ui";
import { formatCurrency } from "@esli-cosmetics/utils";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type TopProductsChartProps = {
  data: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
  isLoading?: boolean;
};

export function TopProductsChart({
  data,
  isLoading = false,
}: TopProductsChartProps) {
  const { t } = useTranslation("dashboard");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [chartHeight, setChartHeight] = useState(280);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHeight = () => {
      if (window.innerWidth >= 640) {
        setChartHeight(320);
      } else {
        setChartHeight(280);
      }
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  if (isLoading) {
    return (
      <Card
        title={t("charts.topProducts.title")}
        subtitle={t("charts.topProducts.subtitle")}
        variant="glass"
        padding="md"
        className="lg:col-span-1"
      >
        <div className="flex h-80 w-full animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-pink-50/80 to-white dark:from-gray-800/50 dark:to-gray-900/50">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {t("charts.loading")}
          </span>
        </div>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card
        title={t("charts.topProducts.title")}
        subtitle={t("charts.topProducts.subtitle")}
        variant="glass"
        padding="md"
        className="lg:col-span-1"
      >
        <div className="flex h-64 items-center justify-center text-gray-500 dark:text-gray-400">
          {t("charts.topProducts.empty")}
        </div>
      </Card>
    );
  }

  const options: ApexOptions = {
    colors: ["#ff48b0", "#f5b1cc", "#ff8cc8", "#ffb3d9", "#ffd9ec"],
    chart: {
      type: "donut",
      fontFamily: "inherit",
      foreColor: isDark ? "#9ca3af" : "#374151",
    },
    labels: data.map(d => {
      // Truncate long names
      return d.name.length > 20 ? d.name.substring(0, 20) + "..." : d.name;
    }),
    legend: {
      position: "bottom",
      itemMargin: {
        horizontal: 10,
        vertical: 5,
      },
      fontSize: "12px",
      formatter: (legendName, opts) => {
        const value = data[opts.seriesIndex]?.revenue || 0;
        return `${legendName}: ${formatCurrency(value)}`;
      },
    },
    plotOptions: {
      pie: {
        donut: {
          size: "70%",
          background: "transparent",
          labels: {
            show: true,
            total: {
              show: true,
              showAlways: true,
              label: t("charts.topProducts.totalRevenue"),
              fontSize: "14px",
              fontWeight: 400,
              formatter: () => {
                const total = data.reduce((sum, d) => sum + d.revenue, 0);
                return formatCurrency(total);
              },
            },
            value: {
              show: true,
              fontSize: "20px",
              fontWeight: "bold",
              formatter: val => {
                const index = parseInt(val.toString());
                return formatCurrency(data[index]?.revenue || 0);
              },
            },
          },
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      y: {
        formatter: (value, { seriesIndex }) => {
          const product = data[seriesIndex];
          return `${formatCurrency(product?.revenue || 0)} (${product?.quantity || 0} units)`;
        },
      },
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          legend: {
            fontSize: "10px",
            itemMargin: {
              horizontal: 6,
              vertical: 2,
            },
          },
          plotOptions: {
            pie: {
              donut: {
                size: "60%",
                labels: {
                  total: {
                    fontSize: "11px",
                  },
                  value: {
                    fontSize: "14px",
                  },
                },
              },
            },
          },
        },
      },
    ],
  };

  const series = data.map(d => d.revenue);

  return (
    <Card
      title={t("charts.topProducts.title")}
      subtitle={t("charts.topProducts.subtitle")}
      variant="glass"
      padding="md"
      className="lg:col-span-1"
    >
      <div className="overflow-hidden">
        <Chart
          options={options}
          series={series}
          type="donut"
          height={chartHeight}
          width="100%"
        />
      </div>
    </Card>
  );
}

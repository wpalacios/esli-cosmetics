"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { useTheme } from "next-themes";
import { Card } from "@esli-cosmetics/ui";
import { formatCurrency } from "@esli-cosmetics/utils";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type PeriodTotalChartProps = {
  title: string;
  subtitle: string;
  totalLabel: string;
  seriesName: string;
  color: string;
  data: Array<{
    date: string;
    value: number;
  }>;
  isLoading?: boolean;
};

export function PeriodTotalChart({
  title,
  subtitle,
  totalLabel,
  seriesName,
  color,
  data,
  isLoading = false,
}: Readonly<PeriodTotalChartProps>) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [chartHeight, setChartHeight] = useState(240);

  useEffect(() => {
    if (typeof globalThis.window === "undefined") return;
    const updateHeight = () => {
      if (window.innerWidth >= 1024) {
        setChartHeight(280);
      } else if (window.innerWidth >= 640) {
        setChartHeight(260);
      } else {
        setChartHeight(240);
      }
    };
    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  const total = useMemo(
    () => data.reduce((sum, point) => sum + point.value, 0),
    [data]
  );

  const options: ApexOptions = {
    colors: [color],
    chart: {
      type: "area",
      toolbar: { show: false },
      fontFamily: "inherit",
      foreColor: isDark ? "#9ca3af" : "#374151",
    },
    fill: {
      gradient: {
        opacityFrom: 0.45,
        opacityTo: 0,
        stops: [0, 100],
      },
    },
    stroke: {
      curve: "smooth",
      width: 3,
    },
    dataLabels: { enabled: false },
    grid: {
      strokeDashArray: 5,
      borderColor: isDark ? "#374151" : "#e5e7eb",
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    xaxis: {
      categories: data.map(point => point.date),
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: value => formatCurrency(value),
      },
    },
    tooltip: {
      theme: isDark ? "dark" : "light",
      y: {
        formatter: value => formatCurrency(value),
      },
    },
    legend: {
      show: false,
    },
  };

  const series = [
    {
      name: seriesName,
      data: data.map(point => point.value),
    },
  ];

  return (
    <Card title={title} subtitle={subtitle} variant="glass" padding="md">
      <div className="mb-3 flex items-baseline justify-between rounded-lg bg-pink-50/60 px-3 py-2 dark:bg-gray-800/60">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          {totalLabel}
        </span>
        <span className="text-base font-semibold text-gray-900 dark:text-white">
          {formatCurrency(total)}
        </span>
      </div>
      {isLoading ? (
        <div
          className="flex w-full animate-pulse items-center justify-center rounded-xl bg-gradient-to-br from-pink-50/80 to-white dark:from-gray-800/50 dark:to-gray-900/50"
          style={{ height: chartHeight }}
        />
      ) : (
        <div className="-ml-4 -mr-5">
          <Chart
            options={options}
            series={series}
            type="area"
            height={chartHeight}
          />
        </div>
      )}
    </Card>
  );
}

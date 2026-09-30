"use client";

import { useTranslation } from "react-i18next";
import { LocationSelect } from "@/components/ui/location-select";

interface DashboardHeaderProps {
  selectedLocationId: string | undefined;
  onLocationChange: (locationId: string | undefined) => void;
}

export function DashboardHeader({
  selectedLocationId,
  onLocationChange,
}: DashboardHeaderProps) {
  const { t } = useTranslation("dashboard");

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t("page.title")}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t("page.subtitle")}
        </p>
      </div>
      <div className="w-full sm:w-auto sm:min-w-[280px]">
        <label className="text-sm font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {t("header.location")}
        </label>
        <LocationSelect
          value={selectedLocationId}
          onChange={onLocationChange}
          placeholder={t("header.selectLocation") || "Filter by location"}
        />
      </div>
    </div>
  );
}

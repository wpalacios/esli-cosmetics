"use client";

import React, { useEffect, useState } from "react";
import { BiChevronDown, BiChevronUp, BiSearch } from "react-icons/bi";
import { useTranslation } from "react-i18next";
import { Button, Input, SearchInput } from "@esli-cosmetics/ui";
import { LocationSelect } from "@/components/ui/location-select";
import { EmployeeSelect } from "@/components/ui/employee-select";
import { MovementTypeFilterDropdown } from "@/components/ui/stock-movement-type-select";
import { StockMovementsPreviewFilters } from "@esli-cosmetics/types";

interface ReportsFilterHeaderProps {
  title: string;
  filters: StockMovementsPreviewFilters;
  onFilterChange: (newFilters: StockMovementsPreviewFilters) => void;
  onRunSearch: (filters: StockMovementsPreviewFilters) => void;
  isBusy?: boolean;
}

export function ReportsFilterHeader({
  filters,
  onFilterChange,
  onRunSearch,
  isBusy = false,
}: ReportsFilterHeaderProps) {
  const { t } = useTranslation(["reports", "stock", "common"]);
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  // 1. Local state
  const [searchTerm, setSearchTerm] = useState(filters.reference || "");

  // Synchronize if filters are cleared externally
  useEffect(() => {
    setSearchTerm(filters.reference || "");
  }, [filters.reference]);

  // 2. Function triggered only by the search button or Enter key
  const handleManualSearch = () => {
    const nextFilters = { ...filters, reference: searchTerm, page: 1 };
    onFilterChange(nextFilters);
    onRunSearch(nextFilters);
  };

  // 3. Other selectors trigger automatic search immediately
  const updateFilters = React.useCallback(
    (updates: Partial<StockMovementsPreviewFilters>) => {
      const nextFilters = {
        ...filters,
        ...updates,
        reference: searchTerm, // Keep the current input text
        page: 1,
      };

      onFilterChange(nextFilters);
      onRunSearch(nextFilters);
    },
    [filters, onFilterChange, onRunSearch, searchTerm]
  );

  return (
    <div className="mx-4 rounded-2xl border border-gray-200 bg-gray-50 shadow-sm dark:border-gray-800 dark:bg-gray-900/50 sm:mx-6">
      {/* MOBILE TOGGLE */}
      <button
        onClick={() => setIsFiltersOpen(!isFiltersOpen)}
        className="flex w-full items-center justify-between px-6 py-3 transition-colors lg:hidden"
      >
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <span className="text-sm font-bold uppercase tracking-widest">
            {t("common:filters.title", "Filtros")}
          </span>
        </div>
        {isFiltersOpen ? (
          <BiChevronUp className="text-xl" />
        ) : (
          <BiChevronDown className="text-xl" />
        )}
      </button>

      <div
        className={`overflow-hidden px-4 transition-all duration-300 ease-in-out sm:px-6 ${
          isFiltersOpen
            ? "max-h-[1000px] py-6"
            : "max-h-0 lg:max-h-none lg:py-6"
        }`}
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
          {/* Product and Reference */}
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-[11px] font-medium uppercase tracking-tight text-gray-500">
              {t(
                "reports:filters.searchByProductOrReference",
                "Busca por producto o número de referencia"
              )}
            </label>
            <SearchInput
              value={searchTerm}
              onChange={val => setSearchTerm(val)}
              onSearch={handleManualSearch}
              disabled={isBusy}
              placeholder={t(
                "reports:filters.searchByProductOrReference",
                "Ingresa número de producto o referencia..."
              )}
              className="h-10"
              showHint={true}
              translations={{
                hintPressEnter: t("common:search.press", "Presiona"),
                hintToSearch: t("common:search.toSearch", "para buscar"),
                hintEnter: "Enter",
              }}
            />
          </div>

          {/*  Movement Type */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-tight text-gray-500">
              {t("reports:filters.stockMovementType", "Tipo de movimiento")}
            </label>
            <MovementTypeFilterDropdown
              value={filters.movementType}
              onChange={val => updateFilters({ movementType: val })}
            />
          </div>

          {/* Employee (created by) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-tight text-gray-500">
              {t("reports:filters.byEmployee", "Creado Por")}
            </label>
            <EmployeeSelect
              value={filters.createdBy}
              onChange={id => updateFilters({ createdBy: id })}
              placeholder={t(
                "reports:filters.allEmployees",
                "Selecciona un empleado..."
              )}
            />
          </div>

          {/* FROM LOCATION */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-tight text-gray-500">
              {t("reports:filters.fromLocation", "Desde Sucursal")}
            </label>
            <LocationSelect
              value={filters.fromLocationId}
              onChange={id => updateFilters({ fromLocationId: id })}
              placeholder={t(
                "reports:filters.allOrigins",
                "Todos los Orígenes"
              )}
            />
          </div>

          {/* TO LOCATION */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-tight text-gray-500">
              {t("reports:filters.toLocation", "Hacia Sucursal")}
            </label>
            <LocationSelect
              value={filters.toLocationId}
              onChange={id => updateFilters({ toLocationId: id })}
              placeholder={t(
                "reports:filters.allDestinations",
                "Todos los Destinos"
              )}
            />
          </div>

          {/* FROM DATE  */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-tight text-gray-500">
              {t("reports:filters.fromDate", "Desde")}
            </label>
            <Input
              type="date"
              value={filters.fromDate ?? ""}
              onChange={e => updateFilters({ fromDate: e.target.value })}
              className="h-10 rounded-xl border-gray-200 bg-white transition-colors focus:border-pink-500 dark:bg-gray-800"
            />
          </div>

          {/* TO DATE */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-tight text-gray-500">
              {t("reports:filters.toDate", "Hasta")}
            </label>
            <Input
              type="date"
              value={filters.toDate ?? ""}
              onChange={e => updateFilters({ toDate: e.target.value })}
              className="h-10 rounded-xl border-gray-200 bg-white transition-colors focus:border-pink-500 dark:bg-gray-800"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

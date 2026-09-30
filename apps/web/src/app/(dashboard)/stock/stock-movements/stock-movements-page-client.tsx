"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  SearchInput,
  DateRangePicker,
  type DateRange,
} from "@esli-cosmetics/ui";
import { StockMovementsTable } from "@/components/tables/stock-movements-table";
import { StockMovementModal } from "@/components/modals/stock-movement-modal";
import { LocationSelect } from "@/components/ui/location-select";
import {
  useStockMovements,
  useSearchStockMovements,
} from "@/hooks/use-stock-movements";
import type { StockMovementFilters } from "@/actions";
import {
  StockMovementWithRelations,
  StockMovementType,
} from "@esli-cosmetics/types";
import {
  CreateStockMovementDropdown,
  MovementTypeConfig,
} from "./components/create-stock-movement-dropdown";
import { PurchaseExcelImportModal } from "./components/purchase-excel-import-modal";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

const ALL_VALUE = "__all__";

/** Format a Date as a local `YYYY-MM-DD` string for API date filters. */
function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface PaginatedStockMovementDto {
  data: StockMovementWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface StockMovementsPageClientProps {
  initialData: PaginatedStockMovementDto;
  initialError?: string | null;
}

export function StockMovementsPageClient({
  initialData,
  initialError,
}: StockMovementsPageClientProps) {
  const { t, i18n } = useTranslation("stock");
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [fromLocationId, setFromLocationId] = useState<string | undefined>();
  const [toLocationId, setToLocationId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMovementType, setSelectedMovementType] =
    useState<StockMovementType | null>(null);
  const [selectedConfig, setSelectedConfig] =
    useState<MovementTypeConfig | null>(null);
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

  const isSearching = !!activeSearchTerm;

  const filters = useMemo<StockMovementFilters>(
    () => ({
      ...(fromLocationId && { fromLocationId }),
      ...(toLocationId && { toLocationId }),
      ...(dateRange.from && { startDate: toYmd(dateRange.from) }),
      ...(dateRange.to && { endDate: toYmd(dateRange.to) }),
    }),
    [fromLocationId, toLocationId, dateRange.from, dateRange.to]
  );

  const dateRangeLabels = useMemo(
    () => ({
      presets: t("dateRange.presets"),
      clear: t("dateRange.clear"),
      apply: t("dateRange.apply"),
      today: t("dateRange.today"),
      yesterday: t("dateRange.yesterday"),
      last7Days: t("dateRange.last7Days"),
      last30Days: t("dateRange.last30Days"),
      thisMonth: t("dateRange.thisMonth"),
      lastMonth: t("dateRange.lastMonth"),
    }),
    [t]
  );

  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useSearchStockMovements(activeSearchTerm, currentPage, pageSize, filters);

  const {
    data: stockMovementsData,
    isLoading: isStockMovementsLoading,
    error: stockMovementsError,
    refetch: refetchStockMovements,
  } = useStockMovements({ page: currentPage, limit: pageSize, filters });

  const data = isSearching ? searchData : stockMovementsData;
  const isLoading = isSearching ? isSearchLoading : isStockMovementsLoading;
  const error = isSearching ? searchError : stockMovementsError;
  const refetch = isSearching ? refetchSearch : refetchStockMovements;

  const handleSelectMovement = (
    movementType: StockMovementType,
    config: MovementTypeConfig
  ) => {
    setSelectedMovementType(movementType);
    setSelectedConfig(config);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Delay reset to allow for modal closing animation
    setTimeout(() => {
      setSelectedMovementType(null);
      setSelectedConfig(null);
    }, 300);
  };

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
    },
    [setPageSize]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeSearchTerm,
    fromLocationId,
    toLocationId,
    dateRange.from,
    dateRange.to,
  ]);

  const movementsDisplayData = data || initialData;
  // Handle both PaginatedStockMovementDto and StockMovementsResponse formats
  const movements =
    "data" in movementsDisplayData
      ? movementsDisplayData.data
      : "stockMovements" in movementsDisplayData
        ? movementsDisplayData.stockMovements
        : [];
  const totalItems =
    "pagination" in movementsDisplayData
      ? movementsDisplayData.pagination.total
      : "total" in movementsDisplayData
        ? movementsDisplayData.total
        : 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const displayError = error || initialError;

  if (displayError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("movements.page.title")}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t("movements.page.subtitle")}
            </p>
          </div>
        </div>

        <div className="sm:p-7.5 rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
          <div className="text-center">
            <div className="mb-4 text-red-600 dark:text-red-400">
              {typeof displayError === "string"
                ? displayError
                : t("movements.page.error")}
            </div>
            <Button onClick={() => refetch()} variant="outline">
              {t("movements.page.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("movements.page.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("movements.page.subtitle")}
          </p>
        </div>
        <CreateStockMovementDropdown
          onSelectMovement={handleSelectMovement}
          onSelectExcelPurchaseImport={() => setIsExcelImportOpen(true)}
        />
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative w-full">
          <SearchInput
            placeholder={t("movements.page.searchPlaceholder")}
            value={searchTerm}
            onChange={handleSearchChange}
            onSearch={handleSearch}
            minLength={0}
          />
        </div>
        <LocationSelect
          allowAll
          label={t("movements.page.fromLocation")}
          value={fromLocationId || ALL_VALUE}
          onChange={locationId =>
            setFromLocationId(locationId === ALL_VALUE ? undefined : locationId)
          }
          placeholder={t("movements.page.fromLocationFilter")}
        />
        <LocationSelect
          allowAll
          label={t("movements.page.toLocation")}
          value={toLocationId || ALL_VALUE}
          onChange={locationId =>
            setToLocationId(locationId === ALL_VALUE ? undefined : locationId)
          }
          placeholder={t("movements.page.toLocationFilter")}
        />
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder={t("movements.page.dateRangeFilter")}
          labels={dateRangeLabels}
          locale={i18n.language}
          maxDate={new Date()}
          align="start"
        />
      </div>

      {/* Stock Movements Table */}
      <StockMovementsTable
        data={movements}
        isLoading={isLoading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange,
          totalItems,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      {/* Create Movement Modal */}
      {selectedMovementType && selectedConfig && (
        <StockMovementModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={() => {
            refetch();
            handleCloseModal();
          }}
          movementType={selectedMovementType}
          config={selectedConfig}
        />
      )}

      <PurchaseExcelImportModal
        open={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        onSuccess={() => {
          void refetch();
        }}
      />
    </div>
  );
}

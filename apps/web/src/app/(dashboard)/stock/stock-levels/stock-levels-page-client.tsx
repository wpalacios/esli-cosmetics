"use client";

import { useTranslation } from "react-i18next";
import { StockLevelsTable } from "@/components/tables/stock-levels-table";
import { useSearchStockLevels, useStockLevels } from "@/hooks/use-stock-levels";
import { LocationSelect } from "@/components/ui/location-select";
import type { StockLevelFilters } from "@/actions";
import {
  StockLevelWithRelations,
  StockLevelsResponse,
} from "@esli-cosmetics/types";
import {
  Button,
  SearchInput,
  DateRangePicker,
  type DateRange,
} from "@esli-cosmetics/ui";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

const ALL_VALUE = "__all__";

/** Format a Date as a local `YYYY-MM-DD` string for API date filters. */
function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface StockLevelsPageClientProps {
  initialData: StockLevelsResponse;
  initialSearchQuery?: string;
}

export function StockLevelsPageClient({
  initialData,
  initialSearchQuery = "",
}: StockLevelsPageClientProps) {
  const { t, i18n } = useTranslation("stock");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState(initialSearchQuery);
  const [activeSearchTerm, setActiveSearchTerm] = useState(initialSearchQuery);
  const [locationId, setLocationId] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<DateRange>({});
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();

  const filters = useMemo<StockLevelFilters>(
    () => ({
      ...(locationId && { locationId }),
      ...(dateRange.from && { startDate: toYmd(dateRange.from) }),
      ...(dateRange.to && { endDate: toYmd(dateRange.to) }),
    }),
    [locationId, dateRange.from, dateRange.to]
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

  // Reset to the first page whenever the location or date filters change.
  useEffect(() => {
    setCurrentPage(1);
  }, [locationId, dateRange.from, dateRange.to]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the single source of truth. Sync state FROM the URL whenever the
  // query params change (mount, browser back/forward, or external navigation
  // such as clicking a notification). All updates are idempotent so this never
  // fights with the imperative URL writes in the handlers below.
  useEffect(() => {
    const urlQuery = searchParams.get("q") || "";
    const urlPageParam = searchParams.get("page");
    const parsedPage = urlPageParam ? parseInt(urlPageParam, 10) : 1;
    const urlPage = !isNaN(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    setSearchTerm(prev => (prev === urlQuery ? prev : urlQuery));
    setActiveSearchTerm(prev => (prev === urlQuery ? prev : urlQuery));
    setCurrentPage(prev => (prev === urlPage ? prev : urlPage));
  }, [searchParams]);

  // Write the URL imperatively in response to explicit user actions only.
  const syncUrl = useCallback(
    (query: string, page: number) => {
      const params = new URLSearchParams();

      // Preserve the current page-size selection across URL rewrites.
      const currentPageSize = searchParams.get("pageSize");
      if (currentPageSize) {
        params.set("pageSize", currentPageSize);
      }

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (page > 1) {
        params.set("page", page.toString());
      }

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      const currentUrl = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;

      if (newUrl !== currentUrl) {
        router.replace(newUrl);
      }
    },
    [pathname, router, searchParams]
  );

  const isSearching = !!activeSearchTerm && activeSearchTerm.trim().length > 0;

  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useSearchStockLevels(activeSearchTerm, currentPage, pageSize, filters);

  const {
    data: stockLevelsData,
    isLoading: isStockLevelsLoading,
    error: stockLevelsError,
    refetch: refetchStockLevels,
  } = useStockLevels({
    page: currentPage,
    limit: pageSize,
    filters,
    enabled: !isSearching, // Disable when searching to avoid duplicate queries
  });

  const data = isSearching ? searchData : stockLevelsData;
  const isLoading = isSearching ? isSearchLoading : isStockLevelsLoading;
  const error = isSearching ? searchError : stockLevelsError;
  const refetch = isSearching ? refetchSearch : refetchStockLevels;

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      syncUrl(activeSearchTerm, page);
    },
    [activeSearchTerm, syncUrl]
  );

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

  const handleSearch = useCallback(
    (value: string) => {
      setActiveSearchTerm(value);
      setCurrentPage(1);
      syncUrl(value, 1);
    },
    [syncUrl]
  );

  const stockLevelsDisplayData = (data || initialData) as StockLevelsResponse;

  const totalItems = stockLevelsDisplayData.total ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  const handleViewAllMovements = useCallback(
    (stockLevelId: string) => {
      // Find the stock level to get product and location details
      const stockLevel = (stockLevelsDisplayData.stockLevels ?? []).find(
        (sl: StockLevelWithRelations) => sl.id === stockLevelId
      );
      if (stockLevel) {
        const productId = stockLevel.productId;
        const locationId = stockLevel.locationId;
        router.push(
          `/stock/stock-movements?productId=${productId}&locationId=${locationId}`
        );
      }
    },
    [stockLevelsDisplayData, router]
  );

  const handleStockMovementSuccess = useCallback(() => {
    // Refetch stock levels after a movement is created/updated
    refetch();
  }, [refetch]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("levels.page.title")}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t("levels.page.subtitle")}
            </p>
          </div>
        </div>

        <div className="sm:p-7.5 rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
          <div className="text-center">
            <div className="mb-4 text-red-600 dark:text-red-400">
              {t("levels.page.error")}
            </div>
            <Button onClick={() => refetch()} variant="outline">
              {t("levels.page.retry")}
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
            {t("levels.page.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("levels.page.subtitle")}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative w-full">
          <SearchInput
            placeholder={t("levels.page.searchPlaceholder")}
            value={searchTerm}
            onChange={handleSearchChange}
            onSearch={handleSearch}
            minLength={0}
          />
        </div>
        <LocationSelect
          allowAll
          value={locationId || ALL_VALUE}
          onChange={selected =>
            setLocationId(selected === ALL_VALUE ? undefined : selected)
          }
          placeholder={t("levels.page.locationFilter")}
        />
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          placeholder={t("levels.page.dateRangeFilter")}
          labels={dateRangeLabels}
          locale={i18n.language}
          maxDate={new Date()}
          align="start"
        />
      </div>

      {/* Stock Levels Table */}
      <StockLevelsTable
        data={stockLevelsDisplayData.stockLevels ?? []}
        onViewAllMovements={handleViewAllMovements}
        onStockMovementSuccess={handleStockMovementSuccess}
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
    </div>
  );
}

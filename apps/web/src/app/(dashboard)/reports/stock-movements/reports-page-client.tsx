"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@esli-cosmetics/ui";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsHorizontalIcon as DotsHorizontalIconComponent } from "@radix-ui/react-icons";
import { ReportsFilterHeader } from "../components/reports-filter-header";
import { StockMovementsReportTable } from "@/components/tables/stock-movements-report-table";
import {
  useStockMovementsList,
  useStockMovementsExport,
} from "@/hooks/use-reports";
import { usePageSizeParam } from "@/hooks/use-page-size-param";
import type {
  StockMovementsPreviewFilters,
  ReportPreviewResponse,
  StockMovementPreviewRow,
} from "@esli-cosmetics/types";

export default function StockMovementsReportsPageClient({
  initialPreview,
}: {
  initialPreview?: ReportPreviewResponse | null;
}) {
  const { t } = useTranslation(["reports", "stock"]);
  const [filters, setFilters] = useState<StockMovementsPreviewFilters>({});
  const [appliedFilters, setAppliedFilters] =
    useState<StockMovementsPreviewFilters>({});
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();

  const { items, pagination, loading, error, search, setLimit, fetchedOnce } =
    useStockMovementsList({
      page: 1,
      limit: pageSize,
      initialItems:
        (initialPreview?.sheets?.[0]?.rows as StockMovementPreviewRow[]) ?? [],
      initialTotal: initialPreview?.pagination?.total ?? 0,
      initialTotalPages: initialPreview?.pagination?.totalPages ?? 1,
    });

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setLimit(size).catch(() => {});
    },
    [setPageSize, setLimit]
  );

  const { exportPdf, loading: exportLoading } = useStockMovementsExport();

  const previewToShow = useMemo<ReportPreviewResponse | null>(() => {
    if (!fetchedOnce) return initialPreview ?? null;

    return {
      fileName: "stock-movements-report.pdf",
      sheets: [
        {
          name: t("reports:page.titleStockMovements"),
          rows: items as any,
          columns: [],
        },
      ],
      pagination: {
        page: pagination.currentPage,
        limit: pageSize,
        total: pagination.totalItems,
        totalPages: pagination.totalPages,
      },
    };
  }, [fetchedOnce, items, initialPreview, t, pagination, pageSize]);

  // Handlers
  const handleFilterChange = useCallback(
    (nextFilters: StockMovementsPreviewFilters) => {
      setFilters(nextFilters);
    },
    []
  );

  const handleRunSearch = useCallback(
    (nextFilters: StockMovementsPreviewFilters) => {
      setFilters(nextFilters);
      setAppliedFilters(nextFilters);
      search(nextFilters);
    },
    [search]
  );

  const handleExportPdf = useCallback(async () => {
    await exportPdf(appliedFilters);
  }, [exportPdf, appliedFilters]);

  const handleClear = useCallback(() => {
    const resetFilters: StockMovementsPreviewFilters = {
      page: 1,
      createdBy: undefined,
      reference: "",
      fromLocationId: undefined,
      toLocationId: undefined,
      fromDate: undefined,
      toDate: undefined,
      movementType: undefined,
    };
    setFilters(resetFilters);
    setAppliedFilters(resetFilters);
    search(resetFilters);
  }, [search]);

  const isBusy = !!loading || !!exportLoading;
  const hasDataToExport =
    items.length > 0 || (initialPreview?.sheets?.[0]?.rows?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-4 sm:px-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("reports:page.titleStockMovements")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("reports:page.subtitleStockMovements")}
          </p>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="secondary"
              rightIcon={<DotsHorizontalIconComponent className="h-4 w-4" />}
              disabled={isBusy && !hasDataToExport}
            >
              {t("reports:actions.options")}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[200px] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              sideOffset={5}
            >
              <DropdownMenu.Item
                className="hover:bg-primary/10 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none"
                onSelect={handleExportPdf}
                disabled={isBusy || !hasDataToExport}
              >
                {t("reports:export.pdf")}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50"
                onSelect={handleClear}
              >
                {t("reports:filters.clear")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <ReportsFilterHeader
        title=""
        filters={filters}
        onFilterChange={handleFilterChange}
        onRunSearch={handleRunSearch}
        isBusy={isBusy}
      />

      <div className="px-4 pb-10 sm:px-6">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <StockMovementsReportTable
            preview={previewToShow}
            isLoading={loading}
            pagination={{
              ...pagination,
              pageSize,
              onPageSizeChange: handlePageSizeChange,
              pageSizeOptions,
            }}
            pageSize={pageSize}
            appliedFilters={appliedFilters}
          />
        </div>
      </div>
    </div>
  );
}

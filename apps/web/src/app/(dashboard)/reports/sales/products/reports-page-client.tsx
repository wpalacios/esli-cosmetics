"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, SearchInput } from "@esli-cosmetics/ui";
import type {
  ReportPreviewResponse,
  SalesItemRow,
  SalesItemsResponse,
  SalesUiFilters,
} from "@esli-cosmetics/types";
import { ReportPreviewTable } from "@/components/tables/reports-table";
import { useSalesList, useSalesByProductExport } from "@/hooks/use-reports";
import { usePageSizeParam } from "@/hooks/use-page-size-param";
import { BranchSelect } from "@/components/ui/branch-select";
import { EmployeeSelect } from "@/components/ui/employee-select";
import { BrandSelect } from "@/components/ui/brand-select";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsHorizontalIcon as DotsHorizontalIconComponent } from "@radix-ui/react-icons";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Date -> "DD/MM/YYYY"
function formatDateToNumeric(d: Date): string {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// "dd/MM/yyyy" -> "DD/MM/YYYY"
function formatYmdToNumeric(ymd?: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const y = ymd.slice(0, 4);
  const m = ymd.slice(5, 7);
  const d = ymd.slice(8, 10);
  return `${d}/${m}/${y}`;
}

function useTodayNumeric(): string {
  const [label, setLabel] = useState(() => formatDateToNumeric(new Date()));

  useEffect(() => {
    const tick = () => {
      const next = formatDateToNumeric(new Date());
      setLabel(prev => (prev === next ? prev : next));
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return label;
}

function DateFilterInput({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value?: string;
  onChange: (next?: string) => void;
}) {
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const el = hiddenRef.current;
    if (!el) return;
    if (
      typeof (el as HTMLInputElement & { showPicker?: () => void })
        .showPicker === "function"
    ) {
      (el as HTMLInputElement & { showPicker: () => void }).showPicker();
    } else {
      el.click();
    }
  };

  return (
    <div className="relative">
      <input
        ref={hiddenRef}
        type="date"
        value={value ?? ""}
        onChange={e => onChange(e.target.value || undefined)}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
      />
      <Input
        type="text"
        readOnly
        placeholder={placeholder}
        value={value ? formatYmdToNumeric(value) : ""}
        onClick={openPicker}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
          if (e.key === "Escape") {
            onChange(undefined);
          }
        }}
      />
    </div>
  );
}

function formatMonthDayYearLabel(d: Date): string {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function useTodayLabel(): string {
  const [label, setLabel] = useState(() => formatMonthDayYearLabel(new Date()));

  useEffect(() => {
    const tick = () => {
      const next = formatMonthDayYearLabel(new Date());
      setLabel(prev => (prev === next ? prev : next));
    };

    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return label;
}

type Props = {
  initialPreview?: ReportPreviewResponse | null;
  initialData?: SalesItemsResponse | null;
};

function toIsoDateString(d?: string | Date): string | undefined {
  if (!d) return undefined;
  return typeof d === "string" ? d : d.toISOString().slice(0, 10);
}

export default function ReportSalesProductsPageClient({
  initialPreview,
  initialData,
}: Props) {
  const { t } = useTranslation("reports");

  const [filters, setFilters] = useState<SalesUiFilters>({});
  const [searchTerm, setSearchTerm] = useState<string>(
    (filters as any).search ?? ""
  );

  const [brandId, setBrandId] = useState<string | undefined>(undefined);
  const [branchId, setBranchId] = useState<string | undefined>(undefined);
  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);

  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();

  const initialItems = useMemo<SalesItemRow[] | undefined>(() => {
    // Prefer the new paginated data format
    if (initialData?.data) {
      return initialData.data;
    }

    // Fallback to legacy preview format
    const rows = initialPreview?.sheets?.[0]?.rows as
      | Array<Record<string, unknown>>
      | undefined;
    if (!rows) return undefined;

    return rows.map(r => {
      const parent = String((r as any).productName ?? "").trim();
      const variant = String((r as any).variantName ?? "").trim();
      const sku = String((r as any).variantSku ?? (r as any).sku ?? "").trim();
      const parts = [parent, variant, sku].filter(p => p && p.length > 0);
      const product = parts.join(" - ");

      return {
        date: String((r as any)?.date ?? ""),
        orderNumber: String((r as any)?.orderNumber ?? ""),
        customer: String(
          (r as any)?.customer ??
            (r as any)?.client ??
            (r as any)?.customerName ??
            ""
        ),
        branch: String((r as any)?.branch ?? ""),
        product,
        productName: parent,
        variantName: variant,
        variantSku: sku,
        quantity: Number((r as any)?.quantity ?? 0),
        orderTotal: Number((r as any)?.orderTotal ?? 0),
      } as SalesItemRow;
    });
  }, [initialData, initialPreview]);

  const initialTotal = useMemo(
    () =>
      initialData?.pagination?.total ??
      initialPreview?.pagination?.total ??
      initialItems?.length ??
      0,
    [
      initialData?.pagination?.total,
      initialPreview?.pagination?.total,
      initialItems,
    ]
  );

  const initialTotalPages = useMemo(
    () =>
      initialData?.pagination?.totalPages ??
      initialPreview?.pagination?.totalPages ??
      Math.max(1, Math.ceil(initialTotal / pageSize)),
    [
      initialData?.pagination?.totalPages,
      initialPreview?.pagination?.totalPages,
      initialTotal,
      pageSize,
    ]
  );

  const { items, loading, error, search, pagination, setLimit, fetchedOnce } =
    useSalesList({
      page: 1,
      limit: pageSize,
      ...(initialItems ? { initialItems } : {}),
      initialTotal,
      initialTotalPages,
      reportType: "products",
    });

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setLimit(size).catch(() => {});
    },
    [setPageSize, setLimit]
  );

  const {
    exportReportExcel: exportProductReportExcel,
    exportReportPdf: exportProductReportPdf,
  } = useSalesByProductExport();

  const runSearch = useCallback(
    async (nextFilters: SalesUiFilters) => {
      try {
        await search(nextFilters);
      } catch (e) {
        console.error("Search failed", e);
      }
    },
    [search]
  );

  useEffect(() => {
    runSearch(filters);
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      const term = value?.trim() || undefined;
      const nextFilters: SalesUiFilters = term
        ? { ...filters, search: term, page: 1 }
        : (() => {
            const { search: _omit, page: _p, ...rest } = filters as any;
            return rest as SalesUiFilters;
          })();

      setFilters(nextFilters);
      runSearch(nextFilters);
    },
    [filters, runSearch]
  );

  const handleClear = useCallback(() => {
    setFilters({});
    setSearchTerm("");
    setBrandId(undefined);
    setBranchId(undefined);
    setEmployeeId(undefined);
    runSearch({});
  }, [runSearch]);

  const handleExportExcel = useCallback(async () => {
    try {
      const effectiveFilters = {
        ...filters,
        ...(brandId ? { brandId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(searchTerm && searchTerm.trim()
          ? { search: searchTerm.trim() }
          : {}),
      };
      await exportProductReportExcel(effectiveFilters);
    } catch (e) {
      console.error("Export Excel failed", e);
    }
  }, [
    exportProductReportExcel,
    filters,
    brandId,
    branchId,
    employeeId,
    searchTerm,
  ]);

  const handleExportPdf = useCallback(async () => {
    try {
      const effectiveFilters = {
        ...filters,
        ...(brandId ? { brandId } : {}),
        ...(branchId ? { branchId } : {}),
        ...(employeeId ? { employeeId } : {}),
        ...(searchTerm && searchTerm.trim()
          ? { search: searchTerm.trim() }
          : {}),
      };
      await exportProductReportPdf(effectiveFilters);
    } catch (e) {
      console.error("Export PDF failed", e);
    }
  }, [
    exportProductReportPdf,
    filters,
    brandId,
    branchId,
    employeeId,
    searchTerm,
  ]);

  const previewToShow = useMemo<ReportPreviewResponse | null>(() => {
    if (!fetchedOnce) return initialPreview ?? null;

    const columns = [
      { key: "date", header: "Fecha" },
      { key: "orderNumber", header: "Número de Orden" },
      { key: "product", header: "Producto" },
      { key: "quantity", header: "Cantidad" },
      { key: "orderTotal", header: "Total" },
    ];

    const rows = items.map(r => {
      const parent = String(r.productName ?? "").trim();
      const variant = String(r.variantName ?? "").trim();
      const sku = String(r.variantSku ?? (r as any).sku ?? "").trim();
      const parts = [parent, variant, sku].filter(p => p && p.length > 0);
      const product = parts.join(" - ");

      return {
        date: r.date,
        orderNumber: r.orderNumber,
        product,
        quantity: r.quantity,
        orderTotal: r.orderTotal,
      };
    });

    const preview: ReportPreviewResponse = {
      fileName: "sales-by-product.xlsx",
      sheets: [{ name: t("page.titleSalesProducts"), columns, rows }],
      pagination: {
        page: pagination.currentPage ?? 1,
        limit: pageSize,
        total: pagination.totalItems ?? rows.length ?? 0,
        totalPages: pagination.totalPages ?? 1,
      },
    };

    return preview;
  }, [fetchedOnce, items, initialPreview, t, pagination, pageSize]);

  const isBusy = !!loading;
  const hasDataToExport = items.length > 0;
  const todayNumeric = useTodayNumeric();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.titleSalesProducts")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitleSalesProducts")}
          </p>
        </div>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button
              variant="secondary"
              rightIcon={<DotsHorizontalIconComponent className="h-4 w-4" />}
              disabled={isBusy && !hasDataToExport}
            >
              Opciones
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="min-w-[200px] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              sideOffset={5}
            >
              <DropdownMenu.Item
                className="hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none"
                onSelect={handleExportExcel}
                disabled={isBusy || !hasDataToExport}
              >
                {t("export.excel")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none"
                onSelect={handleExportPdf}
                disabled={isBusy || !hasDataToExport}
              >
                {t("export.pdf")}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50 focus:bg-red-50"
                onSelect={handleClear}
                disabled={isBusy}
              >
                {t("filters.clear")}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      <Accordion.Root
        type="single"
        collapsible
        defaultValue="filters"
        className="w-full space-y-2"
      >
        <AccordionItem value="filters">
          <AccordionTrigger>{t("filters.title")}</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.byProduct")}
                </label>
                <SearchInput
                  placeholder={t("filters.searchProductsby")}
                  value={searchTerm}
                  onChange={v => {
                    const cleaned = v.replace(/\s+/g, " ");
                    setSearchTerm(cleaned);
                  }}
                  onSearch={handleSearch}
                  minLength={0}
                />
              </div>

              {/* Brand */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.byBrand")}
                </label>
                <BrandSelect
                  value={brandId}
                  onChange={id => {
                    setBrandId(id);
                    const nextFilters = id
                      ? { ...filters, brandId: id }
                      : (({ brandId: _omit, ...rest }: SalesUiFilters) => rest)(
                          filters
                        );
                    setFilters(nextFilters);
                    runSearch(nextFilters);
                  }}
                  disabled={isBusy}
                  placeholder={t("filters.selectBrand")}
                  searchPlaceholder={t("filters.searchBrand")}
                  loadingMessage={t("filters.loadingBrand")}
                  emptyMessage={t("filters.notFoundBrand")}
                />
              </div>

              {/* Branch */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.byBranch")}
                </label>
                <BranchSelect
                  value={branchId}
                  onChange={id => {
                    setBranchId(id);
                    const nextFilters = id
                      ? { ...filters, branchId: id }
                      : (({ branchId: _omit, ...rest }: SalesUiFilters) =>
                          rest)(filters);
                    setFilters(nextFilters);
                    runSearch(nextFilters);
                  }}
                  disabled={isBusy}
                  placeholder={t("filters.selectBranch")}
                  searchPlaceholder={t("filters.searchBranch")}
                  loadingMessage={t("filters.loadingBranch")}
                  emptyMessage={t("filters.notFoundBranch")}
                />
              </div>

              {/* Employee */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.byEmployee")}
                </label>
                <EmployeeSelect
                  value={employeeId}
                  onChange={id => {
                    setEmployeeId(id);
                    const nextFilters = id
                      ? { ...filters, employeeId: id }
                      : (({ employeeId: _omit, ...rest }: SalesUiFilters) =>
                          rest)(filters);
                    setFilters(nextFilters);
                    runSearch(nextFilters);
                  }}
                  disabled={isBusy}
                  placeholder={t("filters.selectEmployee")}
                  searchPlaceholder={t("filters.searchEmployee")}
                  loadingMessage={t("filters.loadingEmployee")}
                  emptyMessage={t("filters.notFoundEmployee")}
                />
              </div>

              {/* From */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.from")}
                </label>
                {(() => {
                  const fromIso = toIsoDateString(
                    filters.from as string | Date | undefined
                  );
                  return (
                    <DateFilterInput
                      placeholder={todayNumeric}
                      {...(fromIso ? { value: fromIso } : {})}
                      onChange={next => {
                        const nextFrom = next ?? undefined;
                        const nextFilters = nextFrom
                          ? { ...filters, from: nextFrom }
                          : (({ from: _omit, ...rest }: SalesUiFilters) =>
                              rest)(filters);
                        setFilters(nextFilters);
                        runSearch(nextFilters);
                      }}
                    />
                  );
                })()}
              </div>

              {/* To */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.to")}
                </label>
                {(() => {
                  const toIso = toIsoDateString(
                    filters.to as string | Date | undefined
                  );
                  return (
                    <DateFilterInput
                      placeholder={todayNumeric}
                      {...(toIso ? { value: toIso } : {})}
                      onChange={next => {
                        const nextTo = next ?? undefined;
                        const nextFilters = nextTo
                          ? { ...filters, to: nextTo }
                          : (({ to: _omit, ...rest }: SalesUiFilters) => rest)(
                              filters
                            );
                        setFilters(nextFilters);
                        runSearch(nextFilters);
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion.Root>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {String(error)}
        </div>
      )}

      <ReportPreviewTable
        preview={previewToShow}
        loading={isBusy}
        includeHeaders={[
          "Fecha",
          "Número de Orden",
          "Producto",
          "Cantidad",
          "Total",
        ]}
        {...(previewToShow && { title: "" })}
        pagination={{
          currentPage: pagination.currentPage,
          totalPages: pagination.totalPages,
          totalItems: pagination.totalItems,
          onPageChange: (nextPage: number) => {
            const nextFilters = { ...filters, page: nextPage };
            setFilters(nextFilters);
            runSearch(nextFilters);
          },
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
        pageSize={pageSize}
      />
    </div>
  );
}

/* Helper Accordion components */
function AccordionItem({
  children,
  value,
  ...props
}: {
  children: React.ReactNode;
  value: string;
} & React.ComponentProps<typeof Accordion.Item>) {
  return (
    <Accordion.Item
      value={value}
      className="overflow-hidden rounded-lg border border-gray-200"
      {...props}
    >
      {children}
    </Accordion.Item>
  );
}

function AccordionTrigger({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof Accordion.Trigger>) {
  return (
    <Accordion.Header className="flex">
      <Accordion.Trigger
        className="group flex flex-1 items-center justify-between px-4 py-3 text-left font-medium text-gray-900 outline-none hover:bg-gray-50 focus:bg-gray-50 dark:text-white dark:hover:bg-gray-800 dark:focus:bg-gray-800"
        {...props}
      >
        {children}
        <ChevronDownIcon className="h-4 w-4 text-gray-600 transition-transform duration-300 group-data-[state=open]:rotate-180 dark:text-gray-400" />
      </Accordion.Trigger>
    </Accordion.Header>
  );
}

function AccordionContent({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof Accordion.Content>) {
  return (
    <Accordion.Content
      className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden"
      {...props}
    >
      <div className="px-4 pb-4">{children}</div>
    </Accordion.Content>
  );
}

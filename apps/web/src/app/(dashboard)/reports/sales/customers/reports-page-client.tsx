"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Input,
  SearchInput,
  SearchableSelect,
} from "@esli-cosmetics/ui";
import type { SearchableSelectOption } from "@esli-cosmetics/ui";
import type {
  ReportPreviewResponse,
  SalesItemRow,
  SalesItemsResponse,
} from "@esli-cosmetics/types";
import { ReportPreviewTable } from "@/components/tables/reports-table";
import { useSalesList, type SalesListUiFilters } from "@/hooks/use-reports";
import { usePageSizeParam } from "@/hooks/use-page-size-param";
import { LocationSelect } from "@/components/ui/location-select";
import { EmployeeSelect } from "@/components/ui/employee-select";
import { CustomerSelect } from "@/components/ui/customer-select";
import * as Accordion from "@radix-ui/react-accordion";
import {
  ChevronDownIcon,
  DotsHorizontalIcon as DotsHorizontalIconComponent,
} from "@radix-ui/react-icons";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

// Special value for "all payment methods" option (cannot use empty string)
const ALL_PAYMENT_METHODS = "__all__";
// Special value for "all order statuses" option
const ALL_ORDER_STATUSES = "__all__";

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
  return (
    <Input
      type="date"
      value={value ?? ""}
      onChange={e => onChange(e.target.value || undefined)}
      placeholder={placeholder}
      className="h-10 w-full min-w-0 max-w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
      size="md"
    />
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

export default function ReportSalesCustomersPageClient({
  initialPreview,
  initialData,
}: Props) {
  const { t } = useTranslation("reports");

  const [filters, setFilters] = useState<SalesListUiFilters>({});
  const [searchTerm, setSearchTerm] = useState((filters as any).search ?? "");

  const [employeeId, setEmployeeId] = useState<string | undefined>(undefined);
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CREDIT" | undefined
  >(undefined);
  const [orderStatus, setOrderStatus] = useState<string | undefined>(undefined);

  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();

  const initialItems = useMemo<SalesItemRow[] | undefined>(() => {
    // Prefer the new paginated data format
    if (initialData?.data) {
      return initialData.data;
    }

    // Fallback to legacy preview format
    const rows = initialPreview?.sheets?.[0]?.rows as any[] | undefined;
    if (!rows) return undefined;

    return rows
      .filter(r => {
        for (const key in r) {
          const value = r[key];
          if (value != null && String(value).trim().toLowerCase() === "total") {
            return false;
          }
        }
        return true;
      })
      .map(r => {
        const dateValue = r?.date;
        return {
          date:
            typeof dateValue === "string"
              ? dateValue
              : dateValue
                ? new Date(dateValue).toISOString()
                : "",
          orderNumber: String(r?.orderNumber ?? ""),
          customer: String(r?.customer ?? ""),
          branch: String(r?.branch ?? ""),
          product: "",
          productName: "",
          variantName: "",
          variantSku: "",
          quantity: 0,
          orderTotal: Number(r?.orderTotal ?? 0),
          sellerName: String(r?.sellerName ?? ""),
          paymentType: String(r?.paymentType ?? ""),
          discountCode: String(r?.discountCode ?? ""),
          orderDiscount: Number(r?.orderDiscount ?? 0),
          orderSubtotal: Number(r?.orderSubtotal ?? 0),
          orderTaxes: Number(r?.orderTaxes ?? 0),
          status: String(r?.status ?? ""),
        } as unknown as SalesItemRow;
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

  const {
    items,
    loading,
    error,
    search,
    exportReportExcel,
    exportReportPdf,
    pagination,
    setLimit,
    fetchedOnce,
  } = useSalesList({
    page: 1,
    limit: pageSize,
    ...(initialItems ? { initialItems } : {}),
    initialTotal,
    initialTotalPages,
  });

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setLimit(size).catch(() => {});
    },
    [setPageSize, setLimit]
  );

  useEffect(() => {
    search(filters).catch(() => {});
  }, []);

  const handleSearch = useCallback(
    (value: string) => {
      const nextSearch = value.trim() || undefined;
      let nextFilters: SalesListUiFilters;
      if (nextSearch === undefined) {
        const { search: _omit, ...rest } = filters as any;
        nextFilters = rest;
      } else {
        nextFilters = { ...filters, search: nextSearch };
      }
      setFilters(nextFilters);
      search(nextFilters).catch(() => {});
    },
    [filters, search]
  );

  const handleClear = useCallback(() => {
    setFilters({});
    setSearchTerm("");
    setEmployeeId(undefined);
    setPaymentMethod(undefined);
    setOrderStatus(undefined);
    search({}).catch(() => {});
  }, [search]);

  const handleExportExcel = useCallback(async () => {
    try {
      await exportReportExcel();
    } catch (e) {
      console.error("Export Excel failed", e);
    }
  }, [exportReportExcel]);

  const handleExportPdf = useCallback(async () => {
    try {
      await exportReportPdf();
    } catch (e) {
      console.error("Export PDF failed", e);
    }
  }, [exportReportPdf]);

  const previewToShow = useMemo<ReportPreviewResponse | null>(() => {
    if (!fetchedOnce) return initialPreview ?? null;

    const columns = [
      { key: "date", header: "Date" },
      { key: "orderNumber", header: "Order #" },
      { key: "sellerName", header: "Seller" },
      { key: "customer", header: "Customer" },
      { key: "branch", header: "Location" },
      { key: "orderDiscount", header: "Discount" },
      { key: "orderSubtotal", header: "Subtotal" },
      { key: "orderTaxes", header: "Taxes" },
      { key: "orderTotal", header: "Order Total" },
      { key: "paymentType", header: "Payment Type" },
      { key: "discountCode", header: "Discount Code" },
      { key: "status", header: "Status" },
    ];

    const rows = items.map(r => {
      return {
        date: r.date,
        orderNumber: r.orderNumber,
        sellerName: r.sellerName ?? "",
        customer: r.customer,
        branch: r.branch,
        orderDiscount: r.orderDiscount ?? 0,
        orderSubtotal: r.orderSubtotal ?? 0,
        orderTaxes: r.orderTaxes ?? 0,
        orderTotal: r.orderTotal,
        paymentType: r.paymentType ?? "",
        discountCode: r.discountCode ?? "",
        status: r.status ?? "",
      };
    });

    return {
      fileName: "reporte-de-ventas.xlsx",
      sheets: [{ name: t("page.titleSalesCustomers"), columns, rows }],
    };
  }, [fetchedOnce, items, initialPreview, t]);

  const isBusy = !!loading;
  const hasDataToExport = items.length > 0;
  const todayNumeric = useTodayNumeric();

  const paymentMethodOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        value: ALL_PAYMENT_METHODS,
        label: t("filters.selectPaymentMethod", "Todos"),
      },
      { value: "CASH", label: t("filters.cash", "Efectivo") },
      { value: "CREDIT", label: t("filters.credit", "Crédito") },
    ],
    [t]
  );

  const orderStatusOptions = useMemo<SearchableSelectOption[]>(
    () => [
      {
        value: ALL_ORDER_STATUSES,
        label: t("filters.selectOrderStatus", "Todos"),
      },
      {
        value: "APPROVED",
        label: t("filters.orderStatusApproved", "Aprobado"),
      },
      { value: "PENDING", label: t("filters.orderStatusPending", "Pendiente") },
      {
        value: "COMPLETED",
        label: t("filters.orderStatusCompleted", "Completado"),
      },
      { value: "ANNULLED", label: t("filters.orderStatusAnnulled", "Anulado") },
    ],
    [t]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.titleSalesCustomers")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitleSalesCustomers")}
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
                {t("export.excel", "Exportar a Excel")}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="hover:bg-primary/10 focus:bg-primary/10 flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none"
                onSelect={handleExportPdf}
                disabled={isBusy || !hasDataToExport}
              >
                {t("export.pdf", "Exportar a PDF")}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-neutral-200" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-red-600 outline-none hover:bg-red-50 focus:bg-red-50"
                onSelect={handleClear}
                disabled={isBusy}
              >
                {t("filters.clear", "Limpiar filtros")}
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
          <AccordionTrigger>{t("filters.title", "Filtros")}</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
              {/* Order Number */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.orderNumber")}
                </label>
                <SearchInput
                  placeholder={t("filters.orderNumberPlaceholder")}
                  value={searchTerm}
                  onChange={v => {
                    // Remove all non-alphanumeric characters except # and -
                    const sanitizedValue = v.replace(/[^a-zA-Z0-9#-]/g, "");
                    setSearchTerm(sanitizedValue);
                  }}
                  onSearch={handleSearch}
                  minLength={0}
                />
              </div>

              {/* Customer */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.byCustomer")}
                </label>
                <CustomerSelect
                  value={(filters as any).customerId ?? undefined}
                  onChange={customerId => {
                    if (customerId) {
                      const nextFilters = { ...filters, customerId };
                      setFilters(nextFilters);
                      search(nextFilters).catch(() => {});
                    } else {
                      const { customerId: _omit, ...rest } = filters as any;
                      setFilters(rest);
                      search(rest).catch(() => {});
                    }
                  }}
                  disabled={isBusy}
                />
              </div>

              {/* Location */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.byLocation", "Ubicación")}
                </label>
                <LocationSelect
                  value={(filters as any).locationId ?? undefined}
                  onChange={locationId => {
                    if (locationId) {
                      const nextFilters = { ...filters, locationId };
                      setFilters(nextFilters);
                      search(nextFilters).catch(() => {});
                    } else {
                      const { locationId: _omit, ...rest } = filters as any;
                      setFilters(rest);
                      search(rest).catch(() => {});
                    }
                  }}
                  disabled={isBusy}
                  allowAll={true}
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
                    if (id) {
                      const nextFilters = { ...filters, employeeId: id };
                      setFilters(nextFilters);
                      search(nextFilters).catch(() => {});
                    } else {
                      const { employeeId: _omit, ...rest } = filters as any;
                      setFilters(rest);
                      search(rest).catch(() => {});
                    }
                  }}
                  disabled={isBusy}
                />
              </div>

              {/* From */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.from")}
                </label>
                <DateFilterInput
                  placeholder={todayNumeric}
                  value={(filters as any).from ?? undefined}
                  onChange={next => {
                    const nextFilters = next
                      ? { ...filters, from: next }
                      : (() => {
                          const { from: _omit, ...rest } = filters as any;
                          return rest;
                        })();
                    setFilters(nextFilters);
                    search(nextFilters).catch(() => {});
                  }}
                />
              </div>

              {/* To */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.to")}
                </label>
                <DateFilterInput
                  placeholder={todayNumeric}
                  value={(filters as any).to ?? undefined}
                  onChange={next => {
                    const nextFilters = next
                      ? { ...filters, to: next }
                      : (() => {
                          const { to: _omit, ...rest } = filters as any;
                          return rest;
                        })();
                    setFilters(nextFilters);
                    search(nextFilters).catch(() => {});
                  }}
                />
              </div>

              {/* Payment Method */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.byPaymentMethod", "Método de Pago")}
                </label>
                <SearchableSelect
                  options={paymentMethodOptions}
                  value={paymentMethod ?? ALL_PAYMENT_METHODS}
                  onValueChange={value => {
                    const nextPaymentMethod =
                      value === ALL_PAYMENT_METHODS
                        ? undefined
                        : (value as "CASH" | "CREDIT");
                    setPaymentMethod(nextPaymentMethod);
                    const nextFilters: SalesListUiFilters = {
                      ...filters,
                      ...(nextPaymentMethod
                        ? { paymentMethod: nextPaymentMethod }
                        : {}),
                      // Ensure orderStatus is included if it exists
                      ...(orderStatus ? { orderStatus } : {}),
                    };
                    if (!nextPaymentMethod) {
                      const { paymentMethod: _omit, ...rest } =
                        nextFilters as any;
                      setFilters(rest);
                      search(rest).catch(() => {});
                    } else {
                      setFilters(nextFilters);
                      search(nextFilters).catch(() => {});
                    }
                  }}
                  placeholder={t("filters.selectPaymentMethod", "Todos")}
                  disabled={isBusy}
                  allowSearch={false}
                />
              </div>

              {/* Order Status */}
              <div className="w-full">
                <label className="mb-1 block text-sm text-gray-600 dark:text-gray-300">
                  {t("filters.byOrderStatus", "Estado de Orden")}
                </label>
                <SearchableSelect
                  options={orderStatusOptions}
                  value={orderStatus ?? ALL_ORDER_STATUSES}
                  onValueChange={value => {
                    const nextOrderStatus =
                      value === ALL_ORDER_STATUSES ? undefined : value;
                    setOrderStatus(nextOrderStatus);
                    const nextFilters: SalesListUiFilters = {
                      ...filters,
                      ...(nextOrderStatus
                        ? { orderStatus: nextOrderStatus }
                        : {}),
                      // Ensure paymentMethod is included if it exists
                      ...(paymentMethod ? { paymentMethod } : {}),
                    };
                    if (!nextOrderStatus) {
                      const { orderStatus: _omit, ...rest } =
                        nextFilters as any;
                      setFilters(rest);
                      search(rest).catch(() => {});
                    } else {
                      setFilters(nextFilters);
                      search(nextFilters).catch(() => {});
                    }
                  }}
                  placeholder={t("filters.selectOrderStatus", "Todos")}
                  disabled={isBusy}
                  allowSearch={false}
                />
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
        loading={loading}
        includeHeaders={[
          "Date",
          "Order #",
          "Seller",
          "Customer",
          "Location",
          "Discount",
          "Subtotal",
          "Taxes",
          "Order Total",
          "Payment Type",
          "Discount Code",
          "Status",
        ]}
        {...(previewToShow && {
          title: "",
        })}
        {...(fetchedOnce && {
          pagination: {
            currentPage: pagination.currentPage,
            totalPages: pagination.totalPages,
            totalItems: pagination.totalItems,
            onPageChange: pagination.onPageChange,
            pageSize,
            onPageSizeChange: handlePageSizeChange,
            pageSizeOptions,
          },
        })}
        pageSize={pageSize}
      />
    </div>
  );
}

// Helper Components for Accordion
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

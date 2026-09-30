"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { OrdersTable } from "@/components/tables/orders-table";
import {
  useOrders,
  useAnnulOrder,
  useApproveOrder,
  useExportReceiptPdf,
} from "@/hooks/use-orders";
import { Order, OrdersResponse } from "@/actions/orders";
import type { LocationInfo } from "@esli-cosmetics/types";
import {
  Button,
  SearchInput,
  DateRangePicker,
  type DateRange,
} from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { LocationSelect } from "@/components/ui/location-select";
import { useCurrentUser } from "@/hooks/use-auth";
import { useHasRole } from "@/hooks/use-auth";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface OrdersPageClientProps {
  initialData: OrdersResponse;
}
const ALL_VALUE = "__all__";

/** Format a Date as a local `YYYY-MM-DD` string for API date filters. */
function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function OrdersPageClient({ initialData }: OrdersPageClientProps) {
  const { t, i18n } = useTranslation("orders");
  const router = useRouter();

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<
    string | undefined
  >();
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [isClient, setIsClient] = useState(false);

  // Confirmation dialog hook
  const confirmationDialog = useConfirmationDialog();

  // Toast hook
  const { toast } = useToast();

  // Set client flag to prevent hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Reset page when search, location, or date range changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm, selectedLocationId, dateRange.from, dateRange.to]);

  // Localized labels for the date range picker
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

  // Set location from userData
  const { data: userData } = useCurrentUser();

  const profileLocation = useMemo((): LocationInfo | null => {
    if (!userData) return null;
    const raw = userData.location ?? userData.employee?.location ?? null;
    if (!raw?.id) return null;
    const { branch: _nestedBranch, ...rest } = raw as LocationInfo & {
      branch?: { id: string; name: string; code?: string };
    };
    const defaultBranch =
      userData.branch ?? userData.employee?.location?.branch ?? null;
    const branchId = rest.branchId ?? defaultBranch?.id ?? null;
    return {
      ...rest,
      name: rest.name?.trim() || "Location",
      branchId,
    } as LocationInfo;
  }, [userData]);

  /** So LocationSelect can show the label when the value comes from profile, not the fetched list. */
  const locationSelectCurrentLocation = useMemo(():
    | LocationInfo
    | undefined => {
    if (!profileLocation) return undefined;
    const effectiveId =
      selectedLocationId ??
      userData?.location?.id ??
      userData?.employee?.location?.id;
    return effectiveId === profileLocation.id ? profileLocation : undefined;
  }, [
    profileLocation,
    selectedLocationId,
    userData?.location?.id,
    userData?.employee?.location?.id,
  ]);

  // check for roles
  const isSalesRep = useHasRole("sales_rep");
  const isCashier = useHasRole("cashier");
  // Non-admin users can only view orders for their own assigned location.
  const isLocationLocked = isCashier;

  // API hooks - only enable query after client-side hydration
  const {
    data: ordersData,
    isLoading,
    refetch,
    isFetching,
  } = useOrders(
    {
      page: currentPage,
      limit: pageSize,
      ...(activeSearchTerm && { orderNumber: activeSearchTerm }),
      ...(selectedLocationId && { locationId: selectedLocationId }),
      ...(dateRange.from && { startDate: toYmd(dateRange.from) }),
      ...(dateRange.to && { endDate: toYmd(dateRange.to) }),
    },
    isClient ? undefined : initialData
  );

  const annulOrderMutation = useAnnulOrder();
  const approveOrderMutation = useApproveOrder();
  const exportReceiptPdfMutation = useExportReceiptPdf();

  // Use React Query data or initial data
  const orders = ordersData?.data || initialData.data;
  const pagination = ordersData?.pagination || initialData.pagination;

  // Event handlers
  const handleAnnulOrder = useCallback(
    async (order: Order) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.annulTitle"),
        description: t("confirm.annulDesc", {
          orderNumber: order.orderNumber,
        }),
        confirmText: t("confirm.annulButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await annulOrderMutation.mutateAsync(order.id);
          await refetch();
          toast({
            title: t("toast.success"),
            description: t("toast.annulled"),
            type: "success",
          });
        } catch (error) {
          let errorMessage = t("toast.annulFailed");

          if (error instanceof Error) {
            const errorString = error.message;
            // Extract message from "API Error: 400 - Order is already annulled"
            const parts = errorString.split(" - ");
            const actualMessage =
              parts.length > 1
                ? parts.slice(1).join(" - ").trim()
                : errorString;

            // Check if error indicates order is already annulled
            if (actualMessage.toLowerCase().includes("already annulled")) {
              errorMessage = t("toast.alreadyAnnulled");
            } else {
              errorMessage = actualMessage;
            }
          }

          toast({
            title: t("toast.error"),
            description: errorMessage,
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, annulOrderMutation, refetch, toast, t]
  );

  const handleViewOrder = useCallback(
    (order: Order) => {
      router.push(`/sales/orders/${order.id}`);
    },
    [router]
  );

  const handleApproveOrder = useCallback(
    async (order: Order) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.approveTitle"),
        description: t("confirm.approveDesc", {
          orderNumber: order.orderNumber,
        }),
        confirmText: t("confirm.approveButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await approveOrderMutation.mutateAsync(order.id);
          await refetch();
          toast({
            title: t("toast.success"),
            description: t("toast.approved"),
            type: "success",
          });
        } catch (error) {
          toast({
            title: t("toast.error"),
            description:
              error instanceof Error ? error.message : t("toast.approveFailed"),
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, approveOrderMutation, refetch, toast, t]
  );

  const handleCreateClick = useCallback(() => {
    router.push("/sales/pos");
  }, [router]);

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

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
  }, []);

  const handleExportPdf = useCallback(
    async (order: Order) => {
      try {
        const result = await exportReceiptPdfMutation.mutateAsync(order.id);

        // Download the PDF
        const byteChars = atob(result.base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], {
          type: "application/pdf",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.fileName;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: t("toast.success"),
          description: t("table.exportPdf") || "Receipt exported successfully",
          type: "success",
        });
      } catch (error) {
        toast({
          title: t("toast.error"),
          description:
            error instanceof Error
              ? error.message
              : t("toast.error") || "Failed to export receipt",
          type: "error",
        });
      }
    },
    [exportReceiptPdfMutation, toast, t]
  );

  // Apply the user's default location only once on initial load. Without this
  // guard, clearing the filter to "All locations" (which sets the id to
  // undefined) would immediately be reverted back to the user's own location.
  const hasInitializedLocation = useRef(false);
  useEffect(() => {
    if (hasInitializedLocation.current) return;
    const locId = userData?.location?.id ?? userData?.employee?.location?.id;
    if (locId) {
      hasInitializedLocation.current = true;
      if (!selectedLocationId) {
        setSelectedLocationId(locId);
      }
    }
  }, [userData, selectedLocationId]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitle")}
          </p>
        </div>
        {!isSalesRep && (
          <Button
            onClick={handleCreateClick}
            variant="primary"
            leftIcon={<PlusIcon className="h-4 w-4" />}
            className="w-full md:w-auto"
          >
            {t("page.addButton")}
          </Button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:space-x-4 md:space-y-0">
        <div className="relative w-full flex-1 md:w-auto md:max-w-md">
          <SearchInput
            placeholder={t("page.searchPlaceholder")}
            value={searchTerm}
            onChange={setSearchTerm}
            onSearch={handleSearch}
            minLength={0}
          />
          {isFetching && activeSearchTerm && (
            <p className="mt-1 text-xs text-gray-500">{t("page.searching")}</p>
          )}
        </div>
        <div className="w-full md:m-0 md:w-72">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            placeholder={t("page.dateRangeFilter")}
            labels={dateRangeLabels}
            locale={i18n.language}
            maxDate={new Date()}
            align="start"
          />
        </div>
        <div className="w-full md:m-0 md:w-80">
          <LocationSelect
            allowAll={true}
            value={
              isLocationLocked
                ? (selectedLocationId ??
                  userData?.location?.id ??
                  userData?.employee?.location?.id ??
                  ALL_VALUE)
                : selectedLocationId || ALL_VALUE
            }
            currentLocation={locationSelectCurrentLocation}
            onChange={locationId =>
              isLocationLocked
                ? undefined
                : locationId === undefined || locationId === ALL_VALUE
                  ? setSelectedLocationId(undefined)
                  : setSelectedLocationId(locationId)
            }
            placeholder={t("page.locationFilter")}
            disabled={isLocationLocked}
          />
        </div>
      </div>

      {/* Orders Table */}
      <OrdersTable
        orders={orders}
        onView={handleViewOrder}
        onAnnul={handleAnnulOrder}
        onApprove={handleApproveOrder}
        onExportPdf={handleExportPdf}
        isLoading={isLoading || isFetching}
        pagination={{
          currentPage: pagination?.page || 1,
          totalPages: pagination?.totalPages || 1,
          onPageChange: handlePageChange,
          totalItems: pagination?.total || 0,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

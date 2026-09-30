"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter } from "next/navigation";
import { QuotesTable } from "@/components/tables/quotes-table";
import { useQuotes, useDeleteQuote, useAnnulQuote } from "@/hooks/use-quotes";
import type {
  Quote,
  PaginatedQuotes,
  LocationInfo,
} from "@esli-cosmetics/types";
import {
  Button,
  SearchInput,
  SearchableSelect,
  type SearchableSelectOption,
  DateRangePicker,
  type DateRange,
} from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { LocationSelect } from "@/components/ui/location-select";
import { useCurrentUser } from "@/hooks/use-auth";
import { useHasRole } from "@/hooks/use-auth";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

// Special value for "All Statuses" option (Radix UI Select doesn't allow empty strings)
const ALL_STATUSES_VALUE = "__all__";
const ALL_VALUE = "__all__";
interface QuotesPageClientProps {
  initialData: PaginatedQuotes;
}

/** Format a Date as a local `YYYY-MM-DD` string for API date filters. */
function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function QuotesPageClient({ initialData }: QuotesPageClientProps) {
  const { t, i18n } = useTranslation("quotes");
  const router = useRouter();
  const { data: userData } = useCurrentUser();

  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState<
    string | undefined
  >();
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<DateRange>({});
  const [isClient, setIsClient] = useState(false);

  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();
  const pathname = usePathname();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeSearchTerm,
    selectedLocationId,
    selectedStatus,
    dateRange.from,
    dateRange.to,
  ]);

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

  const {
    data: quotesData,
    isLoading,
    refetch,
    isFetching,
  } = useQuotes(
    {
      page: currentPage,
      limit: pageSize,
      ...(activeSearchTerm && { quoteNumber: activeSearchTerm }),
      ...(selectedLocationId && { locationId: selectedLocationId }),
      ...(selectedStatus && { status: selectedStatus }),
      ...(dateRange.from && { startDate: toYmd(dateRange.from) }),
      ...(dateRange.to && { endDate: toYmd(dateRange.to) }),
    },
    isClient ? undefined : initialData
  );

  const deleteQuoteMutation = useDeleteQuote();

  const quotes = quotesData?.data || initialData.data;
  const pagination = quotesData || initialData;

  const annulQuoteMutation = useAnnulQuote();

  const handleAnnulQuote = useCallback(
    async (quote: Quote) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.annulTitle") || "Annul Quote",
        description:
          t("confirm.annulDesc", {
            quoteNumber: quote.quoteNumber || quote.id,
          }) ||
          `Are you sure you want to annul quote ${quote.quoteNumber || quote.id}?`,
        confirmText: t("confirm.annulButton") || "Annul",
        cancelText: t("confirm.cancel") || "Cancel",
      });

      if (confirmed) {
        try {
          await annulQuoteMutation.mutateAsync({
            id: quote.id,
            userId: userData?.id || "",
          });
          await refetch();
          toast({
            title: t("toast.success") || "Success",
            description:
              t("toast.annulledQuoteDescription") ||
              "Quote annulled successfully",
            type: "success",
          });
        } catch (error) {
          toast({
            title: t("toast.error") || "Error",
            description:
              error instanceof Error
                ? error.message
                : t("toast.annulFailed") || "Failed to annul quote",
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, annulQuoteMutation, refetch, toast, t, userData]
  );

  const handleDeleteQuote = useCallback(
    async (quote: Quote) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle") || "Delete Quote",
        description:
          t("confirm.deleteDesc", {
            quoteNumber: quote.quoteNumber || quote.id,
          }) ||
          `Are you sure you want to delete quote ${quote.quoteNumber || quote.id}?`,
        confirmText: t("confirm.deleteButton") || "Delete",
        cancelText: t("confirm.cancel") || "Cancel",
      });

      if (confirmed) {
        try {
          await deleteQuoteMutation.mutateAsync(quote.id);
          await refetch();
          toast({
            title: t("toast.success") || "Success",
            description: t("toast.deleted") || "Quote deleted successfully",
            type: "success",
          });
        } catch (error) {
          toast({
            title: t("toast.error") || "Error",
            description:
              error instanceof Error
                ? error.message
                : t("toast.deleteFailed") || "Failed to delete quote",
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, deleteQuoteMutation, refetch, toast, t]
  );

  const handleViewQuote = useCallback(
    (quote: Quote) => {
      router.push(`/sales/quotes/${quote.id}`);
    },
    [router]
  );

  const handleEditQuote = useCallback(
    (quote: Quote) => {
      router.push(`/sales/quotes/${quote.id}/edit`);
    },
    [router]
  );

  const handleViewOrder = useCallback(
    (orderId: string) => {
      router.push(`/sales/orders/${orderId}`);
    },
    [router]
  );

  const handleCreateClick = useCallback(() => {
    router.push("/sales/quotes/new");
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

  // Status options for SearchableSelect
  const statusOptions = useMemo<SearchableSelectOption[]>(() => {
    const options: SearchableSelectOption[] = [
      {
        value: ALL_STATUSES_VALUE,
        label: t("status.all") || "All Statuses",
      },
      {
        value: "DRAFT",
        label: t("status.draft") || "Draft",
      },
      {
        value: "APPROVED",
        label: t("status.approved") || "Approved",
      },
      {
        value: "EXPIRED",
        label: t("status.expired") || "Expired",
      },
      {
        value: "CONVERTED",
        label: t("status.converted") || "Converted",
      },
    ];
    return options;
  }, [t]);

  const handleStatusChange = useCallback((value: string) => {
    if (value === ALL_STATUSES_VALUE) {
      setSelectedStatus(undefined);
    } else {
      setSelectedStatus(value);
    }
  }, []);

  const isCashier = useHasRole("cashier");
  // Non-admin users can only view quotes for their own assigned location.
  const isLocationLocked = isCashier;

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

  useEffect(() => {
    refetch();
  }, [pathname, refetch]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.title") || "Quotes"}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitle") || "Manage and view quotes"}
          </p>
        </div>
        <Button
          onClick={handleCreateClick}
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          className="w-full md:w-auto"
        >
          {t("page.addButton") || "New Quote"}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col items-center space-x-0 space-y-4 md:flex-row md:space-x-4 md:space-y-0">
        <div className="relative w-full flex-1 md:w-auto md:max-w-md">
          <SearchInput
            placeholder={
              t("page.searchPlaceholder") || "Search by quote number..."
            }
            value={searchTerm}
            onChange={setSearchTerm}
            onSearch={handleSearch}
            minLength={0}
          />
          {isFetching && activeSearchTerm && (
            <p className="mt-1 text-xs text-gray-500">
              {t("page.searching") || "Searching..."}
            </p>
          )}
        </div>
        <div className="w-full md:mx-0 md:w-72">
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
        <div className="w-full md:mx-0 md:w-64">
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
            onChange={locationId => {
              if (isLocationLocked) return;
              if (locationId === undefined || locationId === ALL_VALUE) {
                setSelectedLocationId(undefined);
              } else {
                setSelectedLocationId(locationId);
              }
            }}
            placeholder={t("page.locationFilter") || "Filter by location"}
            disabled={isLocationLocked}
          />
        </div>
        <div className="w-full md:mx-0 md:w-48">
          <SearchableSelect
            options={statusOptions}
            value={selectedStatus || ALL_STATUSES_VALUE}
            onValueChange={handleStatusChange}
            placeholder={t("status.all") || "All Statuses"}
            className="[&_button]:bg-white [&_button]:dark:bg-gray-800"
            allowSearch={false}
          />
        </div>
      </div>

      {/* Quotes Table */}
      <QuotesTable
        quotes={quotes}
        onView={handleViewQuote}
        onEdit={handleEditQuote}
        onAnnul={handleAnnulQuote}
        onDelete={handleDeleteQuote}
        onViewOrder={handleViewOrder}
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

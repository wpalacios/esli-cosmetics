"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BiTime,
  BiSolidCreditCard,
  BiSolidPurchaseTag,
  BiSolidUserBadge,
  BiChevronDown,
  BiChevronUp,
  BiReceipt,
} from "react-icons/bi";
import { useTranslation } from "react-i18next";
import { Badge, Button } from "@esli-cosmetics/ui";
import { formatCurrencyValue } from "@esli-cosmetics/utils";
import { LocationSelect } from "@/components/ui/location-select";
import { EmployeeSelect } from "@/components/ui/employee-select";
import { CustomerSelect } from "@/components/ui/customer-select";
import { CashRegisterSelect } from "@/components/ui/cash-register-select";
import type { SelectedEmployee, SelectedCustomer } from "../pos-page-client";
import type {
  LocationInfo,
  EmployeeWithRelations,
  CashRegister,
} from "@esli-cosmetics/types";
import { usePathname } from "next/navigation";

interface POSHeaderProps {
  title?: string;
  selectedLocation: LocationInfo | null;
  onSelectLocation: (location: LocationInfo | null) => void;
  locationSelectDisabled?: boolean;
  selectedCashRegister?: CashRegister | null;
  onSelectCashRegister?: (cashRegister: CashRegister | null) => void;
  cashRegisterSelectDisabled?: boolean;
  selectedCashier: SelectedEmployee | null;
  onSelectCashier: (cashier: SelectedEmployee | null) => void;
  cashierSelectDisabled?: boolean;
  selectedSeller: SelectedEmployee | null;
  sellerSelectDisabled?: boolean;
  onSelectSeller: (seller: SelectedEmployee | null) => void;
  selectedCustomer: SelectedCustomer | null;
  onSelectCustomer: (customer: SelectedCustomer | null) => void;
  currentCustomerObject?: any;
  cashRegisterOptions?: React.ReactNode;
  currentSession?:
    | {
        employeeId: string;
        cashRegister?: {
          name?: string;
        };
      }
    | null
    | undefined;
  showCashRegisterSelect?: boolean;
  isQuoteMode?: boolean;
  quoteStatus?: string | undefined;
  quoteNumber?: string | undefined;
  disabled?: boolean;
}

export function POSHeader({
  title,
  selectedLocation,
  onSelectLocation,
  locationSelectDisabled = false,
  selectedCashRegister,
  onSelectCashRegister,
  cashRegisterSelectDisabled = false,
  selectedCashier,
  onSelectCashier,
  cashierSelectDisabled = false,
  selectedSeller,
  onSelectSeller,
  sellerSelectDisabled = false,
  selectedCustomer,
  onSelectCustomer,
  currentCustomerObject,
  cashRegisterOptions,
  currentSession,
  showCashRegisterSelect = true,
  isQuoteMode = false,
  quoteStatus,
  quoteNumber,
  disabled = false,
}: POSHeaderProps) {
  const { t, i18n } = useTranslation("pos");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const pathname = usePathname();
  // Check for POS page - matches /sales/pos and /sales/pos/*
  const isPOSPage = Boolean(pathname?.startsWith("/sales/pos"));
  // Check for Quotes page - matches /sales/quotes and /sales/quotes/*
  const isQuotesPage = Boolean(pathname?.startsWith("/sales/quotes"));

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCustomerChange = (
    customerId: string | undefined,
    customerData?: any
  ) => {
    if (!customerId || !customerData) {
      onSelectCustomer(null);
      return;
    }

    // Use customer data directly from the select component
    onSelectCustomer({
      id: customerData.id,
      name: `${customerData.person?.firstName || ""} ${customerData.person?.lastName || ""}`.trim(),
      email: customerData.person?.email,
      phone: customerData.person?.phone,
      customerType: customerData.customerType || null,
      priceTypes: customerData.priceTypes || [],
      creditAllowed: customerData.creditAllowed,
      creditLimit: customerData.creditLimit,
    });
  };

  const formatTime = (date: Date) => {
    // Map i18n language codes to locale codes
    const locale = i18n.language === "es" ? "es-ES" : "en-US";
    return date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleLocationChange = useCallback(
    (locationId: string | undefined, locationData?: LocationInfo) => {
      if (!locationId || !locationData) {
        // Only update if currently has a location selected
        if (selectedLocation) {
          onSelectLocation(null);
        }
        return;
      }

      // Only update if location ID actually changed (prevents unnecessary updates from object reference changes)
      if (selectedLocation?.id === locationId) {
        return;
      }

      // Use location data directly from the select component
      onSelectLocation({
        ...locationData,
      });
    },
    [selectedLocation, onSelectLocation]
  );

  const handleCashierChange = (
    employeeId: string | undefined,
    employeeData?: EmployeeWithRelations
  ) => {
    if (!employeeId || !employeeData) {
      onSelectCashier(null);
      return;
    }

    // Use employee data directly from the select component
    onSelectCashier({
      id: employeeData.id,
      name: `${employeeData.person?.firstName || ""} ${employeeData.person?.lastName || ""}`.trim(),
      fullEmployeeObject: employeeData,
    });
  };

  const handleSellerChange = (
    employeeId: string | undefined,
    employeeData?: EmployeeWithRelations
  ) => {
    if (!employeeId || !employeeData) {
      onSelectSeller(null);
      return;
    }

    // Use employee data directly from the select component
    onSelectSeller({
      id: employeeData.id,
      name: `${employeeData.person?.firstName || ""} ${employeeData.person?.lastName || ""}`.trim(),
      fullEmployeeObject: employeeData,
    });
  };

  const cashRegisterName = currentSession?.cashRegister?.name || "";

  const getStatusBadgeStyles = (status: string) => {
    // if no status or unrecognized status, return default gray styles
    if (!status)
      return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    switch (status?.toUpperCase()) {
      case "APPROVED":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "EXPIRED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "CONVERTED":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "ANNULLED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  return (
    <div className="relative z-10 border-b border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      {/* 1. TOP BAR (Title, Clock and Actions) */}
      <div className="px-3 py-2 sm:px-4 sm:py-3 md:px-6">
        {/* CASE A: MOBILE VIEW EXCLUSIVE FOR QUOTES (Create and Edit) */}
        {isQuoteMode ? (
          <div className="flex w-full flex-col gap-2 sm:hidden">
            {/* Title, Number and Cash Register */}
            <div className="flex flex-col">
              <h1 className="truncate text-lg font-bold text-gray-900 dark:text-white">
                {title?.startsWith("Editar")
                  ? t("productSearch.editQuote")
                  : t("productSearch.createQuote")}
              </h1>
              {/* Quote Number */}
              {quoteNumber && (
                <div className="text-ml mt-0.5 font-mono font-bold text-gray-900 dark:text-white">
                  {quoteNumber}
                </div>
              )}
              {/* Selected Cash Register (Appears below the number) */}
              {cashRegisterName && (
                <div className="mt-0.5 text-xs font-bold uppercase text-gray-900 dark:text-white">
                  {cashRegisterName}
                </div>
              )}
            </div>

            {/*  Badge (left) Clock (right) */}
            <div className="mt-1 flex w-full items-center justify-between">
              {/* 1 BADGE (left) */}
              {quoteStatus && (
                <Badge
                  variant="outline"
                  className={`shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase ${getStatusBadgeStyles(quoteStatus || "")}`}
                >
                  {t(`quotes:status.${quoteStatus.toLowerCase()}`)}
                </Badge>
              )}

              {/* 2. Clock (right) */}
              <div className="flex w-[105px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#ff48b0]/20 bg-gradient-to-br from-[#ff48b0]/10 via-[#f5b1cc]/10 to-purple-50 px-2 py-1.5 shadow-sm">
                <BiTime className="h-3.5 w-3.5 flex-shrink-0 text-[#ff48b0]" />
                <span className="text-xs font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
                  {formatTime(currentTime)}
                </span>
              </div>
            </div>

            {/* Action Button (Takes full width) */}
            {cashRegisterOptions && (
              <div className="mt-1 w-full">
                <div className="shadow-sm [&>button]:h-11 [&>button]:w-full [&>button]:border-[#ff48b0] [&>button]:font-bold [&_svg]:text-current">
                  {cashRegisterOptions}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* CASE B: STANDARD VIEW (MOBILE POS AND ALL DESKTOP) */}
        <div
          className={`${isQuoteMode ? "hidden sm:flex" : "flex"} flex-col justify-between gap-3 sm:flex-row sm:items-center`}
        >
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="truncate text-lg font-bold text-gray-900 dark:text-white sm:text-xl md:text-2xl">
                {title || t("header.title")}
              </h1>
              {isQuoteMode && (
                <Badge
                  variant="outline"
                  className={`hidden whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase sm:inline-flex ${getStatusBadgeStyles(quoteStatus || "DRAFT")}`}
                >
                  {t(
                    `quotes:status.${(quoteStatus || "DRAFT").toLowerCase()}`
                  ) ||
                    quoteStatus ||
                    "BORRADOR"}
                </Badge>
              )}
            </div>
            {cashRegisterName && (
              <span className="mt-0.5 text-xs font-bold text-gray-900 dark:text-white sm:text-sm">
                {cashRegisterName}
              </span>
            )}
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            {cashRegisterOptions && (
              <div className="order-1 flex-1 sm:flex-initial">
                <div className="[&>button]:flex [&>button]:h-10 [&>button]:w-16 [&>button]:justify-center [&>button]:border-[#ff48b0] [&>button]:font-normal sm:[&>button]:w-auto [&_svg]:text-current">
                  {cashRegisterOptions}
                </div>
              </div>
            )}

            <div className="order-2 flex shrink-0 items-center gap-2">
              <div className="flex min-w-[85px] items-center justify-center gap-1.5 rounded-lg border border-[#ff48b0]/20 bg-gradient-to-br from-[#ff48b0]/10 via-[#f5b1cc]/10 to-purple-50 px-2 py-1.5 shadow-sm sm:min-w-[105px] sm:gap-2 sm:px-3 sm:py-2">
                <BiTime className="h-3.5 w-3.5 flex-shrink-0 text-[#ff48b0] sm:h-4 sm:w-4" />
                <span className="text-xs font-bold tabular-nums tracking-tight text-gray-900 dark:text-white sm:text-sm">
                  {formatTime(currentTime)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Section - Collapsible on Mobile */}
      <div className="border-t border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {/* Mobile Toggle Button */}
        <button
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className="flex w-full items-center justify-between px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 sm:px-4 sm:py-3 md:px-6 lg:hidden"
          aria-label={
            isFiltersOpen ? t("header.hideFilters") : t("header.showFilters")
          }
        >
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm">
            {t("header.filters")}
          </span>
          {isFiltersOpen ? (
            <BiChevronUp className="h-4 w-4 text-gray-600 dark:text-gray-400 sm:h-5 sm:w-5" />
          ) : (
            <BiChevronDown className="h-4 w-4 text-gray-600 dark:text-gray-400 sm:h-5 sm:w-5" />
          )}
        </button>

        {/* Filters Content - Always visible on desktop, collapsible on mobile */}
        <div
          className={`px-3 transition-all duration-300 ease-in-out sm:px-4 md:px-6 ${
            isFiltersOpen
              ? "max-h-[2000px] opacity-100"
              : "max-h-0 overflow-hidden opacity-0"
          } lg:max-h-none lg:overflow-visible lg:py-3 lg:opacity-100 ${
            isFiltersOpen ? "py-3 sm:py-4" : ""
          }`}
        >
          {/* Status Indicators - Quick View - Now inside filters */}
          <div className="mb-4 border-b border-gray-200 pb-4 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-2">
              {/* Client Type Status */}
              {selectedCustomer?.customerType && (
                <div className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-500/10 px-2 py-1 shadow-sm backdrop-blur-sm dark:border-indigo-800 dark:bg-indigo-500/20 sm:gap-2">
                  <BiSolidUserBadge className="size-3.5 flex-shrink-0 text-indigo-600 dark:text-indigo-400 sm:size-4" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300 sm:text-xs">
                    {t("header.customerType")}
                  </span>
                  <span className="max-w-[100px] truncate text-xs font-medium text-indigo-900 dark:text-indigo-100 sm:max-w-[150px] sm:text-sm md:max-w-[200px]">
                    {selectedCustomer.customerType.name}
                  </span>
                </div>
              )}

              {/* Price Types Status */}
              {selectedCustomer?.priceTypes &&
                Array.isArray(selectedCustomer.priceTypes) &&
                selectedCustomer.priceTypes.some(pt => pt.isActive) && (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff48b0]/20 bg-gradient-to-r from-[#ff48b0]/10 to-[#f5b1cc]/10 px-2 py-1 shadow-sm backdrop-blur-sm dark:border-[#ff48b0]/30 dark:from-[#ff48b0]/20 dark:to-[#f5b1cc]/20 sm:gap-2">
                    <BiSolidPurchaseTag className="size-3.5 flex-shrink-0 text-[#ff48b0] dark:text-[#ff48b0] sm:size-4" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#ff48b0] dark:text-[#ff48b0] sm:text-xs">
                      {t("header.priceTypes")}
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      {(() => {
                        const activePriceTypes =
                          selectedCustomer.priceTypes
                            ?.filter(pt => pt.isActive)
                            .sort((a, b) => a.priority - b.priority) || [];

                        return activePriceTypes.map(priceType => (
                          <Badge
                            key={priceType.id}
                            variant="secondary"
                            className="rounded-md border border-primary-200 bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700 shadow-sm dark:border-primary-800 dark:bg-primary-900/40 dark:text-primary-200 sm:px-2 sm:text-xs"
                          >
                            {priceType.name}
                          </Badge>
                        ));
                      })()}
                    </div>
                  </div>
                )}

              {/* Credit Limit Status */}
              {selectedCustomer?.creditAllowed &&
                selectedCustomer.creditLimit && (
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-500/10 px-2 py-1 shadow-sm backdrop-blur-sm dark:border-amber-800 dark:bg-amber-500/20 sm:gap-2">
                    <BiSolidCreditCard className="size-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400 sm:size-4" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 sm:text-xs">
                      {t("header.creditLimit")}
                    </span>
                    <span className="text-xs font-bold text-amber-900 dark:text-amber-100 sm:text-sm">
                      {formatCurrencyValue(selectedCustomer.creditLimit)}
                    </span>
                  </div>
                )}

              {/* Statement Button */}
              {selectedCustomer?.id && (
                <Button
                  variant="outline"
                  color="primary"
                  size="sm"
                  className="shrink-0 gap-1.5 text-[10px] sm:gap-2 sm:text-xs"
                  onClick={() =>
                    window.open(
                      `/sales/customers/${selectedCustomer.id}/statement`,
                      "_blank"
                    )
                  }
                  title={t("header.viewStatement") || "View Statement"}
                  aria-label={t("header.viewStatement") || "View Statement"}
                >
                  <BiReceipt className="size-3.5 sm:size-4" />
                  <span className="hidden font-semibold tracking-wide sm:inline">
                    {t("header.statement") || "Statement"}
                  </span>
                </Button>
              )}
            </div>
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 xl:grid-cols-6">
            {/* Location */}
            <div className="space-y-1.5 sm:space-y-2">
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 sm:text-sm">
                {t("header.location")}
              </label>
              <LocationSelect
                value={selectedLocation?.id}
                currentLocation={selectedLocation}
                onChange={handleLocationChange}
                placeholder={t("header.selectLocation")}
                disabled={locationSelectDisabled || disabled}
              />
            </div>

            {/* Cash Register */}
            {showCashRegisterSelect && (
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {t("header.cashRegister") || "Caja Registradora"}
                </label>
                <CashRegisterSelect
                  value={selectedCashRegister?.id}
                  onChange={(cashRegisterId, cashRegister) => {
                    onSelectCashRegister?.(cashRegister || null);
                  }}
                  placeholder={
                    t("header.selectCashRegister") || "Seleccionar caja"
                  }
                  locationId={selectedLocation?.id}
                  disabled={cashRegisterSelectDisabled || disabled}
                />
              </div>
            )}

            {/* Cashier */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t("header.cashier")}
              </label>
              <EmployeeSelect
                value={selectedCashier?.id}
                currentEmployee={selectedCashier?.fullEmployeeObject}
                disabled={cashierSelectDisabled || disabled}
                onChange={handleCashierChange}
                placeholder={t("header.selectCashier")}
              />
            </div>

            {/* Seller */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t("header.seller")}
              </label>
              <EmployeeSelect
                value={selectedSeller?.id}
                currentEmployee={selectedSeller?.fullEmployeeObject}
                disabled={sellerSelectDisabled || disabled}
                onChange={handleSellerChange}
                placeholder={t("header.selectSeller")}
              />
            </div>

            {/* Customer */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                {t("header.customer")}
              </label>
              <CustomerSelect
                value={selectedCustomer?.id}
                onChange={handleCustomerChange}
                placeholder={t("header.selectCustomer")}
                allowNone={false}
                currentCustomer={currentCustomerObject}
                disabled={disabled}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

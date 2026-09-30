"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CashRegister } from "@esli-cosmetics/types";
import {
  useCashRegisters,
  useOpenCashSessionsByLocation,
} from "~/hooks/use-cash-register";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";

interface CashRegisterSelectProps {
  value?: string | undefined;
  onChange: (
    cashRegisterId: string | undefined,
    cashRegister?: CashRegister
  ) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  currentCashRegister?: CashRegister | undefined;
  locationId?: string | undefined;
  renderOption?: (option: any) => React.ReactNode;
}

export function CashRegisterSelect({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
  currentCashRegister,
  locationId,
  renderOption,
}: CashRegisterSelectProps) {
  const { t } = useTranslation("cash-register");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  const isSearching = activeSearchTerm.trim().length > 0;

  // Handle search - trigger on Enter key
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  const handleSearchTrigger = () => {
    setActiveSearchTerm(searchTerm);
  };

  // Fetch all cash registers when not searching
  const { data: allCashRegistersData, isLoading: isLoadingAll } =
    useCashRegisters(
      locationId ? { locationId, isActive: true } : { isActive: true }
    );

  // Fetch open cash sessions for the location
  const { data: openSessions } = useOpenCashSessionsByLocation(locationId);

  // For searching, we'll use the same hook but with different filters
  // Since we don't have a search endpoint, we'll filter client-side
  const cashRegisters = allCashRegistersData?.data || [];

  // Client-side filtering when searching
  const filteredCashRegisters = useMemo(() => {
    if (!isSearching) return cashRegisters;

    const search = activeSearchTerm.toLowerCase();
    return cashRegisters.filter(
      register =>
        register.name?.toLowerCase().includes(search) ||
        register.code?.toLowerCase().includes(search) ||
        register.location?.name?.toLowerCase().includes(search)
    );
  }, [cashRegisters, activeSearchTerm, isSearching]);

  // Map cash registers to options
  const cashRegisterOptions = useMemo<
    SearchableSelectOption<CashRegister>[]
  >(() => {
    const optionsMap = new Map<string, SearchableSelectOption<CashRegister>>();

    // Add current cash register first if it exists and has a valid ID
    if (currentCashRegister?.id) {
      optionsMap.set(currentCashRegister.id, {
        value: currentCashRegister.id,
        label: `${currentCashRegister.name}${currentCashRegister.code ? ` (${currentCashRegister.code})` : ""}`,
        data: currentCashRegister,
      });
    }

    // Add fetched/filtered cash registers
    filteredCashRegisters.forEach(register => {
      if (register?.id) {
        optionsMap.set(register.id, {
          value: register.id,
          label: register.location?.name
            ? `${register.name} • ${register.location.name}`
            : register.name,
          data: register,
        });
      }
    });

    return Array.from(optionsMap.values());
  }, [filteredCashRegisters, currentCashRegister]);

  const defaultPlaceholder = placeholder || t("open.selectRegister");

  return (
    <SearchableSelect<CashRegister>
      options={cashRegisterOptions}
      {...(value ? { value } : {})}
      onValueChange={cashRegisterId => {
        // Find the full cash register object from options
        const selectedRegister = cashRegisterOptions.find(
          opt => opt.value === cashRegisterId
        )?.data;
        onChange(cashRegisterId, selectedRegister);
      }}
      placeholder={defaultPlaceholder}
      disabled={disabled || !locationId}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      searchPlaceholder={
        !locationId
          ? t("open.selectLocation") || "Select a location first"
          : t("open.searchRegister") || "Search cash registers..."
      }
      emptyMessage={
        isSearching
          ? t("open.noRegistersFound") || "No cash registers found"
          : t("status.noRegisters") || "No cash registers available"
      }
      onSearchChange={handleSearchChange}
      onSearchTrigger={handleSearchTrigger}
      isLoading={isLoadingAll}
      loadingMessage={t("common.loading") || "Loading..."}
      renderOption={
        renderOption
          ? renderOption
          : option => {
              // Check if this cash register has an open session
              const isOpenSession = openSessions?.some(
                session =>
                  session.cashRegisterId === option.data?.id &&
                  session.status === "open"
              );
              const status = isOpenSession ? "open" : "closed";
              const openSession = openSessions?.find(
                session =>
                  session.cashRegisterId === option.data?.id &&
                  session.status === "open"
              );

              return (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate font-medium text-gray-900 dark:text-white">
                      {option.data?.name || option.label}
                    </div>
                    <span
                      className={`ml-2 shrink-0 rounded px-2 py-0.5 text-xs font-bold ${
                        status === "open"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                      } `}
                    >
                      {t(`status.${status}`)}
                    </span>
                  </div>
                  {(option.data?.code ||
                    option.data?.location?.name ||
                    isOpenSession) && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      {option.data?.code && (
                        <span className="font-mono">{option.data.code}</span>
                      )}
                      {option.data?.location?.name && (
                        <span className="text-xs">
                          • {option.data.location.name}
                        </span>
                      )}
                      {isOpenSession && openSession?.employee?.person && (
                        <span className="text-xs">
                          • {t("session.openedBy") ?? "Opened by"}:{" "}
                          {`${openSession.employee.person.firstName ?? ""} ${openSession.employee.person.lastName ?? ""}`.trim()}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            }
      }
    />
  );
}

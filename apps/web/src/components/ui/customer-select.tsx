"use client";

import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";
import { useCustomers } from "@/hooks/use-customers";

interface CustomerSelectProps {
  value?: string | undefined;
  onChange: (customerId: string | undefined, customer?: any) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  allowNone?: boolean;
  currentCustomer?: any;
}

const NONE_VALUE = "__none__";

export function CustomerSelect({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
  allowNone = true,
  currentCustomer,
}: CustomerSelectProps) {
  const { t } = useTranslation("pos");
  const defaultPlaceholder = placeholder || t("customerSelect.placeholder");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  const isSearching = activeSearchTerm.trim().length > 0;

  // Fetch customers (with or without search)
  const { data: customersData, isLoading } = useCustomers({
    page: 1,
    limit: 10,
    ...(isSearching && { search: activeSearchTerm }),
  });

  // Handle search - trigger on Enter key
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  const handleSearchTrigger = () => {
    setActiveSearchTerm(searchTerm);
  };

  const customers = customersData?.data || [];

  // Build customer options
  const customerOptions = useMemo<SearchableSelectOption<any>[]>(() => {
    const optionsMap = new Map<string, SearchableSelectOption<any>>();

    // Add "None" option if allowed
    if (allowNone) {
      optionsMap.set(NONE_VALUE, {
        value: NONE_VALUE,
        label: t("customerSelect.guestWalkIn"),
        data: null,
      });
    }

    // Add current customer first if it exists (ensures it's available even if not in first page)
    // This ensures the current customer is always available, even if not in the first page
    if (currentCustomer?.id) {
      const fullName =
        `${currentCustomer.person?.firstName || ""} ${currentCustomer.person?.lastName || ""}`.trim();
      optionsMap.set(currentCustomer.id, {
        value: currentCustomer.id,
        label: fullName || t("customerSelect.unnamedCustomer"),
        data: currentCustomer,
      });
    }

    // Add fetched customers (will overwrite currentCustomer if it's in the fetched list, but that's fine)
    customers.forEach((customer: any) => {
      if (customer?.id) {
        const fullName =
          `${customer.person?.firstName || ""} ${customer.person?.lastName || ""}`.trim();
        optionsMap.set(customer.id, {
          value: customer.id,
          label: fullName || t("customerSelect.unnamedCustomer"),
          data: customer,
        });
      }
    });

    return Array.from(optionsMap.values());
  }, [customers, currentCustomer, allowNone, t]);

  // Handle value change
  const handleValueChange = (newValue: string | undefined) => {
    if (newValue === NONE_VALUE || !newValue) {
      onChange(undefined, undefined);
    } else {
      const selectedOption = customerOptions.find(
        opt => opt.value === newValue
      );
      onChange(newValue, selectedOption?.data);
    }
  };

  // Map value for the select (handle "none" case)
  const selectValue = value || (allowNone ? NONE_VALUE : undefined);

  return (
    <SearchableSelect<any>
      options={customerOptions}
      {...(selectValue ? { value: selectValue } : {})}
      onValueChange={handleValueChange}
      placeholder={defaultPlaceholder}
      disabled={disabled}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      searchPlaceholder={t("customerSelect.searchPlaceholder")}
      emptyMessage={
        isSearching
          ? t("customerSelect.noCustomersFound")
          : t("customerSelect.startTyping")
      }
      onSearchChange={handleSearchChange}
      onSearchTrigger={handleSearchTrigger}
      isLoading={isLoading}
      loadingMessage={
        isSearching
          ? t("customerSelect.searching")
          : t("customerSelect.loading")
      }
      renderOption={option => {
        // Special rendering for "None" option
        if (option.value === NONE_VALUE) {
          return (
            <div className="italic text-gray-500 dark:text-gray-400">
              {option.label}
            </div>
          );
        }

        // Regular customer rendering
        const customer = option.data;
        return (
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-gray-900 dark:text-white">
              {option.label}
            </div>
            {(customer?.person?.phone || customer?.person?.docNumber) && (
              <div className="truncate text-sm text-gray-500 dark:text-gray-400">
                {customer.person.phone}
                {customer.person.docNumber && (
                  <span className="text-gray-500 dark:text-gray-400">
                    {" - " + customer.person.docNumber}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      }}
    />
  );
}

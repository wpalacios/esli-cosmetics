"use client";

import { useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@esli-cosmetics/ui";
import { CustomerType } from "@esli-cosmetics/types";
import { useCustomerTypes } from "@/hooks/use-customer-types";
import { cn } from "@esli-cosmetics/utils";

interface CustomerTypeSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  currentCustomerType?: CustomerType;
}

export function CustomerTypeSelect({
  value,
  onChange,
  placeholder = "Seleccionar tipo de cliente...",
  disabled = false,
  className,
  error,
  currentCustomerType,
}: CustomerTypeSelectProps) {
  const { t } = useTranslation("common");

  const { data: customerTypesData, isLoading } = useCustomerTypes({
    isActive: true,
    page: 1,
    limit: 100,
  });

  const customerTypes = customerTypesData?.data || [];

  // Convert customer types to SearchableSelect options
  // Ensure current customer type is always included in the options
  const options = useMemo<SearchableSelectOption<CustomerType>[]>(() => {
    const optionsMap = new Map<string, SearchableSelectOption<CustomerType>>();

    // Add current customer type first if it exists and has a valid ID
    if (currentCustomerType?.id) {
      optionsMap.set(currentCustomerType.id, {
        value: currentCustomerType.id,
        label: currentCustomerType.name || "",
        data: currentCustomerType,
      });
    }

    // Add fetched customer types
    customerTypes.forEach(customerType => {
      if (customerType?.id) {
        optionsMap.set(customerType.id, {
          value: customerType.id,
          label: customerType.name || "",
          data: customerType,
        });
      }
    });

    return Array.from(optionsMap.values());
  }, [customerTypes, currentCustomerType, value]);

  // Custom filter function for customer types
  const filterOptions = (
    opts: SearchableSelectOption<CustomerType>[],
    searchTerm: string
  ) => {
    if (!searchTerm) return opts;

    const search = searchTerm.toLowerCase();
    return opts.filter(option => {
      const customerType = option.data;
      if (!customerType) return false;

      const name = customerType.name?.toLowerCase() || "";
      const description = customerType.description?.toLowerCase() || "";

      return name.includes(search) || description.includes(search);
    });
  };

  // Custom render for options in dropdown
  const renderOption = (option: SearchableSelectOption<CustomerType>) => {
    const customerType = option.data;
    if (!customerType) return option.label;

    return (
      <div className="flex flex-col">
        <span className="font-medium">{customerType.name}</span>
        {customerType.description && (
          <span className="text-xs text-gray-500">
            {customerType.description}
          </span>
        )}
      </div>
    );
  };

  // Track if this is the initial mount to prevent unwanted onChange calls
  const isInitialMount = useRef(true);
  useEffect(() => {
    // After first render, allow onChange to work normally
    const timer = setTimeout(() => {
      isInitialMount.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Handle onChange with protection against initial mount clearing
  const handleValueChange = (newValue: string) => {
    // Prevent clearing the value on initial mount when Radix Select initializes
    if (
      isInitialMount.current &&
      newValue === "" &&
      value &&
      value.trim() !== ""
    ) {
      return;
    }

    onChange(newValue);
  };

  // Always return a string value (empty string if no value) to keep Radix Select controlled
  // This prevents the "uncontrolled to controlled" warning
  const selectValue = useMemo(() => {
    if (!value || value.trim() === "") {
      return "";
    }

    // If value matches currentCustomerType, we know it will be in options
    // (because currentCustomerType is added to options), so we can pass it
    if (currentCustomerType?.id === value) {
      return value;
    }

    // Otherwise, only pass if it exists in options
    const optionExists = options.some(opt => opt.value === value);
    return optionExists ? value : "";
  }, [value, options, currentCustomerType]);

  return (
    <div className={cn("relative", className)}>
      <SearchableSelect<CustomerType>
        options={options}
        value={selectValue}
        onValueChange={handleValueChange}
        placeholder={placeholder}
        disabled={disabled}
        {...(error && { error })}
        searchPlaceholder={t("common.search")}
        emptyMessage={
          options.length === 0
            ? t("common.noOptionsAvailable")
            : t("common.noData")
        }
        isLoading={isLoading}
        loadingMessage={t("common.loading") || "Loading..."}
        filterOptions={filterOptions}
        renderOption={renderOption}
        showClearButton={true}
      />
    </div>
  );
}

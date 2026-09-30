"use client";

import { useMemo } from "react";
import { Badge } from "@esli-cosmetics/ui";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@esli-cosmetics/ui";
import { PriceType } from "@esli-cosmetics/types";
import { usePrices } from "@/hooks/use-prices";
import { useTranslation } from "react-i18next";
import { cn } from "@esli-cosmetics/utils";
import { AiOutlineClose } from "react-icons/ai";

interface PriceTypesMultiSelectProps {
  value?: string[];
  onChange: (priceTypeIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
}

export function PriceTypesMultiSelect({
  value = [],
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
}: PriceTypesMultiSelectProps) {
  const { t } = useTranslation("customers");

  // Fetch all active price types for selection
  const { data: priceTypesData, isLoading } = usePrices({
    page: 1,
    limit: 100, // Get more price types for selection
    isActive: true,
    isDeleted: false,
  });

  const priceTypes = priceTypesData?.data || [];

  // Convert price types to SearchableMultiSelect options
  const options = useMemo<SearchableMultiSelectOption<PriceType>[]>(() => {
    return priceTypes.map(priceType => ({
      value: priceType.id,
      label: priceType.name || "",
      data: priceType,
    }));
  }, [priceTypes]);

  // Custom filter function for price types
  const filterOptions = (
    opts: SearchableMultiSelectOption<PriceType>[],
    searchTerm: string
  ) => {
    if (!searchTerm) return opts;

    const search = searchTerm.toLowerCase();
    return opts.filter(option => {
      const priceType = option.data;
      if (!priceType) return false;

      const name = priceType.name?.toLowerCase() || "";
      const description = priceType.description?.toLowerCase() || "";

      return name.includes(search) || description.includes(search);
    });
  };

  // Format price type info for badges
  const formatPriceTypeInfo = (priceType: PriceType) => {
    const parts = [];
    if (priceType.minQuantity > 1) {
      parts.push(`Min: ${priceType.minQuantity}`);
    }
    return parts.length > 0 ? `(${parts.join(", ")})` : "";
  };

  // Custom render for selected badges
  const renderSelectedBadge = (
    option: SearchableMultiSelectOption<PriceType>,
    onRemove: () => void
  ) => {
    const priceType = option.data;
    if (!priceType) return null;

    return (
      <div className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800 dark:bg-blue-900 dark:text-blue-200">
        <span className="font-medium">{priceType.name}</span>
        <span className="text-xs">{formatPriceTypeInfo(priceType)}</span>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove ${priceType.name}`}
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center rounded-sm hover:text-blue-600",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <AiOutlineClose className="h-3 w-3" />
        </span>
      </div>
    );
  };

  // Custom render for options in dropdown
  const renderOption = (option: SearchableMultiSelectOption<PriceType>) => {
    const priceType = option.data;
    if (!priceType) return option.label;

    return (
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{priceType.name}</span>
          <Badge
            variant={priceType.isActive ? "success" : "neutral"}
            className="text-xs"
          >
            {priceType.isActive ? t("form.active") : t("form.inactive")}
          </Badge>
        </div>
        {priceType.description && (
          <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {priceType.description}
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("form.minQuantity")}: {priceType.minQuantity}
          </span>
        </div>
      </div>
    );
  };

  return (
    <SearchableMultiSelect<PriceType>
      options={options}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder || t("form.selectPriceTypes")}
      disabled={disabled}
      {...(className && { className })}
      {...(error && { error })}
      searchPlaceholder={t("form.searchPriceTypes")}
      emptyMessage={
        options.length === 0 ? t("form.noPriceTypes") : t("form.noResults")
      }
      isLoading={isLoading}
      loadingMessage={t("form.loading")}
      filterOptions={filterOptions}
      renderOption={renderOption}
      renderSelectedBadge={renderSelectedBadge}
      maxSelectedDisplay={10}
    />
  );
}

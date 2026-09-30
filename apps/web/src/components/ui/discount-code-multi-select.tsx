"use client";

import { useMemo } from "react";
import { Badge } from "@esli-cosmetics/ui";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@esli-cosmetics/ui";
import { DiscountCode } from "@esli-cosmetics/types";
import { useDiscountCodes } from "@/hooks/use-discount-codes";
import { useTranslation } from "react-i18next";
import { cn } from "@esli-cosmetics/utils";
import { AiOutlineClose } from "react-icons/ai";

interface DiscountCodeMultiSelectProps {
  value?: string[];
  onChange: (discountCodeIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
}

export function DiscountCodeMultiSelect({
  value = [],
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
}: DiscountCodeMultiSelectProps) {
  const { t } = useTranslation("discount-codes");

  // Fetch all discount codes for selection
  const { data: discountCodesData, isLoading } = useDiscountCodes({
    page: 1,
    limit: 100, // Get more discount codes for selection
  });

  const discountCodes = discountCodesData?.data || [];

  // Convert discount codes to SearchableMultiSelect options
  const options = useMemo<SearchableMultiSelectOption<DiscountCode>[]>(() => {
    return discountCodes
      .filter(discountCode => discountCode.isActive)
      .map(discountCode => ({
        value: discountCode.id,
        label: discountCode.code || "",
        data: discountCode,
      }));
  }, [discountCodes]);

  // Custom filter function for discount codes
  const filterOptions = (
    opts: SearchableMultiSelectOption<DiscountCode>[],
    searchTerm: string
  ) => {
    if (!searchTerm) return opts;

    const search = searchTerm.toLowerCase();
    return opts.filter(option => {
      const discountCode = option.data;
      if (!discountCode) return false;

      const code = discountCode.code?.toLowerCase() || "";
      const name = discountCode.name?.toLowerCase() || "";

      return code.includes(search) || name.includes(search);
    });
  };

  // Format discount value for display
  const formatDiscountValue = (discountCode: DiscountCode) => {
    if (discountCode.discountType === "PERCENTAGE") {
      return `${discountCode.value}%`;
    } else {
      return `$${discountCode.value}`;
    }
  };

  // Custom render for selected badges
  const renderSelectedBadge = (
    option: SearchableMultiSelectOption<DiscountCode>,
    onRemove: () => void
  ) => {
    const discountCode = option.data;
    if (!discountCode) return null;

    return (
      <div className="flex items-center gap-1 rounded-md bg-pink-100 px-2 py-1 text-sm text-pink-800">
        <span className="font-medium">{discountCode.code}</span>
        <span className="text-xs">({formatDiscountValue(discountCode)})</span>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove ${discountCode.code}`}
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
            "inline-flex cursor-pointer items-center justify-center rounded-sm hover:text-pink-600",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <AiOutlineClose className="h-3 w-3" />
        </span>
      </div>
    );
  };

  // Custom render for options in dropdown
  const renderOption = (option: SearchableMultiSelectOption<DiscountCode>) => {
    const discountCode = option.data;
    if (!discountCode) return option.label;

    return (
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{discountCode.code}</span>
          <Badge
            variant={
              discountCode.discountType === "PERCENTAGE" ? "neutral" : "success"
            }
            className="text-xs"
          >
            {discountCode.discountType === "PERCENTAGE" ? "%" : "$"}
          </Badge>
          <span className="text-sm font-medium text-gray-600">
            {formatDiscountValue(discountCode)}
          </span>
        </div>
        {discountCode.name && (
          <div className="mt-1 text-sm text-gray-500">{discountCode.name}</div>
        )}
        <div className="mt-1 flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs",
              discountCode.isActive
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            )}
          >
            {discountCode.isActive
              ? t("multiSelect.active")
              : t("multiSelect.inactive")}
          </span>
          {discountCode.usageLimit && (
            <span className="text-xs text-gray-500">
              {t("multiSelect.usage", {
                limit: discountCode.usageLimit || 0,
              })}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <SearchableMultiSelect<DiscountCode>
      options={options}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder || t("multiSelect.placeholder")}
      disabled={disabled}
      {...(className && { className })}
      {...(error && { error })}
      searchPlaceholder={t("multiSelect.searchPlaceholder")}
      emptyMessage={
        options.length === 0
          ? t("multiSelect.noData")
          : t("multiSelect.noResults")
      }
      isLoading={isLoading}
      loadingMessage={t("multiSelect.loading")}
      filterOptions={filterOptions}
      renderOption={renderOption}
      renderSelectedBadge={renderSelectedBadge}
      maxSelectedDisplay={10}
    />
  );
}

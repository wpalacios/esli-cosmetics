"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ProductVariant, ApiProductVariant } from "@esli-cosmetics/types";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";
import { CURRENCY_SIGN } from "@esli-cosmetics/utils";

type VariantType = ProductVariant | ApiProductVariant;

interface ProductVariantSelectProps {
  variants: VariantType[];
  value?: string | undefined;
  onChange: (variantId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  allowNone?: boolean;
  currentVariant?: VariantType | undefined;
}

export function ProductVariantSelect({
  variants,
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
  allowNone = false,
  currentVariant,
}: ProductVariantSelectProps) {
  const { t } = useTranslation("common");

  const defaultPlaceholder = placeholder || t("ui.variantSelect.placeholder");

  // Helper to get price from variant (handles both ProductVariant and ApiProductVariant)
  const getVariantPrice = (variant: VariantType): number | undefined => {
    if ("price" in variant && typeof variant.price === "number") {
      return variant.price;
    }
    if ("costPrice" in variant && typeof variant.costPrice === "number") {
      return variant.costPrice;
    }
    return undefined;
  };

  // Ensure current variant is in the options list if provided
  const variantOptions = useMemo<SearchableSelectOption<VariantType>[]>(() => {
    const optionsMap = new Map<string, SearchableSelectOption<VariantType>>();

    // Add current variant first if it exists and has a valid ID
    if (currentVariant?.id) {
      optionsMap.set(currentVariant.id, {
        value: currentVariant.id,
        label: `${currentVariant.name || t("ui.variantSelect.unnamed")}${currentVariant.sku ? ` (${currentVariant.sku})` : ""}`,
        data: currentVariant,
      });
    }

    // Add provided variants
    variants.forEach(variant => {
      if (variant?.id) {
        optionsMap.set(variant.id, {
          value: variant.id,
          label: `${variant.name || t("ui.variantSelect.unnamed")}${variant.sku ? ` (${variant.sku})` : ""}`,
          data: variant,
        });
      }
    });

    return Array.from(optionsMap.values()).sort((a, b) => {
      const nameA = a.label.toLowerCase();
      const nameB = b.label.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [variants, currentVariant, t]);

  if (variants.length === 0 && !currentVariant) {
    return (
      <div className={className}>
        <div className="border-input bg-background flex h-10 w-full cursor-not-allowed items-center justify-between rounded-md border px-3 py-2 text-sm opacity-50">
          <span className="text-muted-foreground">
            {t("ui.variantSelect.noVariantsAvailable")}
          </span>
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <SearchableSelect<VariantType>
      options={variantOptions}
      {...(value ? { value } : {})}
      onValueChange={onChange}
      placeholder={defaultPlaceholder}
      disabled={disabled}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      searchPlaceholder={t("ui.variantSelect.searchPlaceholder")}
      emptyMessage={t("ui.variantSelect.noVariantsFound")}
      renderOption={option => (
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900 dark:text-white">
            {option.data?.name || t("ui.variantSelect.unnamed")}
          </div>
          {(option.data?.sku || getVariantPrice(option.data!)) && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              {option.data?.sku && (
                <span className="font-mono">{option.data.sku}</span>
              )}
              {getVariantPrice(option.data!) && (
                <span>
                  • {CURRENCY_SIGN}
                  {Number(getVariantPrice(option.data!)).toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ProductWithRelations, ProductType } from "@esli-cosmetics/types";
import { useSearchProduct, useProducts } from "@/hooks/use-products";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";

interface ProductSelectProps {
  value?: string | undefined;
  onChange: (productId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  currentProduct?: ProductWithRelations | undefined;
  excludeTypes?: ProductType[];
}

export function ProductSelect({
  value,
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
  currentProduct,
  excludeTypes = [],
}: ProductSelectProps) {
  const { t } = useTranslation("common");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  const isSearching = activeSearchTerm.trim().length > 0;

  // Fetch all products when not searching
  const { data: allProductsData, isLoading: isLoadingAll } = useProducts({
    page: 1,
    limit: 10,
    excludeTypes,
  });

  // Fetch products with search when searching
  const { data: searchProductsData, isLoading: isLoadingSearch } =
    useSearchProduct(activeSearchTerm, 1, 10, excludeTypes);

  /** Enter in the dropdown passes the current input value (SearchableSelect local state). */
  const handleSearchTrigger = (term: string) => {
    debugger;
    setActiveSearchTerm(term.trim());
  };

  const isLoading = isSearching ? isLoadingSearch : isLoadingAll;

  // Ensure current product is in the options list if provided
  // Backend already filters excluded types, but we still need to check currentProduct
  const productOptions = useMemo<
    SearchableSelectOption<ProductWithRelations>[]
  >(() => {
    const products = isSearching
      ? (searchProductsData?.products ?? [])
      : (allProductsData?.products ?? []);

    const optionsMap = new Map<
      string,
      SearchableSelectOption<ProductWithRelations>
    >();

    // Add current product first if it exists and has a valid ID
    // Only add if it's not in the excluded types
    if (currentProduct?.id && !excludeTypes?.includes(currentProduct.type)) {
      optionsMap.set(currentProduct.id, {
        value: currentProduct.id,
        label: `${currentProduct.name}${currentProduct.sku ? ` (${currentProduct.sku})` : ""}`,
        data: currentProduct,
      });
    }

    // Add fetched products (backend already filtered excluded types)
    products.forEach(product => {
      if (product?.id) {
        optionsMap.set(product.id, {
          value: product.id,
          label: `${product.name}${product.sku ? ` (${product.sku})` : ""}`,
          data: product,
        });
      }
    });

    return Array.from(optionsMap.values());
  }, [
    isSearching,
    searchProductsData?.products,
    allProductsData?.products,
    currentProduct,
    excludeTypes,
  ]);

  const defaultPlaceholder = placeholder || t("ui.productSelect.placeholder");

  return (
    <SearchableSelect<ProductWithRelations>
      options={productOptions}
      {...(value ? { value } : {})}
      onValueChange={onChange}
      placeholder={defaultPlaceholder}
      disabled={disabled}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      searchPlaceholder={t("ui.productSelect.searchPlaceholder")}
      emptyMessage={
        isSearching
          ? t("ui.productSelect.noProductsFound")
          : t("ui.productSelect.noProductsAvailable")
      }
      onSearchChange={() => {
        /* Server-driven list; filtering happens after Enter via useSearchProduct */
      }}
      onSearchTrigger={handleSearchTrigger}
      isLoading={isLoading}
      loadingMessage={t("ui.productSelect.loading")}
      renderOption={option => (
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-gray-900 dark:text-white">
            {option.data?.name || option.label}
          </div>
          {(option.data?.sku || option.data?.category?.name) && (
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              {option.data?.sku && (
                <span className="font-mono">{option.data.sku}</span>
              )}
              {option.data?.category?.name && (
                <span className="text-xs">• {option.data.category.name}</span>
              )}
            </div>
          )}
        </div>
      )}
    />
  );
}

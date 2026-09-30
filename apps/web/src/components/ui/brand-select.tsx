"use client";

import { useState, useEffect, useMemo } from "react";
import { BrandWithRelations } from "@esli-cosmetics/types";
import { useBrands } from "@/hooks/use-brands";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";

interface BrandSelectProps {
  value?: string | undefined;
  onChange: (brandId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  currentBrand?: BrandWithRelations; // Pass the current brand to ensure it's in the list
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  usePortal?: boolean; // Kept for backward compatibility, not used
}

export function BrandSelect({
  value,
  onChange,
  placeholder = "Select a brand...",
  disabled = false,
  className,
  error,
  currentBrand,
  searchPlaceholder = "Search brands...",
  emptyMessage = "No brands found",
  loadingMessage = "Loading brands...",
  usePortal = false, // Kept for backward compatibility
}: BrandSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  // Fetch brands with search support
  const { data: brandsData, isLoading } = useBrands({
    page: 1,
    limit: 200,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  // Handle search - trigger on Enter key
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  const handleSearchTrigger = () => {
    setActiveSearchTerm(searchTerm);
  };

  const brands = brandsData?.data || [];

  // Convert brands to select options
  const brandOptions: SearchableSelectOption<BrandWithRelations>[] =
    useMemo(() => {
      let brandsList = [...brands];

      // Ensure the current brand is always in the list when editing
      if (currentBrand && value) {
        const brandExists = brandsList.some(
          brand => brand.id === currentBrand.id
        );
        if (!brandExists) {
          // Add the current brand to the beginning of the list
          brandsList.unshift(currentBrand);
        }
      }

      return brandsList.map(brand => ({
        value: brand.id,
        label: `${brand.name}${brand.country ? ` (${brand.country})` : ""}`,
        data: brand,
      }));
    }, [brands, currentBrand, value]);

  // Custom render for brand options with country and description
  const renderBrandOption = (
    option: SearchableSelectOption<BrandWithRelations>
  ) => {
    const brand = option.data;
    return (
      <div className="flex flex-col">
        <span className="font-medium">{brand?.name}</span>
        {brand?.country && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {brand.country}
          </span>
        )}
        {brand?.description && (
          <span className="max-w-xs truncate text-xs text-gray-400 dark:text-gray-500">
            {brand.description}
          </span>
        )}
      </div>
    );
  };

  return (
    <SearchableSelect<BrandWithRelations>
      options={brandOptions}
      {...(value ? { value } : {})}
      onValueChange={newValue => onChange(newValue)}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      onSearchChange={handleSearchChange}
      onSearchTrigger={handleSearchTrigger}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      renderOption={renderBrandOption}
    />
  );
}

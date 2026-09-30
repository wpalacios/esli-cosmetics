"use client";

import { useState, useEffect, useMemo } from "react";
import { useSupplier } from "@/hooks/use-suppliers";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";
import type { BrandWithRelations } from "@esli-cosmetics/types";

interface SupplierBrandSelectProps {
  value: string | undefined;
  onChange: (brandId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error: string | undefined;
  supplierId: string;
  brandOptions: BrandWithRelations[] | undefined;
  currentBrand?: BrandWithRelations; // Pass the current brand to ensure it's in the list
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  usePortal?: boolean; // Kept for backward compatibility, not used
}

export function SupplierBrandSelect({
  value,
  onChange,
  placeholder = "Selecciona una marca...",
  disabled = false,
  className,
  error,
  supplierId,
  brandOptions,
  currentBrand,
  searchPlaceholder = "Buscar marca...",
  emptyMessage = "No hay marcas disponibles para este proveedor",
  loadingMessage = "Cargando marcas...",
  usePortal = false, // Kept for backward compatibility
}: SupplierBrandSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Note: For supplier brands, we're using client-side filtering since brands come from brandOptions
  // The supplier endpoint already provides the list of brands
  const { data: supplierData, isLoading: isLoadingSupplier } = useSupplier(
    supplierId && supplierId !== "undefined" && !brandOptions ? supplierId : ""
  );

  const brands: BrandWithRelations[] = useMemo(() => {
    if (brandOptions && brandOptions.length > 0) return brandOptions;
    return [];
  }, [brandOptions]);

  // Convert brands to select options (with client-side filtering)
  const brandSelectOptions: SearchableSelectOption<BrandWithRelations>[] =
    useMemo(() => {
      let brandsList = [...brands];

      // Ensure the current brand is always in the list when editing
      if (currentBrand && value) {
        const brandExists = brandsList.some(br => br.id === currentBrand.id);
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

  // Client-side filter function for brands
  const filterBrands = (
    options: SearchableSelectOption<BrandWithRelations>[],
    searchTerm: string
  ) => {
    if (!searchTerm) return options;

    const search = searchTerm.toLowerCase();
    return options.filter(option => {
      const brand = option.data;
      const name = brand?.name?.toLowerCase() || "";
      const country = brand?.country?.toLowerCase() || "";
      const description = brand?.description?.toLowerCase() || "";

      return (
        name.includes(search) ||
        country.includes(search) ||
        description.includes(search)
      );
    });
  };

  const isLoading = supplierId && !brandOptions ? isLoadingSupplier : false;

  return (
    <SearchableSelect<BrandWithRelations>
      options={brandSelectOptions}
      {...(value ? { value } : {})}
      onValueChange={newValue => onChange(newValue)}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={searchTerm ? "No se encontraron marcas" : emptyMessage}
      disabled={disabled}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      filterOptions={filterBrands}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      renderOption={renderBrandOption}
    />
  );
}

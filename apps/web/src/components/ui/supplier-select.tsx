"use client";

import { useState, useEffect, useMemo } from "react";
import { SupplierWithRelations } from "@esli-cosmetics/types";
import { useSuppliers } from "@/hooks/use-suppliers";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";

interface SupplierSelectProps {
  value?: string | undefined;
  onChange: (supplierId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  lockSupplier?: boolean;
  className?: string;
  error?: string | undefined;
  currentSupplier?: SupplierWithRelations; // Pass the current supplier to ensure it's in the list
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  usePortal?: boolean; // Kept for backward compatibility, not used
  options?: SupplierWithRelations[]; // Kept for backward compatibility
}

export function SupplierSelect({
  value,
  onChange,
  placeholder = "Selecciona un proveedor...",
  disabled = false,
  className,
  error,
  lockSupplier = false,
  currentSupplier,
  searchPlaceholder = "Buscar proveedor...",
  emptyMessage = "No se encontraron proveedores",
  loadingMessage = "Cargando proveedores...",
  usePortal = false, // Kept for backward compatibility
  options, // Kept for backward compatibility
}: SupplierSelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  // Fetch suppliers with search support
  const { data: suppliersData, isLoading } = useSuppliers({
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

  const suppliers = useMemo(() => {
    // If options are provided (backward compatibility), use them
    if (options && Array.isArray(options)) return options;
    return Array.isArray(suppliersData?.data) ? suppliersData.data : [];
  }, [options, suppliersData]);

  // Convert suppliers to select options
  const supplierOptions: SearchableSelectOption<SupplierWithRelations>[] =
    useMemo(() => {
      let suppliersList = [...suppliers];

      // Ensure the current supplier is always in the list when editing
      if (currentSupplier && value) {
        const supplierExists = suppliersList.some(
          sup => sup.id === currentSupplier.id
        );
        if (!supplierExists) {
          // Add the current supplier to the beginning of the list
          suppliersList.unshift(currentSupplier);
        }
      }

      return suppliersList.map(supplier => ({
        value: supplier.id,
        label: `${supplier.name}${supplier.email ? ` (${supplier.email})` : ""}`,
        data: supplier,
      }));
    }, [suppliers, currentSupplier, value]);

  // // Custom render for supplier options with email and phone
  // const renderSupplierOption = (option: SearchableSelectOption<SupplierWithRelations>) => {
  //   const supplier = option.data;
  //   return (
  //     <div className="flex flex-col">
  //       <span className="font-medium">{supplier?.name}</span>
  //       {supplier?.email && (
  //         <span className="text-xs text-gray-500 dark:text-gray-400">
  //           {supplier.email}
  //         </span>
  //       )}
  //       {supplier?.phone && (
  //         <span className="text-xs text-gray-400 dark:text-gray-500">
  //           {supplier.phone}
  //         </span>
  //       )}
  //     </div>
  //   );
  // };

  return (
    <SearchableSelect<SupplierWithRelations>
      options={supplierOptions}
      {...(value ? { value } : {})}
      onValueChange={newValue => onChange(newValue)}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled || lockSupplier}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      onSearchChange={handleSearchChange}
      onSearchTrigger={handleSearchTrigger}
      isLoading={isLoading && !options}
      loadingMessage={loadingMessage}
      // renderOption={renderSupplierOption}
    />
  );
}

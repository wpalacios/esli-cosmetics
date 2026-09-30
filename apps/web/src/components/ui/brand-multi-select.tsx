"use client";

import { useState, useEffect, useMemo } from "react";
import {
  AiOutlineSearch,
  AiOutlineCheck,
  AiOutlineDown,
  AiOutlineClose,
} from "react-icons/ai";
import { Button, Input } from "@esli-cosmetics/ui";
import { BrandWithRelations } from "@esli-cosmetics/types";
import { useBrands } from "@/hooks/use-brands";
import { cn } from "@esli-cosmetics/utils";

interface BrandMultiSelectProps {
  value?: string[];
  onChange: (brandIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
}

export function BrandMultiSelect({
  value = [],
  onChange,
  placeholder = "Select brands...",
  disabled = false,
  className,
  error,
}: BrandMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<BrandWithRelations[]>(
    []
  );

  // Fetch all brands for selection
  const { data: brandsData, isLoading } = useBrands({
    page: 1,
    limit: 100, // Get more brands for selection
  });

  const brands = brandsData?.data || [];

  // Filter brands based on search term
  const filteredBrands = useMemo(() => {
    if (!searchTerm) return brands;

    return brands.filter(brand => {
      const name = brand.name?.toLowerCase() || "";
      const country = brand.country?.toLowerCase() || "";
      const search = searchTerm.toLowerCase();

      return name.includes(search) || country.includes(search);
    });
  }, [brands, searchTerm]);

  // Find selected brands when value changes
  useEffect(() => {
    if (value && value.length > 0 && brands.length > 0) {
      const selected = brands.filter(brand => value.includes(brand.id));
      // Only update if the selection actually changed
      const selectedIds = selected
        .map(b => b.id)
        .sort()
        .join(",");
      const currentIds = selectedBrands
        .map(b => b.id)
        .sort()
        .join(",");

      if (selectedIds !== currentIds) {
        setSelectedBrands(selected);
      }
    } else if (value.length === 0 && selectedBrands.length > 0) {
      setSelectedBrands([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, brands.length]);

  const handleToggleBrand = (brand: BrandWithRelations) => {
    const isSelected = selectedBrands.some(sb => sb.id === brand.id);
    let newSelectedBrands: BrandWithRelations[];

    if (isSelected) {
      newSelectedBrands = selectedBrands.filter(sb => sb.id !== brand.id);
    } else {
      newSelectedBrands = [...selectedBrands, brand];
    }

    setSelectedBrands(newSelectedBrands);
    onChange(newSelectedBrands.map(sb => sb.id));
  };

  const handleRemoveBrand = (brandId: string) => {
    const newSelectedBrands = selectedBrands.filter(sb => sb.id !== brandId);
    setSelectedBrands(newSelectedBrands);
    onChange(newSelectedBrands.map(sb => sb.id));
  };

  const handleClear = () => {
    setSelectedBrands([]);
    onChange([]);
    setSearchTerm("");
  };

  const displayValue =
    selectedBrands.length > 0
      ? `${selectedBrands.length} brand${selectedBrands.length === 1 ? "" : "s"} selected`
      : placeholder;

  return (
    <div className={cn("relative", className)}>
      {/* Selected brands display */}
      {selectedBrands.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {selectedBrands.map(brand => (
            <div
              key={brand.id}
              className="flex items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-sm text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              <span>{brand.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveBrand(brand.id)}
                className="hover:text-blue-600 dark:hover:text-blue-400"
                disabled={disabled}
              >
                <AiOutlineClose className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full justify-between text-left",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500"
        )}
      >
        <span
          className={cn(
            "truncate",
            selectedBrands.length === 0 && "text-gray-500 dark:text-gray-400"
          )}
        >
          {displayValue}
        </span>
        <AiOutlineDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </Button>

      {/* Error message */}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="p-2">
            <div className="relative">
              <AiOutlineSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search brands..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                Loading brands...
              </div>
            ) : filteredBrands.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                {searchTerm ? "No brands found" : "No brands available"}
              </div>
            ) : (
              <>
                {filteredBrands.map(brand => {
                  const isSelected = selectedBrands.some(
                    sb => sb.id === brand.id
                  );

                  return (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => handleToggleBrand(brand)}
                      className={cn(
                        "flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700",
                        isSelected && "bg-blue-50 dark:bg-blue-900/30"
                      )}
                    >
                      <div>
                        <div className="font-medium dark:text-gray-100">
                          {brand.name}
                        </div>
                        {brand.country && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {brand.country}
                          </div>
                        )}
                        {brand.description && (
                          <div className="max-w-xs truncate text-xs text-gray-400 dark:text-gray-500">
                            {brand.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <AiOutlineCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </button>
                  );
                })}
              </>
            )}
          </div>

          {selectedBrands.length > 0 && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="w-full"
              >
                Clear all
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

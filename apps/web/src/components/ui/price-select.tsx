"use client";

import { useState, useEffect, useMemo } from "react";
import { AiOutlineSearch, AiOutlineCheck, AiOutlineDown } from "react-icons/ai";
import { Button, Input } from "@esli-cosmetics/ui";
import { PriceType } from "@esli-cosmetics/types";
import { usePrices } from "@/hooks/use-prices";
import { cn } from "@esli-cosmetics/utils";
import { useTranslation } from "react-i18next";

interface PriceSelectProps {
  value?: string | undefined;
  onChange: (priceTypeId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
}

export function PriceSelect({
  value,
  onChange,
  placeholder = "Seleccionar tipo de precio...",
  disabled = false,
  className,
  error,
}: PriceSelectProps) {
  const { t } = useTranslation("common");

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrice, setSelectedPrice] = useState<PriceType | null>(null);

  const { data: pricesData, isLoading } = usePrices({
    isActive: true,
    page: 1,
    limit: 100,
  });

  const priceTypes = pricesData?.data || [];

  const filteredPrices = useMemo(() => {
    if (!searchTerm) return priceTypes;
    return priceTypes.filter(price => {
      const name = price.name?.toLowerCase() || "";
      const description = price.description?.toLowerCase() || "";
      const search = searchTerm.toLowerCase();
      return name.includes(search) || description.includes(search);
    });
  }, [priceTypes, searchTerm]);

  useEffect(() => {
    if (value && priceTypes.length > 0) {
      const price = priceTypes.find(p => p.id === value);
      setSelectedPrice(price || null);
    } else {
      setSelectedPrice(null);
    }
  }, [value, priceTypes]);

  const handleSelect = (price: PriceType) => {
    setSelectedPrice(price);
    onChange(price.id);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = () => {
    setSelectedPrice(null);
    onChange(undefined);
    setSearchTerm("");
  };

  const displayValue = selectedPrice ? selectedPrice.name : placeholder;

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "h-12 w-full justify-between text-left font-normal",
          !selectedPrice && "text-muted-foreground",
          error && "border-red-500 focus:border-red-500 focus:ring-red-500"
        )}
      >
        <span className="truncate">{displayValue}</span>
        <AiOutlineDown className="ml-2 h-4 w-4 opacity-50" />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b p-2 dark:border-gray-700">
            <div className="relative">
              <AiOutlineSearch className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <Input
                placeholder={t("searchPriceType") || "Buscar tipo de precio..."}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="h-10 pl-8 dark:bg-gray-700 dark:text-white"
                autoFocus
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                {t("loadingPrices") || "Cargando precios..."}
              </div>
            ) : filteredPrices.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {searchTerm
                  ? t("noPricesFound") || "No se encontraron precios"
                  : t("noPricesAvailable") || "No hay precios disponibles"}
              </div>
            ) : (
              <>
                {filteredPrices.map(price => (
                  <button
                    key={price.id}
                    type="button"
                    onClick={() => handleSelect(price)}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-2 text-left hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700",
                      selectedPrice?.id === price.id &&
                        "bg-blue-50 dark:bg-blue-900/50"
                    )}
                  >
                    <div>
                      <div className="text-sm">{price.name}</div>
                      {price.description && (
                        <div className="max-w-xs truncate text-xs text-gray-500 dark:text-gray-400">
                          {price.description}
                        </div>
                      )}
                    </div>
                    {selectedPrice?.id === price.id && (
                      <AiOutlineCheck className="h-4 w-4 text-blue-600" />
                    )}
                  </button>
                ))}
              </>
            )}
          </div>

          {selectedPrice && (
            <div className="border-t p-2 dark:border-gray-700">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="h-10 w-full"
              >
                {t("clearSelection") || "Limpiar Selección"}
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

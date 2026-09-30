"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@esli-cosmetics/ui";
import { BiSearch, BiXCircle } from "react-icons/bi";
import { cn } from "@esli-cosmetics/utils";

interface ProductVariantBrandSelectProps {
  brandId: string | null | undefined;
  onSearch: (term: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ProductVariantBrandSelect({
  brandId,
  onSearch,
  placeholder,
  disabled = false,
  className,
}: ProductVariantBrandSelectProps) {
  const { t } = useTranslation("common");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  useEffect(() => {
    onSearch(activeSearchTerm);
  }, [activeSearchTerm, onSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setActiveSearchTerm(searchTerm);
    }
  };

  useEffect(() => {
    setSearchTerm("");
  }, [brandId]);

  return (
    <div className={cn("group relative w-full", className)}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors duration-200 group-focus-within:text-pink-500">
        <BiSearch className="h-5 w-5" />
      </div>

      <Input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || t("ui.variantSelect.searchPlaceholder")}
        disabled={disabled || !brandId}
        className={cn(
          "h-11 w-full pl-10 pr-10 text-base shadow-sm transition-all duration-200 md:text-sm",
          "focus:border-pink-400 focus:ring-2 focus:ring-pink-200",
          "placeholder:text-gray-400"
        )}
      />

      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 transition-all hover:text-gray-600 active:scale-95"
          aria-label="Limpiar búsqueda"
        >
          <BiXCircle className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

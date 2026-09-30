"use client";

import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Label, Input } from "@esli-cosmetics/ui";
import { cn } from "@esli-cosmetics/utils";
import { SupplierSelect } from "./supplier-select";
import { SupplierBrandSelect } from "./supplier-brand-select";
import type { Supplier, BrandWithRelations } from "@esli-cosmetics/types";

interface SupplierOrderFiltersProps {
  supplierId: string;
  onSupplierChange: (supplierId: string) => void;
  supplierOptions: Supplier[];
  brandId?: string;
  onBrandChange: (brandId: string | undefined) => void;
  brandOptions?: BrandWithRelations[];
  expectedDate?: string;
  onExpectedDateChange: (date: string | undefined) => void;
  disabled?: boolean;
  className?: string;
  lockSupplier?: boolean;
  supplierError?: string;
  brandError?: string;
  expectedDateError?: string;
  currentSupplier?: Supplier; // Current supplier when editing
  currentBrand?: BrandWithRelations; // Current brand when editing
}

export function SupplierOrderFilters({
  supplierId,
  onSupplierChange,
  supplierOptions,
  brandId,
  onBrandChange,
  brandOptions,
  expectedDate,
  onExpectedDateChange,
  disabled,
  className,
  supplierError,
  brandError,
  lockSupplier,
  expectedDateError,
  currentSupplier,
  currentBrand,
}: SupplierOrderFiltersProps) {
  const { t } = useTranslation("supplier-order");
  const { register, setValue } = useFormContext();
  const { onChange: formOnChange, ...restRegister } = register("expected_date");

  useEffect(() => {
    if (expectedDate !== undefined) {
      setValue("expected_date", expectedDate);
    }
  }, [expectedDate, setValue]);

  const labelClass =
    "mb-1.5 block text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider";

  return (
    <div className={cn("w-full", className)}>
      <div className="grid w-full grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
        <div className="relative z-30 flex w-full flex-col">
          <Label className={labelClass}>{t("form.supplier")}</Label>
          <div className="w-full">
            <SupplierSelect
              value={supplierId}
              onChange={onSupplierChange}
              options={supplierOptions}
              disabled={!!disabled}
              lockSupplier={!!lockSupplier}
              error={supplierError}
              className="focus:ring-primary/20 h-10 w-full text-base shadow-sm transition-all focus:ring-2"
              {...(currentSupplier ? { currentSupplier } : {})}
            />
          </div>
        </div>

        <div className="relative z-20 flex w-full flex-col">
          <Label className={labelClass}>{t("form.brand", "Marca")}</Label>
          <div className="w-full">
            {supplierId && supplierId !== "undefined" ? (
              <div className="w-full duration-200 animate-in fade-in slide-in-from-top-1">
                <SupplierBrandSelect
                  key={supplierId}
                  value={
                    brandId && brandId !== "undefined" ? brandId : undefined
                  }
                  onChange={onBrandChange}
                  brandOptions={brandOptions}
                  disabled={!!disabled}
                  error={brandError}
                  supplierId={supplierId}
                  className="focus:ring-primary/20 h-10 w-full text-base shadow-sm transition-all focus:ring-2"
                  {...(currentBrand ? { currentBrand } : {})}
                />
              </div>
            ) : (
              <div className="flex h-10 w-full select-none items-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 text-xs italic text-gray-400 dark:border-gray-700 dark:bg-gray-800/50">
                {t("form.selectSupplierFirst", "Selecciona proveedor")}
              </div>
            )}
          </div>
        </div>

        <div className="relative z-10 flex w-full flex-col">
          <Label htmlFor="expected_date" className={labelClass}>
            {t("form.expectedDate")}
          </Label>
          <div className="w-full">
            <Input
              id="expected_date"
              type="date"
              {...restRegister}
              disabled={!!disabled}
              placeholder={t("form.expectedDatePlaceholder")}
              value={expectedDate || ""}
              className={cn(
                "focus:ring-primary/20 h-10 w-full py-1 text-base shadow-sm transition-all focus:ring-2",
                expectedDateError && "border-red-500 focus:ring-red-200"
              )}
              onChange={e => {
                formOnChange(e);
                onExpectedDateChange?.(e.target.value);
              }}
            />
            {expectedDateError && (
              <p className="mt-1.5 text-[10px] font-semibold text-red-500 animate-in fade-in">
                {expectedDateError}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

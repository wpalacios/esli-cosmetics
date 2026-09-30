"use client";

import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@esli-cosmetics/ui";
import { ProductType } from "@esli-cosmetics/types";

interface ProductTypeOption {
  value: ProductType;
  label: string;
  color: string;
  focusBgColor: string;
}

interface CreateProductDropdownProps {
  onSelectType: (type: ProductType) => void;
  /** When set, shows a separator and “Print catalog” (i18n) below product types */
  onPrintCatalog?: () => void;
  isExporting?: boolean;
  children?: React.ReactNode;
}

export function CreateProductDropdown({
  onSelectType,
  onPrintCatalog,
  isExporting = false,
  children,
}: CreateProductDropdownProps) {
  const { t } = useTranslation("products");

  const productTypes: ProductTypeOption[] = [
    {
      value: ProductType.STANDARD,
      label: t("dropdown.productStandard"),
      color: "text-blue-800 dark:text-blue-300",
      focusBgColor: "focus:bg-blue-50 dark:focus:bg-blue-900/50",
    },
    {
      value: ProductType.KIT,
      label: t("dropdown.productKit"),
      color: "text-green-800 dark:text-green-300",
      focusBgColor: "focus:bg-green-50 dark:focus:bg-green-900/50",
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t("dropdown.selectProductType")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {productTypes.map(type => (
          <DropdownMenuItem
            key={type.value}
            onClick={() => onSelectType(type.value)}
            className={`flex items-center gap-3 ${type.color} ${type.focusBgColor}`}
          >
            <span>{type.label}</span>
          </DropdownMenuItem>
        ))}
        {onPrintCatalog ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onPrintCatalog}
              disabled={isExporting}
              className="text-gray-900 focus:bg-pink-50 dark:text-gray-100 dark:focus:bg-pink-950/40"
            >
              {t("page.printCatalog")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

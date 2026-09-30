"use client";

import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  Button,
} from "@esli-cosmetics/ui";
import {
  PlusCircledIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ShuffleIcon,
  ExclamationTriangleIcon,
  LoopIcon,
  CubeIcon,
  MinusCircledIcon,
  CrossCircledIcon,
} from "@radix-ui/react-icons";
import {
  StockMovementType,
  StockMovementsPreviewFilters,
} from "@esli-cosmetics/types";

type FilterStockMovementType = StockMovementsPreviewFilters["movementType"];

interface MovementTypeFilterDropdownProps {
  value?: FilterStockMovementType | undefined;
  onChange: (type: FilterStockMovementType | undefined) => void;
  disabled?: boolean;
  className?: string;
}

const MOVEMENT_TYPES = [
  {
    value: StockMovementType.PURCHASE,
    labelKey: "movements.types.PURCHASE",
    icon: PlusCircledIcon,
    color: "text-green-800 dark:text-green-300",
    bg: "focus:bg-green-50 dark:focus:bg-green-900/50",
  },
  {
    value: StockMovementType.SALE,
    labelKey: "movements.types.SALE",
    icon: MinusCircledIcon,
    color: "text-red-800 dark:text-red-300",
    bg: "focus:bg-red-50 dark:focus:bg-red-900/50",
  },
  {
    value: StockMovementType.POSITIVE_ADJUSTMENT,
    labelKey: "movements.types.POSITIVE_ADJUSTMENT",
    icon: ArrowUpIcon,
    color: "text-yellow-800 dark:text-yellow-300",
    bg: "focus:bg-yellow-50 dark:focus:bg-yellow-900/50",
  },
  {
    value: StockMovementType.NEGATIVE_ADJUSTMENT,
    labelKey: "movements.types.NEGATIVE_ADJUSTMENT",
    icon: ArrowDownIcon,
    color: "text-orange-800 dark:text-orange-300",
    bg: "focus:bg-orange-50 dark:focus:bg-orange-900/50",
  },
  {
    value: StockMovementType.TRANSFER,
    labelKey: "movements.types.TRANSFER",
    icon: ShuffleIcon,
    color: "text-blue-800 dark:text-blue-300",
    bg: "focus:bg-blue-50 dark:focus:bg-blue-900/50",
  },
  {
    value: StockMovementType.DAMAGE,
    labelKey: "movements.types.DAMAGE",
    icon: ExclamationTriangleIcon,
    color: "text-orange-800 dark:text-orange-300",
    bg: "focus:bg-orange-50 dark:focus:bg-orange-900/50",
  },
  {
    value: StockMovementType.RETURN,
    labelKey: "movements.types.RETURN",
    icon: LoopIcon,
    color: "text-purple-800 dark:text-purple-300",
    bg: "focus:bg-purple-50 dark:focus:bg-purple-900/50",
  },
  {
    value: StockMovementType.ANNULMENT,
    labelKey: "movements.types.ANNULMENT",
    icon: CrossCircledIcon,
    color: "text-gray-800 dark:text-gray-300",
    bg: "focus:bg-gray-50 dark:focus:bg-gray-900/50",
  },
];

export function MovementTypeFilterDropdown({
  value,
  onChange,
  disabled = false,
  className,
}: MovementTypeFilterDropdownProps) {
  const { t } = useTranslation("stock");

  const selectedType = MOVEMENT_TYPES.find(type => type.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`flex h-10 w-full items-center justify-start gap-2 rounded-xl border-gray-200 font-bold dark:border-gray-800 ${className || ""}`}
          disabled={disabled}
        >
          {selectedType ? (
            <>
              <selectedType.icon className={`h-4 w-4 ${selectedType.color}`} />
              <span>{t(selectedType.labelKey)}</span>
            </>
          ) : (
            <>
              <ShuffleIcon className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-gray-500">
                {t("reports:filters.allTypes", "Todos los tipos")}
              </span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-64 rounded-xl border-neutral-200 shadow-lg"
      >
        <DropdownMenuLabel className="text-xs uppercase tracking-widest text-gray-500">
          {t("reports:filters.selectType", "Tipo de movimiento")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => onChange(undefined)}
          className="flex cursor-pointer items-center gap-3 text-gray-600 focus:bg-gray-50 dark:focus:bg-gray-800"
        >
          <ShuffleIcon className="h-4 w-4 text-gray-400" />
          <span>{t("reports:filters.allTypes", "Todos los tipos")}</span>
        </DropdownMenuItem>

        {MOVEMENT_TYPES.map(type => (
          <DropdownMenuItem
            key={type.value}
            onClick={() => onChange(type.value as FilterStockMovementType)}
            className={`flex cursor-pointer items-center gap-3 ${type.color} ${type.bg}`}
          >
            <type.icon className="h-4 w-4" />
            <span className="font-medium">{t(type.labelKey)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

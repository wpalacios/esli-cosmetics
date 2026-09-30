"use client";

import { useTranslation } from "react-i18next";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@esli-cosmetics/ui";
import {
  PlusCircledIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExclamationTriangleIcon,
  LoopIcon,
  PlusIcon,
  FileTextIcon,
} from "@radix-ui/react-icons";
import { StockMovementType } from "@esli-cosmetics/types";

interface FieldConfig {
  show: boolean;
  required: boolean;
  label: string;
  placeholder?: string;
}

export interface MovementTypeConfig {
  fromLocation: FieldConfig;
  toLocation: FieldConfig;
  reference: FieldConfig;
  note: FieldConfig;
  allowNegative: boolean;
}

const FIELD_CONFIGS: Record<string, MovementTypeConfig> = {
  [StockMovementType.PURCHASE]: {
    fromLocation: { show: false, required: false, label: "" },
    toLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.receivingLocation",
    },
    reference: {
      show: true,
      required: true,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.purchaseOrder",
    },
    note: {
      show: true,
      required: false,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.purchaseNotes",
    },
    allowNegative: false,
  },
  [StockMovementType.SALE]: {
    fromLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.sellingFrom",
    },
    toLocation: { show: false, required: false, label: "" },
    reference: {
      show: true,
      required: false,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.orderNumber",
    },
    note: {
      show: true,
      required: false,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.saleNotes",
    },
    allowNegative: false,
  },
  [StockMovementType.POSITIVE_ADJUSTMENT]: {
    fromLocation: { show: false, required: false, label: "" },
    toLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.location",
    },
    reference: {
      show: true,
      required: false,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.adjustmentRef",
    },
    note: {
      show: true,
      required: true,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.adjustmentReason",
    },
    allowNegative: false,
  },
  [StockMovementType.NEGATIVE_ADJUSTMENT]: {
    fromLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.location",
    },
    toLocation: { show: false, required: false, label: "" },
    reference: {
      show: true,
      required: false,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.adjustmentRef",
    },
    note: {
      show: true,
      required: true,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.adjustmentReason",
    },
    allowNegative: false,
  },
  [StockMovementType.TRANSFER]: {
    fromLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.fromLocation",
    },
    toLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.toLocation",
    },
    reference: {
      show: true,
      required: false,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.transferRef",
    },
    note: {
      show: true,
      required: false,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.transferNotes",
    },
    allowNegative: false,
  },
  [StockMovementType.DAMAGE]: {
    fromLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.locationOfDamage",
    },
    toLocation: { show: false, required: false, label: "" },
    reference: {
      show: true,
      required: false,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.incidentRef",
    },
    note: {
      show: true,
      required: true,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.damageDescription",
    },
    allowNegative: false,
  },
  [StockMovementType.ANNULMENT]: {
    fromLocation: { show: false, required: false, label: "" },
    toLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.returnTo",
    },
    reference: {
      show: true,
      required: false,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.annulmentRef",
    },
    note: {
      show: true,
      required: false,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.annulmentReason",
    },
    allowNegative: false,
  },
  [StockMovementType.RETURN]: {
    fromLocation: { show: false, required: false, label: "" },
    toLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.returnTo",
    },
    reference: {
      show: true,
      required: true,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.originalTransaction",
    },
    note: {
      show: true,
      required: false,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.returnReason",
    },
    allowNegative: false,
  },
  [StockMovementType.RESTOCK]: {
    fromLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.fromBackroom",
    },
    toLocation: {
      show: true,
      required: true,
      label: "movements.form.locationLabels.toSalesFloor",
    },
    reference: {
      show: true,
      required: false,
      label: "movements.form.reference",
      placeholder: "movements.form.referencePlaceholders.restockRef",
    },
    note: {
      show: true,
      required: false,
      label: "movements.form.note",
      placeholder: "movements.form.notePlaceholders.restockNotes",
    },
    allowNegative: false,
  },
};

interface MovementType {
  value: StockMovementType;
  label: string;
  icon: React.ElementType;
  color: string;
  focusBgColor: string;
}

interface CreateStockMovementDropdownProps {
  onSelectMovement: (
    movementType: StockMovementType,
    config: MovementTypeConfig
  ) => void;
  onSelectExcelPurchaseImport?: () => void;
}

export function CreateStockMovementDropdown({
  onSelectMovement,
  onSelectExcelPurchaseImport,
}: CreateStockMovementDropdownProps) {
  const { t } = useTranslation("stock");

  const movementTypes: MovementType[] = [
    {
      value: StockMovementType.PURCHASE,
      label: t("movements.types.PURCHASE"),
      icon: PlusCircledIcon,
      color: "text-green-800 dark:text-green-300",
      focusBgColor: "focus:bg-green-50 dark:focus:bg-green-900/50",
    },
    {
      value: StockMovementType.POSITIVE_ADJUSTMENT,
      label: t("movements.types.POSITIVE_ADJUSTMENT"),
      icon: ArrowUpIcon,
      color: "text-yellow-800 dark:text-yellow-300",
      focusBgColor: "focus:bg-yellow-50 dark:focus:bg-yellow-900/50",
    },
    {
      value: StockMovementType.NEGATIVE_ADJUSTMENT,
      label: t("movements.types.NEGATIVE_ADJUSTMENT"),
      icon: ArrowDownIcon,
      color: "text-orange-800 dark:text-orange-300",
      focusBgColor: "focus:bg-orange-50 dark:focus:bg-orange-900/50",
    },
    {
      value: StockMovementType.DAMAGE,
      label: t("movements.types.DAMAGE"),
      icon: ExclamationTriangleIcon,
      color: "text-orange-800 dark:text-orange-300",
      focusBgColor: "focus:bg-orange-50 dark:focus:bg-orange-900/50",
    },
    {
      value: StockMovementType.RETURN,
      label: t("movements.types.RETURN"),
      icon: LoopIcon,
      color: "text-purple-800 dark:text-purple-300",
      focusBgColor: "focus:bg-purple-50 dark:focus:bg-purple-900/50",
    },
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" className="flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          <span>{t("movements.dropdown.createMovement")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          {t("movements.dropdown.selectMovementType")}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {movementTypes.map(type => (
          <DropdownMenuItem
            key={type.value}
            onClick={() => {
              const config = FIELD_CONFIGS[type.value];
              if (!config) {
                return;
              }
              onSelectMovement(type.value, config);
            }}
            className={`flex items-center gap-3 ${type.color} ${type.focusBgColor}`}
          >
            <type.icon className="h-4 w-4" />
            <span>{type.label}</span>
          </DropdownMenuItem>
        ))}
        {onSelectExcelPurchaseImport ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onSelectExcelPurchaseImport()}
              className="flex items-center gap-3 text-blue-800 focus:bg-blue-50 dark:text-blue-200 dark:focus:bg-blue-950/40"
            >
              <FileTextIcon className="h-4 w-4" />
              <span>{t("movements.dropdown.excelPurchase")}</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

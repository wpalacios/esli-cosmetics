"use client";

import { useTranslation } from "react-i18next";
import {
  StockMovementWithRelations,
  StockMovementType,
} from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { StockMovementForm } from "../forms/stock-movement-form";
import { StockMovementFormSkeleton } from "@/app/(dashboard)/stock/stock-movements/components/stock-movement-form-skeleton";
import { MovementTypeConfig } from "@/app/(dashboard)/stock/stock-movements/components/create-stock-movement-dropdown";

interface InitialData {
  productId?: string;
  productVariantId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  movementType?: StockMovementType;
}

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockMovement?: StockMovementWithRelations | undefined;
  onSuccess?: (action: "create" | "update") => void;
  initialData?: InitialData;
  movementType?: StockMovementType;
  config?: MovementTypeConfig;
}

export function StockMovementModal({
  isOpen,
  onClose,
  stockMovement,
  onSuccess,
  initialData,
  movementType,
  config,
}: StockMovementModalProps) {
  const { t } = useTranslation(["stock", "stock-movements"]);

  const handleSuccess = (action: "create" | "update") => {
    onSuccess?.(action);
    onClose();
  };

  const isLoading = !movementType || !config;

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent
        size="full"
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        showCloseButton={true}
      >
        <ModalHeader>
          <ModalTitle>{t("movements.form.title", { ns: "stock" })}</ModalTitle>
        </ModalHeader>

        <div className="px-6 pb-6">
          {isLoading ? (
            <StockMovementFormSkeleton />
          ) : (
            <StockMovementForm
              {...(stockMovement ? { stockMovement } : {})}
              onSuccess={handleSuccess}
              onCancel={onClose}
              {...(initialData ? { initialData } : {})}
              movementType={movementType}
              config={config}
            />
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}

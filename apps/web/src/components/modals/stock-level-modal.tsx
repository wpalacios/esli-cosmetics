"use client";

import { StockLevelWithRelations } from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { StockLevelForm } from "../forms/stock-level-form";

interface StockLevelModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockLevel?: StockLevelWithRelations | undefined;
  onSuccess?: (action: "create" | "update") => void;
}

export function StockLevelModal({
  isOpen,
  onClose,
  stockLevel,
  onSuccess,
}: StockLevelModalProps) {
  const handleSuccess = (action: "create" | "update") => {
    onSuccess?.(action);
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent
        size="full"
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        showCloseButton={true}
      >
        <ModalHeader>
          <ModalTitle>
            {stockLevel ? "Edit Stock Level" : "Create New Stock Level"}
          </ModalTitle>
        </ModalHeader>

        <div className="px-6 pb-6">
          <StockLevelForm
            stockLevel={stockLevel}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </ModalContent>
    </Modal>
  );
}

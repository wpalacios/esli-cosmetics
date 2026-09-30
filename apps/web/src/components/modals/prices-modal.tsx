"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { PriceType } from "@esli-cosmetics/types";
import { PriceForm } from "../forms/prices-form";
import { useTranslation } from "react-i18next";

interface PriceModalProps {
  isOpen: boolean;
  onClose: () => void;
  priceType?: PriceType | undefined;
  onSuccess?: (action: "create" | "update", priceName: string) => void;
}

export function PriceModal({
  isOpen,
  onClose,
  onSuccess,
  priceType,
}: PriceModalProps) {
  const handleSuccess = (action: "create" | "update", priceName: string) => {
    onSuccess?.(action, priceName);
    onClose();
  };
  const { t } = useTranslation("prices");
  const modalTitleKey = priceType ? "modal.editTitle" : "modal.createTitle";

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent
        size="full"
        className="max-h-[90vh] max-w-xl overflow-y-auto"
        showCloseButton={true}
      >
        <ModalHeader>
          <ModalTitle>{t(modalTitleKey)}</ModalTitle>
        </ModalHeader>
        <div className="px-6 pb-6">
          <PriceForm
            initialData={priceType}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </ModalContent>
    </Modal>
  );
}

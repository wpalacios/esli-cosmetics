"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { TaxRate } from "@esli-cosmetics/types";
import { TaxRateForm } from "../forms/tax-rates-form";
import { useTranslation } from "react-i18next";

interface TaxRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  taxRate?: TaxRate | undefined;
  onSuccess?: (action: "create" | "update", taxRateName: string) => void;
}

export function TaxRateModal({
  isOpen,
  onClose,
  onSuccess,
  taxRate,
}: TaxRateModalProps) {
  const handleSuccess = (action: "create" | "update", taxRateName: string) => {
    onSuccess?.(action, taxRateName);
    onClose();
  };
  const { t } = useTranslation("tax-rates");
  const modalTitleKey = taxRate ? "modal.editTitle" : "modal.createTitle";

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
          <TaxRateForm
            initialData={taxRate}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </ModalContent>
    </Modal>
  );
}

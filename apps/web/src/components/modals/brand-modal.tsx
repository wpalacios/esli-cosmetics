"use client";

import { useTranslation } from "react-i18next";
import { BrandWithRelations } from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { BrandForm } from "../forms/brand-form";

interface BrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  brand?: BrandWithRelations | undefined;
  onSuccess?: (action: "create" | "update", brandName: string) => void;
}

export function BrandModal({
  isOpen,
  onClose,
  brand,
  onSuccess,
}: BrandModalProps) {
  const { t } = useTranslation("brands");

  const handleSuccess = (action: "create" | "update", brandName: string) => {
    onSuccess?.(action, brandName);
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={() => onClose()}>
      <ModalContent
        size="full"
        className="max-h-[90vh] max-w-4xl overflow-y-auto"
        showCloseButton={true}
      >
        <ModalHeader>
          <ModalTitle>
            {brand ? t("modal.editTitle") : t("modal.createTitle")}
          </ModalTitle>
        </ModalHeader>

        <div className="px-6 pb-6">
          <BrandForm
            brand={brand}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </ModalContent>
    </Modal>
  );
}

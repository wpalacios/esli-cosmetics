"use client";

import { useTranslation } from "react-i18next";
import { DiscountCode } from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { DiscountCodeForm } from "@/components/forms/discount-code-form";

interface DiscountCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  discountCode?: DiscountCode | null;
  onSuccess?: (action: "create" | "update", discountCode: DiscountCode) => void;
}

export function DiscountCodeModal({
  isOpen,
  onClose,
  discountCode,
  onSuccess,
}: DiscountCodeModalProps) {
  const { t } = useTranslation("discount-codes");

  const isEditing = !!discountCode;
  const title = isEditing ? t("modal.editTitle") : t("modal.createTitle");
  const description = isEditing ? t("modal.editDesc") : t("modal.createDesc");

  const handleSuccess = (
    action: "create" | "update",
    discountCode: DiscountCode
  ) => {
    onSuccess?.(action, discountCode);
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={handleCancel}>
      <ModalContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl lg:max-w-4xl">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">{title}</ModalTitle>
          <p className="text-sm text-gray-600">{description}</p>
        </ModalHeader>

        <DiscountCodeForm
          discountCode={discountCode}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </ModalContent>
    </Modal>
  );
}

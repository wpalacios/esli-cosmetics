"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IoClose } from "react-icons/io5";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { CustomerType } from "@esli-cosmetics/types";
import { CustomerTypeForm } from "@/components/forms/customer-types-form";

interface CustomerTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerType?: CustomerType;
  onSuccess?: (action: "create" | "update", customerTypeName: string) => void;
}

export function CustomerTypeModal({
  isOpen,
  onClose,
  customerType,
  onSuccess,
}: CustomerTypeModalProps) {
  const { t } = useTranslation("customer-types");
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(false);
    onClose();
  };

  const handleSuccess = (
    action: "create" | "update",
    customerTypeName: string
  ) => {
    onSuccess?.(action, customerTypeName);
    handleClose();
  };

  const handleCancel = () => {
    if (!isClosing) {
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleCancel}>
      <ModalContent className="sm:max-w-[520px]">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            {customerType ? t("modal.editTitle") : t("modal.createTitle")}
          </ModalTitle>
        </ModalHeader>

        <CustomerTypeForm
          initialData={customerType}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </ModalContent>
    </Modal>
  );
}

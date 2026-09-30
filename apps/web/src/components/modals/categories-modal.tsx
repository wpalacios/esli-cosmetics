"use client";

import { useTranslation } from "react-i18next";
import { CategoryWithRelations } from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { CategoryForm } from "../forms/categories-form";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: CategoryWithRelations | undefined;
  onSuccess?: (action: "create" | "update", categoryName: string) => void;
}

export function CategoryModal({
  isOpen,
  onClose,
  category,
  onSuccess,
}: CategoryModalProps) {
  const { t } = useTranslation("categories");

  const handleSuccess = (action: "create" | "update", categoryName: string) => {
    onSuccess?.(action, categoryName);
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
            {category ? t("modal.editTitle") : t("modal.createTitle")}
          </ModalTitle>
        </ModalHeader>

        <div className="px-6 pb-6">
          <CategoryForm
            category={category}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </ModalContent>
    </Modal>
  );
}

"use client";

import { useTranslation } from "react-i18next";
import { EmployeeWithRelations } from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { EmployeeForm } from "../forms/employee-form";

interface EmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee?: EmployeeWithRelations | undefined;
  onSuccess?: (action: "create" | "update", employeeName: string) => void;
}

export function EmployeeModal({
  isOpen,
  onClose,
  employee,
  onSuccess,
}: EmployeeModalProps) {
  const { t } = useTranslation("employees");

  const handleSuccess = (action: "create" | "update", employeeName: string) => {
    onSuccess?.(action, employeeName);
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
            {employee ? t("modal.editTitle") : t("modal.createTitle")}
          </ModalTitle>
        </ModalHeader>

        <div className="px-6 pb-6">
          <EmployeeForm
            employee={employee}
            onSuccess={handleSuccess}
            onCancel={onClose}
          />
        </div>
      </ModalContent>
    </Modal>
  );
}

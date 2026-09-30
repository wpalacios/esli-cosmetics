"use client";

import { useTranslation } from "react-i18next";
import {
  RoleWithPermissions,
  CreateRoleRequest,
  UpdateRoleRequest,
} from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { RoleForm } from "../forms/roles-form";
import { useState } from "react";

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: CreateRoleRequest | UpdateRoleRequest,
    id?: string
  ) => Promise<RoleWithPermissions | void>;
  role?: RoleWithPermissions | null;
  isLoading?: boolean;
}

export function RoleModal({
  isOpen,
  onClose,
  onSave,
  role,
  isLoading = false,
}: RoleModalProps) {
  const { t } = useTranslation("roles");
  const [isModalSaving, setIsModalSaving] = useState(false);
  const { toast } = useToast();
  const isSubmitting = isLoading || isModalSaving;
  const isEditMode = !!role;

  const handleSave = async (
    data: CreateRoleRequest | UpdateRoleRequest,
    id?: string
  ): Promise<RoleWithPermissions | void> => {
    try {
      setIsModalSaving(true);
      const result = await onSave(data, id);
      toast({
        title: t("form.success"),
        description: isEditMode ? t("form.updated") : t("form.created"),
        type: "success",
      });
      onClose();
      return result;
    } catch (error) {
      console.error("Role save error:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "CONFLICT")
      // Instead of parsing status codes, check: (error as any)?.code === "CONFLICT"
      // This allows for more specific error messages per error type

      let errorMessage = t("form.saveFailed");

      if (error && typeof error === "object" && "message" in error) {
        const errorString = String(error.message);

        const statusMatch = errorString.match(/API Error: (\d+)/);
        const statusCode =
          statusMatch && statusMatch[1] ? parseInt(statusMatch[1]) : null;

        if (statusCode) {
          switch (statusCode) {
            case 400:
              errorMessage = t("form.genericConflict");
              break;
            case 401:
              errorMessage = t("form.unauthorized");
              break;
            case 403:
              errorMessage = t("form.forbidden");
              break;
            case 404:
              errorMessage = t("form.notFound");
              break;
            case 409:
              errorMessage = t("form.genericConflict");
              break;
            case 422:
              errorMessage = t("form.validationError");
              break;
            case 500:
              errorMessage = t("form.serverError");
              break;
            default:
              errorMessage = t("form.genericError");
          }
        } else {
          errorMessage = t("form.genericError");
        }
      } else if (typeof error === "string") {
        errorMessage = t("form.genericError");
      }

      toast({
        title: t("form.error"),
        description: errorMessage,
        type: "error",
      });
    } finally {
      setIsModalSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleCancel}>
      <ModalContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl lg:max-w-4xl">
        <ModalHeader>
          <ModalTitle className="flex items-center gap-2">
            {isEditMode ? t("modal.editTitle") : t("modal.createTitle")}
          </ModalTitle>
          <p className="text-sm text-gray-600">
            {isEditMode ? t("modal.editDesc") : t("modal.createDesc")}
          </p>
        </ModalHeader>

        <RoleForm
          role={role ?? null}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isSubmitting}
        />
      </ModalContent>
    </Modal>
  );
}

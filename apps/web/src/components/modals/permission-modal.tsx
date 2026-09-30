"use client";

import { useTranslation } from "react-i18next";
import {
  Permission,
  CreatePermissionRequest,
  UpdatePermissionRequest,
} from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { PermissionForm } from "../forms/permissions-form";
import { useState } from "react";

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: CreatePermissionRequest | UpdatePermissionRequest,
    id?: string
  ) => Promise<void>;
  permission?: Permission | null;
  isLoading?: boolean;
  showKeyField?: boolean;
}

export function PermissionModal({
  isOpen,
  onClose,
  onSave,
  permission,
  isLoading = false,
  showKeyField = false,
}: PermissionModalProps) {
  const { t } = useTranslation("permissions");
  const [isModalSaving, setIsModalSaving] = useState(false);
  const { toast } = useToast();
  const isSubmitting = isLoading || isModalSaving;
  const isEditMode = !!permission;

  const handleSave = async (
    data: CreatePermissionRequest | UpdatePermissionRequest,
    id?: string
  ) => {
    try {
      setIsModalSaving(true);
      await onSave(data, id);
      toast({
        title: t("form.success"),
        description: isEditMode ? t("form.updated") : t("form.created"),
        type: "success",
      });
      onClose();
    } catch (error) {
      console.error("Permission save error:", error);

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

        <PermissionForm
          permission={permission ?? null}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isSubmitting}
          showKeyField={showKeyField}
        />
      </ModalContent>
    </Modal>
  );
}

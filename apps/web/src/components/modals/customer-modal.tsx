"use client";

import { useTranslation } from "react-i18next";
import {
  CustomerWithRelations,
  CreateCustomerRequest,
  UpdateCustomerRequest,
} from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Input,
} from "@esli-cosmetics/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { CustomerForm } from "../forms/customers-form";
import { useState } from "react";

interface CustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (
    data: CreateCustomerRequest | UpdateCustomerRequest,
    id?: string
  ) => Promise<void>;
  customer?: CustomerWithRelations | null;
  isLoading?: boolean;
}

export function CustomerModal({
  isOpen,
  onClose,
  onSave,
  customer,
  isLoading = false,
}: CustomerModalProps) {
  const { t } = useTranslation("customers");
  const [isModalSaving, setIsModalSaving] = useState(false);
  const { toast } = useToast();
  const isSubmitting = isLoading || isModalSaving;
  const isEditMode = !!customer;

  const handleSave = async (
    data: CreateCustomerRequest | UpdateCustomerRequest,
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
      console.error("Customer save error:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "EMAIL_ALREADY_EXISTS")
      // Instead of parsing status codes, check: (error as any)?.code === "EMAIL_ALREADY_EXISTS"
      // This allows for more specific error messages per error type

      let errorMessage = t("form.saveFailed");

      if (error && typeof error === "object" && "message" in error) {
        const errorString = String(error.message);

        // Extract status code from API error format: "API Error: 400 - {...}"
        const statusMatch = errorString.match(/API Error: (\d+)/);
        const statusCode =
          statusMatch && statusMatch[1] ? parseInt(statusMatch[1]) : null;

        // Show user-friendly messages based on status code
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
          // Fallback for non-API errors
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

        <CustomerForm
          customer={customer ?? null}
          onSave={handleSave}
          onCancel={handleCancel}
          isLoading={isSubmitting}
        />
      </ModalContent>
    </Modal>
  );
}

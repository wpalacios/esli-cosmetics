import { forwardRef } from "react";
import { AiOutlineExclamationCircle } from "react-icons/ai";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@esli-cosmetics/utils";
import { Button } from "@esli-cosmetics/ui";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@esli-cosmetics/ui";
import { useTranslation } from "react-i18next";

import type { ConfirmationDialogContentSize } from "./use-confirmation-dialog";

const confirmationDialogVariants = cva(
  "flex items-center justify-center rounded-full",
  {
    variants: {
      variant: {
        destructive:
          "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400",
        warning:
          "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400",
        info: "bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
      },
      size: {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "destructive",
      size: "md",
    },
  }
);

export interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | undefined;
  confirmText: string | undefined;
  cancelText: string | undefined;
  variant: "destructive" | "warning" | "info" | undefined;
  contentSize?: ConfirmationDialogContentSize;
  onConfirm: () => void;
  onCancel: (() => void) | undefined;
  isLoading: boolean;
}

export const ConfirmationDialog = forwardRef<
  HTMLDivElement,
  ConfirmationDialogProps
>(
  (
    {
      open,
      onOpenChange,
      title,
      description,
      confirmText,
      cancelText,
      variant,
      contentSize,
      onConfirm,
      onCancel,
      isLoading = false,
    },
    ref
  ) => {
    const { t } = useTranslation("common");
    const handleCancel = () => {
      onCancel?.();
      onOpenChange(false);
    };

    const handleConfirm = () => {
      onConfirm();
      onOpenChange(false);
    };

    return (
      <Modal open={open} onClose={() => onOpenChange(false)}>
        <ModalContent
          size={contentSize ?? "sm"}
          showCloseButton={false}
          className="px-6 sm:px-8"
        >
          <ModalHeader className="items-center gap-2 text-center">
            <div
              className={cn(
                confirmationDialogVariants({ variant, size: "lg" }),
                "mx-auto mb-4"
              )}
            >
              <AiOutlineExclamationCircle className="h-6 w-6" />
            </div>
            <ModalTitle className="text-center text-lg">{title}</ModalTitle>
            {description && (
              <ModalDescription className="text-balance break-words text-center">
                {description}
              </ModalDescription>
            )}
          </ModalHeader>

          <ModalFooter className="flex-row gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1"
            >
              {cancelText || t("common.cancel")}
            </Button>
            <Button
              variant={variant === "destructive" ? "error" : "primary"}
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading
                ? t("common.loading")
                : confirmText || t("common.confirm")}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }
);

ConfirmationDialog.displayName = "ConfirmationDialog";

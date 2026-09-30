import { cva } from "class-variance-authority";
import React, { forwardRef } from "react";
import { AiOutlineExclamationCircle } from "react-icons/ai";

import { cn } from "@esli-cosmetics/utils";
import { Button } from "../atoms/button";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "./modal";

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

export type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning" | "info";
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
};

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
      confirmText = "Confirm",
      cancelText = "Cancel",
      variant = "destructive",
      onConfirm,
      onCancel,
      isLoading = false,
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ref
  ) => {
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
        <ModalContent size="sm" showCloseButton={false}>
          <ModalHeader className="text-center">
            <div
              className={cn(
                confirmationDialogVariants({ variant, size: "lg" }),
                "mx-auto mb-4"
              )}
            >
              {React.createElement(
                AiOutlineExclamationCircle as React.ElementType,
                {
                  className: "h-6 w-6",
                }
              )}
            </div>
            <ModalTitle className="text-lg">{title}</ModalTitle>
            {description && (
              <ModalDescription className="text-center">
                {description}
              </ModalDescription>
            )}
          </ModalHeader>

          <ModalFooter className="flex-row gap-3 sm:gap-3">
            {onCancel && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                className="flex-1"
              >
                {cancelText}
              </Button>
            )}
            <Button
              variant={variant === "destructive" ? "error" : "primary"}
              onClick={handleConfirm}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Loading..." : confirmText}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }
);

ConfirmationDialog.displayName = "ConfirmationDialog";

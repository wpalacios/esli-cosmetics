"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModalDescription,
  Button,
  Label,
  Textarea,
} from "@esli-cosmetics/ui";

const DEFAULT_MIN_REASON = 5;

export type ReversePaymentModalProps = Readonly<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  isLoading?: boolean;
  title: string;
  description?: string;
  reasonLabel: string;
  reasonPlaceholder?: string;
  defaultReason?: string;
  /** Optional line showing payment amount (already formatted). */
  amountSummary?: string;
  confirmLabel: string;
  cancelLabel: string;
  minReasonLength?: number;
}>;

export function ReversePaymentModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
  title,
  description,
  reasonLabel,
  reasonPlaceholder,
  defaultReason = "Pago registrado por error",
  amountSummary,
  confirmLabel,
  cancelLabel,
  minReasonLength = DEFAULT_MIN_REASON,
}: ReversePaymentModalProps) {
  const [reason, setReason] = useState(defaultReason);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason(defaultReason);
      setReasonError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultReason]);

  const busy = isSubmitting || isLoading;

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < minReasonLength) {
      setReasonError(
        `El motivo debe tener al menos ${minReasonLength} caracteres.`
      );
      return;
    }
    setReasonError(null);
    setIsSubmitting(true);
    try {
      await onConfirm(trimmed);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent size="md" className="max-w-lg">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          {description ? (
            <ModalDescription className="text-left">
              {description}
            </ModalDescription>
          ) : null}
          {amountSummary ? (
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {amountSummary}
            </p>
          ) : null}
        </ModalHeader>

        <div className="space-y-2">
          <Label htmlFor="reverse-payment-reason">{reasonLabel}</Label>
          <Textarea
            id="reverse-payment-reason"
            value={reason}
            onChange={e => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
            placeholder={reasonPlaceholder}
            disabled={busy}
            rows={4}
            className="min-h-[100px] resize-y"
          />
          {reasonError ? (
            <p className="text-sm text-red-600 dark:text-red-400">
              {reasonError}
            </p>
          ) : null}
        </div>

        <ModalFooter className="flex-row justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={busy}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="error"
            onClick={() => void handleSubmit()}
            disabled={busy}
          >
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

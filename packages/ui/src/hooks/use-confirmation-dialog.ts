import { useState, useCallback } from "react";

export type ConfirmationDialogOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "warning" | "info";
};

export type UseConfirmationDialogReturn = {
  isOpen: boolean;
  openDialog: (options: ConfirmationDialogOptions) => Promise<boolean>;
  closeDialog: () => void;
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string | undefined;
    confirmText: string | undefined;
    cancelText: string | undefined;
    variant: "destructive" | "warning" | "info" | undefined;
    onConfirm: () => void;
    onCancel: () => void;
    isLoading: boolean;
  };
};

export function useConfirmationDialog(): UseConfirmationDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<ConfirmationDialogOptions>({
    title: "",
  });
  const [resolvePromise, setResolvePromise] = useState<
    ((value: boolean) => void) | null
  >(null);

  const openDialog = useCallback(
    (dialogOptions: ConfirmationDialogOptions): Promise<boolean> => {
      return new Promise(resolve => {
        setOptions(dialogOptions);
        setResolvePromise(() => resolve);
        setIsOpen(true);
      });
    },
    []
  );

  const closeDialog = useCallback(() => {
    setIsOpen(false);
    setIsLoading(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const handleConfirm = useCallback(async () => {
    setIsLoading(true);
    try {
      if (resolvePromise) {
        resolvePromise(true);
        setResolvePromise(null);
      }
    } finally {
      setIsLoading(false);
      setIsOpen(false);
    }
  }, [resolvePromise]);

  const handleCancel = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  return {
    isOpen,
    openDialog,
    closeDialog,
    dialogProps: {
      open: isOpen,
      onOpenChange: setIsOpen,
      title: options.title,
      description: options.description,
      confirmText: options.confirmText,
      cancelText: options.cancelText,
      variant: options.variant,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
      isLoading,
    },
  };
}

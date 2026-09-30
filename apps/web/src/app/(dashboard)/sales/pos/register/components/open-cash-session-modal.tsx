"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@esli-cosmetics/ui";
import { Button, Input, Label, SearchableSelect } from "@esli-cosmetics/ui";
import {
  useOpenCashSession,
  useCashRegisters,
} from "@/hooks/use-cash-register";
import { CashRegister } from "@esli-cosmetics/types";
import { useToast } from "@/hooks/toast/use-toast";

const createOpenSessionSchema = (t: (key: string) => string) =>
  z.object({
    cashRegisterId: z.string().min(1, t("validation.cashRegisterRequired")),
    openingBalance: z.number().min(0, t("validation.openingBalanceMin")),
  });

type OpenSessionFormData = z.infer<ReturnType<typeof createOpenSessionSchema>>;

interface OpenCashSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  cashRegisters: CashRegister[];
  isLoadingCashRegisters?: boolean;
}

export function OpenCashSessionModal({
  isOpen,
  onClose,
  onSuccess,
  cashRegisters,
  isLoadingCashRegisters = false,
}: OpenCashSessionModalProps) {
  const { t } = useTranslation("cash-register");
  const { toast } = useToast();
  const openSessionMutation = useOpenCashSession();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<OpenSessionFormData>({
    resolver: zodResolver(createOpenSessionSchema(t)),
    defaultValues: {
      openingBalance: 0,
    },
  });

  const cashRegisterId = watch("cashRegisterId");

  // Convert cash registers to options for SearchableSelect
  // Ensure we handle empty arrays and undefined values
  const cashRegisterOptions = (cashRegisters || []).map(register => ({
    value: register.id,
    label: `${register.name}${register.code ? ` (${register.code})` : ""}`,
    data: register,
  }));

  const onSubmit = async (data: OpenSessionFormData) => {
    try {
      await openSessionMutation.mutateAsync({
        cashRegisterId: data.cashRegisterId,
        openingBalance: data.openingBalance,
      });
      toast({
        title: t("messages.sessionOpened"),
        type: "success",
      });
      reset();
      // Notify parent first (which will refetch), then close modal
      // The parent's onSuccess will handle the refetch and modal closing
      await onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: t("messages.error"),
        description: error?.message || t("messages.openFailed"),
        type: "error",
      });
    }
  };

  const handleClose = () => {
    if (!openSessionMutation.isPending) {
      reset();
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent
        size="lg"
        onInteractOutside={e => {
          // Prevent modal from closing when clicking on Select dropdown
          const target = e.target as HTMLElement;
          // Check if click is on the Select dropdown (portal content)
          const isSelectContent =
            target.closest("[data-radix-select-content]") ||
            target.closest("[data-radix-select-viewport]") ||
            target.closest("[data-radix-select-item]") ||
            target.closest("[data-radix-popper-content-wrapper]");
          if (isSelectContent) {
            e.preventDefault();
          }
        }}
      >
        <ModalHeader>
          <ModalTitle>{t("open.title")}</ModalTitle>
        </ModalHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="cashRegisterId">{t("open.cashRegister")}</Label>
              {isLoadingCashRegisters ? (
                <div className="py-2 text-sm text-gray-500 dark:text-gray-400">
                  {t("common.loading")}
                </div>
              ) : cashRegisterOptions.length === 0 ? (
                <div className="py-2 text-sm text-gray-500 dark:text-gray-400">
                  {t("status.noRegisters")}
                </div>
              ) : (
                <SearchableSelect
                  options={cashRegisterOptions}
                  value={cashRegisterId}
                  onValueChange={value =>
                    setValue("cashRegisterId", value, { shouldValidate: true })
                  }
                  placeholder={t("open.selectRegister")}
                  disabled={openSessionMutation.isPending}
                  {...(errors.cashRegisterId?.message && {
                    error: errors.cashRegisterId.message,
                  })}
                  searchPlaceholder={
                    t("open.searchRegister") || "Search cash registers..."
                  }
                  emptyMessage={
                    t("open.noRegistersFound") || "No cash registers found"
                  }
                />
              )}
            </div>

            <div>
              <Label htmlFor="openingBalance">{t("open.openingBalance")}</Label>
              <Input
                id="openingBalance"
                type="number"
                step="0.01"
                min="0"
                placeholder={t("open.openingBalance")}
                disabled={openSessionMutation.isPending}
                {...register("openingBalance", { valueAsNumber: true })}
                {...(errors.openingBalance?.message && {
                  error: errors.openingBalance.message,
                })}
              />
            </div>
          </div>

          <ModalFooter>
            <Button type="submit" disabled={openSessionMutation.isPending}>
              {openSessionMutation.isPending
                ? t("common.loading")
                : t("open.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={openSessionMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  Button,
  Input,
  Label,
  SearchableSelect,
  type SearchableSelectOption,
} from "@esli-cosmetics/ui";
import { useCreateCashMovement } from "@/hooks/use-cash-register";
import { CashSession, CashMovementType } from "@esli-cosmetics/types";
import { useToast } from "@/hooks/toast/use-toast";

const createMovementSchema = (t: (key: string) => string) =>
  z.object({
    type: z.enum(["IN", "OUT"], {
      required_error: t("validation.movementTypeRequired"),
    }),
    amount: z
      .number()
      .min(0.01, t("validation.amountMin"))
      .positive(t("validation.amountPositive")),
    reason: z.string().optional(),
  });

type MovementFormData = z.infer<ReturnType<typeof createMovementSchema>>;

interface CashRegisterMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: CashSession;
}

export function CashRegisterMovementModal({
  isOpen,
  onClose,
  session,
}: CashRegisterMovementModalProps) {
  const { t } = useTranslation("cash-register");
  const { toast } = useToast();
  const createMovementMutation = useCreateCashMovement();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<MovementFormData>({
    resolver: zodResolver(createMovementSchema(t)),
    defaultValues: {
      type: "IN",
      amount: 0,
      reason: "",
    },
  });

  const movementTypeOptions: SearchableSelectOption[] = [
    { value: "IN", label: t("movement.typeIn") },
    { value: "OUT", label: t("movement.typeOut") },
  ];

  useEffect(() => {
    if (isOpen) {
      reset({
        type: "IN",
        amount: 0,
        reason: "",
      });
    }
  }, [isOpen, reset]);

  const onSubmit = async (data: MovementFormData) => {
    try {
      await createMovementMutation.mutateAsync({
        cashSessionId: session.id,
        type: data.type as CashMovementType,
        amount: data.amount,
        ...(data.reason && { reason: data.reason }),
      });

      toast({
        title: t("messages.movementCreated"),
        type: "success",
      });

      reset();
      onClose();
    } catch (error: any) {
      toast({
        title: t("messages.error"),
        description: error?.message || t("messages.createMovementFailed"),
        type: "error",
      });
    }
  };

  const handleClose = () => {
    if (!createMovementMutation.isPending) {
      reset();
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>{t("movement.title")}</ModalTitle>
        </ModalHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="type">{t("movement.type")}</Label>
              <Controller
                name="type"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={movementTypeOptions}
                    value={field.value}
                    onValueChange={field.onChange}
                    placeholder={t("movement.type")}
                    error={errors.type?.message}
                    className="mt-1"
                    allowSearch={false}
                  />
                )}
              />
            </div>

            <div>
              <Label htmlFor="amount">{t("movement.amount")}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                {...register("amount", { valueAsNumber: true })}
                {...(errors.amount?.message && {
                  error: errors.amount.message,
                })}
              />
            </div>

            <div>
              <Label htmlFor="reason">{t("movement.reason")}</Label>
              <textarea
                id="reason"
                {...register("reason")}
                rows={3}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 focus:outline-none focus:ring-2 focus-visible:border-primary-500 focus-visible:ring-primary-200"
                placeholder={t("movement.reasonPlaceholder")}
              />
            </div>
          </div>

          <ModalFooter>
            <Button type="submit" disabled={createMovementMutation.isPending}>
              {createMovementMutation.isPending
                ? t("common.loading")
                : t("movement.submit")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createMovementMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

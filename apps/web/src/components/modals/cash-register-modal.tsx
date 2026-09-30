"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import * as z from "zod";
import {
  CashRegister,
  CreateCashRegisterRequest,
  LocationInfo,
} from "@esli-cosmetics/types";
import { Button, Input, Label, Checkbox } from "@esli-cosmetics/ui";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { LocationSelect } from "@/components/ui/location-select";
import {
  useCreateCashRegister,
  useUpdateCashRegister,
} from "@/hooks/use-cash-register";

// Form validation schema
const cashRegisterSchema = z.object({
  name: z.string().min(1, "Cash register name is required"),
  code: z.string().optional(),
  locationId: z.string().min(1, "Location is required"),
  isActive: z.boolean().default(true),
});

type CashRegisterFormData = z.infer<typeof cashRegisterSchema>;

interface CashRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashRegister?: CashRegister | null;
  onSuccess?: (action: "create" | "update", cashRegisterName: string) => void;
}

export function CashRegisterModal({
  isOpen,
  onClose,
  cashRegister,
  onSuccess,
}: CashRegisterModalProps) {
  const { t } = useTranslation("cashRegisters");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createCashRegisterMutation = useCreateCashRegister();
  const updateCashRegisterMutation = useUpdateCashRegister();

  const isEditing = !!cashRegister;
  const title = isEditing ? t("modal.editTitle") : t("modal.createTitle");
  const description = isEditing ? t("modal.editDesc") : t("modal.createDesc");

  const isLoading =
    createCashRegisterMutation.isPending ||
    updateCashRegisterMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<CashRegisterFormData>({
    resolver: zodResolver(cashRegisterSchema),
    defaultValues: {
      name: "",
      code: "",
      locationId: "",
      isActive: true,
    },
  });

  const locationId = watch("locationId");

  // Reset form when cash register changes
  useEffect(() => {
    if (cashRegister) {
      reset({
        name: cashRegister.name,
        code: cashRegister.code || "",
        locationId: cashRegister.locationId || "",
        isActive: cashRegister.isActive,
      });
    } else {
      reset({
        name: "",
        code: "",
        locationId: "",
        isActive: true,
      });
    }
  }, [cashRegister, reset]);

  const onSubmit = async (data: CashRegisterFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Prepare data for mutation, filtering out empty strings and undefined values
      const cleanData: CreateCashRegisterRequest = {
        name: data.name,
        ...(data.code && data.code.trim() !== "" && { code: data.code }),
        ...(data.locationId &&
          data.locationId.trim() !== "" && { locationId: data.locationId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      };

      if (isEditing && cashRegister) {
        await updateCashRegisterMutation.mutateAsync({
          id: cashRegister.id,
          data: cleanData,
        });
        onSuccess?.("update", data.name);
      } else {
        await createCashRegisterMutation.mutateAsync(cleanData);
        onSuccess?.("create", data.name);
      }

      reset();
      onClose();
    } catch (error) {
      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "CONFLICT")
      // Instead of generic error handling, check: (error as any)?.code
      // This allows for more specific error messages per error type

      // Error is handled by the mutation
      console.error("Error saving cash register:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>{title}</ModalTitle>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {description}
          </p>
        </ModalHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div className="space-y-2">
            <Label htmlFor="name">
              {t("form.name")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder={t("form.namePlaceholder")}
              disabled={isSubmitting || isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">{t("form.code")}</Label>
            <Input
              id="code"
              {...register("code")}
              placeholder={t("form.codePlaceholder")}
              disabled={isSubmitting || isLoading}
            />
            {errors.code && (
              <p className="text-sm text-red-500">{errors.code.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="locationId">{t("form.location")}</Label>
            <LocationSelect
              value={locationId}
              onChange={value =>
                setValue("locationId", value || "", { shouldValidate: true })
              }
              placeholder={t("form.locationPlaceholder")}
              currentLocation={
                cashRegister?.location
                  ? ({
                      id: cashRegister.location.id,
                      name: cashRegister.location.name,
                      branchId: cashRegister.location.branchId || null,
                      locationType: "", // We don't have this in the cash register location data
                      address: null,
                      contact: null,
                      isDeleted: false,
                      createdAt: new Date(),
                      updatedAt: new Date(),
                      deletedAt: null,
                    } as LocationInfo)
                  : null
              }
            />
            {errors.locationId && (
              <p className="text-sm text-red-500">
                {errors.locationId.message || t("form.locationRequired")}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Controller
              name="isActive"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="isActive"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                  disabled={isSubmitting || isLoading}
                />
              )}
            />
            <Label
              htmlFor="isActive"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t("form.isActive")}
            </Label>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting || isLoading}
            >
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || isLoading}>
              {isSubmitting
                ? t("form.saving")
                : isEditing
                  ? t("form.update")
                  : t("form.create")}
            </Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}

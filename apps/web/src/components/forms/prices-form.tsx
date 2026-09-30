"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Button, Input, Label, Checkbox } from "@esli-cosmetics/ui";
import { CreatePriceRequest, PriceType } from "@esli-cosmetics/types";
import { useCreatePrice, useUpdatePrice } from "@/hooks/use-prices";
import { useTranslation } from "react-i18next";

interface PriceFormProps {
  initialData?: PriceType | undefined;
  onSuccess?: (action: "create" | "update", priceName: string) => void;
  onCancel?: () => void;
}

const createPriceSchema = (t: (key: string, options?: any) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t("form.priceNameRequired"))
      .max(255, t("validation.maxLength", { max: 255 })),
    description: z
      .string()
      .max(255, t("validation.maxLength", { max: 255 }))
      .optional()
      .nullable(),
    minQuantity: z.coerce
      .number({
        invalid_type_error: t("validation.minQuantityInvalid"),
      })
      .int(t("validation.minQuantityInteger"))
      .min(1, t("validation.minQuantityMin")),
    priority: z.coerce
      .number({
        invalid_type_error: t("validation.priorityInvalid"),
      })
      .int(t("validation.priorityInteger"))
      .min(1, t("validation.priorityMin")),
    isActive: z.boolean().default(true),
  });

type PriceFormData = z.infer<ReturnType<typeof createPriceSchema>>;

export function PriceForm({
  initialData,
  onSuccess,
  onCancel,
}: PriceFormProps) {
  const { t } = useTranslation("prices");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPriceMutation = useCreatePrice();
  const updatePriceMutation = useUpdatePrice();
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    setError,
    reset,
  } = useForm<PriceFormData>({
    resolver: zodResolver(createPriceSchema(t)),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      minQuantity: initialData?.minQuantity || 1,
      priority: initialData?.priority || 1,
      isActive: initialData?.isActive ?? true,
    },
  });

  useEffect(() => {
    reset({
      name: initialData?.name || "",
      description: initialData?.description || "",
      minQuantity: initialData?.minQuantity || 1,
      priority: initialData?.priority || 1,
      isActive: initialData?.isActive ?? true,
    });
  }, [initialData, reset]);

  const onSubmit = async (data: PriceFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const action = isEditing ? "update" : "create";
      const cleanedData: CreatePriceRequest = {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        minQuantity: data?.minQuantity || 1,
        priority: data?.priority || 1,
        isActive: data.isActive,
      };

      const priceName = cleanedData.name;

      if (isEditing && initialData?.id) {
        await updatePriceMutation.mutateAsync({
          id: initialData.id,
          data: cleanedData,
        });
        onSuccess?.("update", priceName);
      } else {
        await createPriceMutation.mutateAsync(cleanedData);
        onSuccess?.("create", priceName);
      }
    } catch (error: any) {
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes("Price name") &&
        errorMessage.includes("already exists")
      ) {
        setError("name", {
          type: "manual",
          message: t("validation.duplicateName"),
        });
      } else if (
        errorMessage.includes("priority") &&
        errorMessage.includes("already exists")
      ) {
        setError("priority", {
          type: "manual",
          message: t("validation.duplicatePriority"),
        });
      } else {
        console.error("Unhandled Price API error:", error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabled = isSubmitting;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t("modal.priceDetails")}
          </h3>
          <div>
            <Label htmlFor="name">{t("form.priceName")} *</Label>
            <Input
              id="name"
              {...register("name")}
              className={errors.name ? "border-red-500" : ""}
              placeholder={t("form.priceNamePlaceholder")}
              disabled={disabled}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.name.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="minQuantity">{t("form.minQuantity")} *</Label>
              <Input
                id="minQuantity"
                type="number"
                min={1}
                {...register("minQuantity", { valueAsNumber: true })}
                className={errors.minQuantity ? "border-red-500" : ""}
                placeholder="1"
                disabled={disabled}
              />
              {errors.minQuantity && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.minQuantity.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="priority">{t("form.priority")} *</Label>
              <Input
                id="priority"
                type="number"
                {...register("priority", { valueAsNumber: true })}
                className={errors.priority ? "border-red-500" : ""}
                placeholder="1"
                disabled={disabled}
              />
              {errors.priority && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.priority.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <Label htmlFor="description">{t("form.description")}</Label>
            <Input
              id="description"
              {...register("description")}
              className={errors.description ? "border-red-500" : ""}
              placeholder={t("form.descriptionPlaceholder")}
              disabled={disabled}
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.description.message}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="!mt-12 flex items-center space-x-2">
        <Checkbox
          id="isActive"
          checked={watch("isActive")}
          onCheckedChange={checked => setValue("isActive", checked as boolean)}
          disabled={disabled}
        />
        <Label htmlFor="isActive">{t("form.active")}</Label>
      </div>
      <div className="flex justify-end space-x-3 pt-6">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={disabled}
          >
            {t("form.cancel")}
          </Button>
        )}
        <Button type="submit" disabled={disabled} variant="secondary">
          {isSubmitting
            ? t("form.saving")
            : initialData
              ? t("form.update")
              : t("form.create")}
        </Button>
      </div>
    </form>
  );
}

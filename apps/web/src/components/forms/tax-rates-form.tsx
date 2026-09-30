"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Button, Input, Label, Checkbox } from "@esli-cosmetics/ui";
import { TaxRate, CreateTaxRateDto } from "@esli-cosmetics/types";
import { useCreateTaxRate, useUpdateTaxRate } from "@/hooks/use-tax-rates";
import { useTranslation } from "react-i18next";
import { getErrorStatus } from "@/lib/errors/api-error";

interface TaxRateFormProps {
  initialData?: TaxRate | undefined;
  onSuccess?: (action: "create" | "update", taxRateName: string) => void;
  onCancel?: () => void;
}

const createTaxRateSchema = (t: (key: string, options?: any) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t("form.taxRateNameRequired"))
      .max(100, t("validation.maxLength", { max: 100 })),
    code: z
      .string()
      .max(10, t("validation.maxLength", { max: 10 }))
      .optional()
      .nullable(),
    rate: z.coerce
      .number({
        invalid_type_error: t("validation.taxRateInvalid"),
      })
      .min(0, t("validation.taxRateMin"))
      .max(100, t("validation.taxRateMax")),
    active: z.boolean().default(true),
  });

type TaxRateFormData = z.infer<ReturnType<typeof createTaxRateSchema>>;

export function TaxRateForm({
  initialData,
  onSuccess,
  onCancel,
}: TaxRateFormProps) {
  const { t } = useTranslation("tax-rates");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createTaxRateMutation = useCreateTaxRate();
  const updateTaxRateMutation = useUpdateTaxRate();
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    setError,
    reset,
  } = useForm<TaxRateFormData>({
    resolver: zodResolver(createTaxRateSchema(t)),
    defaultValues: {
      name: initialData?.name || "",
      code: initialData?.code || "",
      rate: initialData?.rate || 0,
      active: initialData?.active ?? true,
    },
  });

  useEffect(() => {
    reset({
      name: initialData?.name || "",
      code: initialData?.code || "",
      rate: initialData?.rate || 0,
      active: initialData?.active ?? true,
    });
  }, [initialData, reset]);

  const onSubmit = async (data: TaxRateFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const action = isEditing ? "update" : "create";
      const codeValue = data.code?.trim();

      const baseData = {
        name: data.name.trim(),
        rate: data.rate,
        active: data.active,
      };

      const cleanedData = {
        ...baseData,
      } as Partial<CreateTaxRateDto>;

      if (codeValue) {
        cleanedData.code = codeValue;
      } else if (isEditing) {
      }

      const taxRateName = cleanedData.name || "Tax Rate";

      const payload: CreateTaxRateDto = cleanedData as CreateTaxRateDto;

      if (isEditing && initialData?.id) {
        await updateTaxRateMutation.mutateAsync({
          id: initialData.id,
          data: payload,
        });
        onSuccess?.("update", taxRateName);
      } else {
        await createTaxRateMutation.mutateAsync(payload);
        onSuccess?.("create", taxRateName);
      }
    } catch (error: any) {
      console.error("TaxRate form submission error:", error);

      const errorMessage = error?.message || String(error) || "";
      const statusCode = getErrorStatus(error);
      const errorMessageLower = errorMessage.toLowerCase();

      // Handle 409 Conflict errors (duplicate name or code)
      if (statusCode === 409) {
        // Check for duplicate code error
        if (
          errorMessageLower.includes("code") &&
          (errorMessageLower.includes("already exists") ||
            errorMessageLower.includes("tax rate with this code"))
        ) {
          setError("code", {
            type: "server",
            message: t("validation.duplicateCode"),
          });
          return; // Don't re-throw, let user fix the error
        }

        // Check for duplicate name error
        if (
          errorMessageLower.includes("name") &&
          (errorMessageLower.includes("already exists") ||
            errorMessageLower.includes("tax rate with this name"))
        ) {
          setError("name", {
            type: "server",
            message: t("validation.duplicateName"),
          });
          return; // Don't re-throw, let user fix the error
        }

        // Check for combined error message (name or code)
        if (
          errorMessageLower.includes("name or code") &&
          errorMessageLower.includes("already exists")
        ) {
          // If code is provided, prioritize code error; otherwise, name error
          if (data.code?.trim()) {
            setError("code", {
              type: "server",
              message: t("validation.duplicateCode"),
            });
          } else {
            setError("name", {
              type: "server",
              message: t("validation.duplicateName"),
            });
          }
          return; // Don't re-throw, let user fix the error
        }

        // Generic 409 error
        setError("root", {
          type: "server",
          message:
            t("validation.duplicateCode") ||
            "A tax rate with this information already exists.",
        });
        return; // Don't re-throw, let user fix the error
      }

      // Fallback: Try to parse error message for duplicate errors (for backward compatibility)
      if (
        errorMessageLower.includes("taxrate name") &&
        errorMessageLower.includes("already exists")
      ) {
        setError("name", {
          type: "server",
          message: t("validation.duplicateName"),
        });
      } else if (
        errorMessageLower.includes("code") &&
        errorMessageLower.includes("already exists")
      ) {
        setError("code", {
          type: "server",
          message: t("validation.duplicateCode"),
        });
      } else {
        // For other errors, set a root error
        setError("root", {
          type: "server",
          message: errorMessage || "An error occurred. Please try again.",
        });
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
            {t("modal.taxRateDetails")}
          </h3>
          <div>
            <Label htmlFor="name">{t("form.taxRateName")} *</Label>
            <Input
              id="name"
              {...register("name")}
              className={errors.name ? "border-red-500" : ""}
              placeholder={t("form.taxRateNamePlaceholder")}
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
              <Label htmlFor="rate">{t("form.ratePercentage")} *</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min={0}
                max={100}
                {...register("rate", { valueAsNumber: true })}
                className={errors.rate ? "border-red-500" : ""}
                placeholder="15.00"
                disabled={disabled}
              />
              {errors.rate && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.rate.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="code">{t("form.taxCode")}</Label>
              <Input
                id="code"
                {...register("code")}
                className={errors.code ? "border-red-500" : ""}
                placeholder={t("form.taxCodePlaceholder")}
                disabled={disabled}
              />
              {errors.code && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  {errors.code.message}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="!mt-12 flex items-center space-x-2">
        <Checkbox
          id="active"
          checked={watch("active")}
          onCheckedChange={checked => setValue("active", checked as boolean)}
          disabled={disabled}
        />
        <Label htmlFor="active">{t("form.active")}</Label>
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

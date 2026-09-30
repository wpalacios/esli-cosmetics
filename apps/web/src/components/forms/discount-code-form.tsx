"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Button,
  Checkbox,
  Input,
  Label,
  SearchableSelect,
  type SearchableSelectOption,
} from "@esli-cosmetics/ui";
import { useToast } from "@/hooks/toast/use-toast";
import {
  DiscountCode,
  DiscountType,
  CreateDiscountCodeRequest,
  UpdateDiscountCodeRequest,
} from "@esli-cosmetics/types";
import {
  useCreateDiscountCode,
  useUpdateDiscountCode,
} from "@/hooks/use-discount-codes";
import { NumberInput } from "@/components/ui/number-input";

// Form validation schema factory
const getDiscountCodeSchema = (t: (key: string) => string) =>
  z.object({
    code: z.string().min(1, t("form.codeRequired")),
    name: z.string().optional().or(z.literal("")),
    discountType: z.enum(["PERCENTAGE", "FIXED"], {
      errorMap: () => ({ message: t("form.typeRequired") }),
    }),
    value: z
      .number({ invalid_type_error: t("form.valueRequired") })
      .min(0, t("form.valueInvalid")),
    minPurchase: z
      .union([z.number().min(0), z.nan(), z.null(), z.undefined()])
      .transform(val =>
        isNaN(val as number) || val === null || val === undefined
          ? undefined
          : val
      )
      .optional(),
    maxDiscount: z
      .union([z.number().min(0), z.nan(), z.null(), z.undefined()])
      .transform(val =>
        isNaN(val as number) || val === null || val === undefined
          ? undefined
          : val
      )
      .optional(),
    usageLimit: z
      .union([z.number().int().min(0), z.nan(), z.null(), z.undefined()])
      .transform(val =>
        isNaN(val as number) || val === null || val === undefined
          ? undefined
          : val
      )
      .optional(),
    startDate: z
      .string()
      .optional()
      .nullable()
      .transform(val => (val === "" || val === null ? null : val)),
    endDate: z
      .string()
      .optional()
      .nullable()
      .transform(val => (val === "" || val === null ? null : val)),
    isActive: z.boolean().default(true),
  });

type DiscountCodeFormData = {
  code: string;
  name?: string;
  discountType: "PERCENTAGE" | "FIXED";
  value: number;
  minPurchase?: number | undefined;
  maxDiscount?: number | undefined;
  usageLimit?: number | undefined;
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  isActive: boolean;
};

interface DiscountCodeFormProps {
  discountCode?: DiscountCode | null | undefined;
  onSuccess?: (action: "create" | "update", discountCode: DiscountCode) => void;
  onCancel?: () => void;
}

export function DiscountCodeForm({
  discountCode,
  onSuccess,
  onCancel,
}: DiscountCodeFormProps) {
  const { t } = useTranslation("discount-codes");
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createDiscountCodeMutation = useCreateDiscountCode();
  const updateDiscountCodeMutation = useUpdateDiscountCode();

  const isEditing = !!discountCode;

  // Discount type options
  const discountTypeOptions: SearchableSelectOption[] = [
    { value: "PERCENTAGE", label: t("form.percentage") },
    { value: "FIXED", label: t("form.fixed") },
  ];

  const {
    register,
    handleSubmit,
    reset,
    control,
    setError,
    formState: { errors },
  } = useForm<DiscountCodeFormData>({
    resolver: zodResolver(getDiscountCodeSchema(t)),
    defaultValues: {
      code: "",
      name: "",
      discountType: "PERCENTAGE" as const,
      value: 0,
      minPurchase: undefined,
      maxDiscount: undefined,
      usageLimit: undefined,
      startDate: null,
      endDate: null,
      isActive: true,
    },
  });

  // Helper function to convert ISO string to datetime-local format
  const toDatetimeLocal = (
    isoString: string | null | undefined
  ): string | null => {
    if (!isoString) return null;
    try {
      const match = isoString.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hours, minutes] = match;
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Reset form when discount code changes
  useEffect(() => {
    if (discountCode) {
      reset({
        code: discountCode.code,
        name: discountCode.name || "",
        discountType: discountCode.discountType,
        value: discountCode.value,
        minPurchase: discountCode.minPurchase || undefined,
        maxDiscount: discountCode.maxDiscount || undefined,
        usageLimit: discountCode.usageLimit || undefined,
        startDate: toDatetimeLocal(discountCode.startDate),
        endDate: toDatetimeLocal(discountCode.endDate),
        isActive: discountCode.isActive,
      });
    } else {
      reset({
        code: "",
        name: "",
        discountType: "PERCENTAGE",
        value: 0,
        minPurchase: undefined,
        maxDiscount: undefined,
        usageLimit: undefined,
        startDate: null,
        endDate: null,
        isActive: true,
      });
    }
  }, [discountCode, reset]);

  const onSubmit = async (data: DiscountCodeFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Helper to convert datetime-local to ISO string
      const toISOString = (
        datetimeLocal: string | null | undefined
      ): string | undefined => {
        if (!datetimeLocal) return undefined;
        return `${datetimeLocal}:00.000Z`;
      };

      // Clean up the data
      const cleanedData = {
        code: data.code,
        name: data.name ?? "",
        discountType: data.discountType,
        value: data.value,
        minPurchase:
          data.minPurchase !== undefined &&
          data.minPurchase !== null &&
          !isNaN(data.minPurchase as number)
            ? data.minPurchase
            : undefined,
        maxDiscount:
          data.maxDiscount !== undefined &&
          data.maxDiscount !== null &&
          !isNaN(data.maxDiscount as number)
            ? data.maxDiscount
            : undefined,
        usageLimit:
          data.usageLimit !== undefined &&
          data.usageLimit !== null &&
          !isNaN(data.usageLimit as number)
            ? data.usageLimit
            : 0,
        startDate: toISOString(data.startDate),
        endDate: toISOString(data.endDate),
        isActive: data.isActive,
      };


      let result: DiscountCode;

      if (isEditing && discountCode) {
        result = await updateDiscountCodeMutation.mutateAsync({
          id: discountCode.id,
          data: cleanedData as UpdateDiscountCodeRequest,
        });
      } else {
        result = await createDiscountCodeMutation.mutateAsync(
          cleanedData as CreateDiscountCodeRequest
        );
      }

      toast({
        title: t("toast.success"),
        description: isEditing ? t("toast.updated") : t("toast.created"),
        type: "success",
      });

      onSuccess?.(isEditing ? "update" : "create", result);
    } catch (error) {
      console.error("Discount code form submission error:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "CONFLICT")
      // Instead of parsing status codes, check: (error as any)?.code === "CONFLICT"
      // This allows for more specific error messages (e.g., "Code already exists" vs generic conflict)

      let errorMessage = t("toast.errorDesc");

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
              errorMessage = t("toast.badRequest");
              // Also set field-level error for code conflicts
              setError("code", {
                type: "manual",
                message: t("form.codeExists"),
              });
              break;
            case 401:
              errorMessage = t("toast.unauthorized");
              break;
            case 403:
              errorMessage = t("toast.forbidden");
              break;
            case 404:
              errorMessage = t("toast.notFound");
              break;
            case 409:
              errorMessage = t("toast.badRequest");
              setError("code", {
                type: "manual",
                message: t("form.codeExists"),
              });
              break;
            case 422:
              errorMessage = t("toast.validationError");
              break;
            case 500:
              errorMessage = t("toast.serverError");
              break;
            default:
              errorMessage = t("toast.errorDesc");
          }
        } else {
          // Fallback for non-API errors
          errorMessage = t("toast.errorDesc");
        }
      } else if (typeof error === "string") {
        errorMessage = error;
      }

      toast({
        title: t("toast.error"),
        description: errorMessage,
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onCancel?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Code */}
        <div className="space-y-2">
          <Label htmlFor="code">
            {t("form.code")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="code"
            {...register("code")}
            placeholder={t("form.codePlaceholder")}
            disabled={isSubmitting}
            maxLength={50}
          />
          {errors.code && (
            <p className="text-sm text-red-500">{errors.code.message}</p>
          )}
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">{t("form.name")}</Label>
          <Input
            id="name"
            {...register("name")}
            placeholder={t("form.namePlaceholder")}
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="text-sm text-red-500">{errors.name.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Discount Type */}
        <div className="space-y-2">
          <Label htmlFor="discountType">
            {t("form.type")} <span className="text-red-500">*</span>
          </Label>
          <Controller
            name="discountType"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                value={field.value}
                onValueChange={field.onChange}
                options={discountTypeOptions}
                placeholder={
                  t("form.typePlaceholder") || "Select discount type..."
                }
                disabled={isSubmitting}
                error={errors.discountType?.message}
                allowSearch={false}
              />
            )}
          />
          {errors.discountType && (
            <p className="text-sm text-red-500">
              {errors.discountType.message}
            </p>
          )}
        </div>

        {/* Value */}
        <div className="space-y-2">
          <Label htmlFor="value">
            {t("form.value")} <span className="text-red-500">*</span>
          </Label>
          <Controller
            name="value"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="value"
                value={field.value}
                onChange={field.onChange}
                placeholder={t("form.valuePlaceholder")}
                disabled={isSubmitting}
              />
            )}
          />
          {errors.value && (
            <p className="text-sm text-red-500">{errors.value.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Min Purchase */}
        <div className="space-y-2">
          <Label htmlFor="minPurchase">{t("form.minPurchase")}</Label>
          <Controller
            name="minPurchase"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="minPurchase"
                value={field.value ?? ""}
                onChange={value => {
                  // NumberInput converts empty string to 0, so convert 0 back to undefined for optional fields
                  field.onChange(value === 0 ? undefined : value);
                }}
                placeholder={t("form.minPurchasePlaceholder")}
                disabled={isSubmitting}
              />
            )}
          />
          {errors.minPurchase && (
            <p className="text-sm text-red-500">{errors.minPurchase.message}</p>
          )}
        </div>

        {/* Max Discount */}
        <div className="space-y-2">
          <Label htmlFor="maxDiscount">{t("form.maxDiscount")}</Label>
          <Controller
            name="maxDiscount"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="maxDiscount"
                value={field.value ?? ""}
                onChange={value => {
                  // NumberInput converts empty string to 0, so convert 0 back to undefined for optional fields
                  field.onChange(value === 0 ? undefined : value);
                }}
                placeholder={t("form.maxDiscountPlaceholder")}
                disabled={isSubmitting}
              />
            )}
          />
          {errors.maxDiscount && (
            <p className="text-sm text-red-500">{errors.maxDiscount.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Start Date */}
        <div className="space-y-2">
          <Label htmlFor="startDate">{t("form.startDate")}</Label>
          <Input
            id="startDate"
            type="datetime-local"
            {...register("startDate")}
            disabled={isSubmitting}
          />
          {errors.startDate && (
            <p className="text-sm text-red-500">{errors.startDate.message}</p>
          )}
        </div>

        {/* End Date */}
        <div className="space-y-2">
          <Label htmlFor="endDate">{t("form.endDate")}</Label>
          <Input
            id="endDate"
            type="datetime-local"
            {...register("endDate")}
            disabled={isSubmitting}
          />
          {errors.endDate && (
            <p className="text-sm text-red-500">{errors.endDate.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Usage Limit */}
        <div className="space-y-2">
          <Label htmlFor="usageLimit">{t("form.usageLimit")}</Label>
          <Controller
            name="usageLimit"
            control={control}
            render={({ field }) => (
              <NumberInput
                id="usageLimit"
                value={field.value ?? ""}
                onChange={value => {
                  // NumberInput converts empty string to 0, so convert 0 back to undefined for optional fields
                  field.onChange(value === 0 ? undefined : value);
                }}
                step="1"
                placeholder={t("form.usageLimitPlaceholder")}
                disabled={isSubmitting}
              />
            )}
          />
          {errors.usageLimit && (
            <p className="text-sm text-red-500">{errors.usageLimit.message}</p>
          )}
        </div>

        {/* Active */}
        <div className="!mt-12 flex items-center space-x-2">
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="isActive"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isSubmitting}
              />
            )}
          />
          <Label htmlFor="isActive" className="cursor-pointer">
            {t("form.active")}
          </Label>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          {t("modal.cancel")}
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? t("modal.saving") : t("modal.save")}
        </Button>
      </div>
    </form>
  );
}

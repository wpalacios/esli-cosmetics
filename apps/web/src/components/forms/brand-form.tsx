"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input, Label } from "@esli-cosmetics/ui";
import {
  BrandWithRelations,
  CreateBrandRequest,
  UpdateBrandRequest,
} from "@esli-cosmetics/types";
import {
  useCreateBrand,
  useUpdateBrand,
  useCheckBrandName,
} from "~/hooks/use-brands";
import { getErrorStatus } from "@/lib/errors/api-error";

export const brandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  description: z.string().optional(),
  websiteUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .or(z.literal("")),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  country: z.string().optional(),
});

type BrandFormData = z.infer<typeof brandSchema>;

interface BrandFormProps {
  brand?: BrandWithRelations | undefined;
  onSuccess?: (action: "create" | "update", brandName: string) => void;
  onCancel?: () => void;
}

export function BrandForm({ brand, onSuccess, onCancel }: BrandFormProps) {
  const { t } = useTranslation("brands");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createBrandMutation = useCreateBrand();
  const updateBrandMutation = useUpdateBrand();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    setError,
  } = useForm<BrandFormData>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: brand?.name || "",
      description: brand?.description || "",
      websiteUrl: brand?.websiteUrl || "",
      logoUrl: brand?.logoUrl || "",
      country: brand?.country || "",
    },
  });

  const watchedName = watch("name");

  // Check for duplicate brand names using API
  const { data: nameExists, isLoading: isCheckingName } = useCheckBrandName(
    watchedName || "",
    brand?.id
  );

  const duplicateError = nameExists ? t("form.duplicateNameError") : "";

  useEffect(() => {
    if (brand) {
      reset({
        name: brand.name || "",
        description: brand.description || "",
        websiteUrl: brand.websiteUrl || "",
        logoUrl: brand.logoUrl || "",
        country: brand.country || "",
      });
    }
  }, [brand, reset]);

  const onSubmit = async (data: BrandFormData) => {
    setIsSubmitting(true);

    try {
      const cleanedData: any = {
        name: data.name.trim(),
      };

      if (data.description && data.description.trim() !== "") {
        cleanedData.description = data.description.trim();
      }

      if (data.websiteUrl && data.websiteUrl.trim() !== "") {
        cleanedData.websiteUrl = data.websiteUrl.trim();
      }

      if (data.logoUrl && data.logoUrl.trim() !== "") {
        cleanedData.logoUrl = data.logoUrl.trim();
      }

      if (data.country && data.country.trim() !== "") {
        cleanedData.country = data.country.trim();
      }

      const brandName = cleanedData.name;

      if (brand) {
        // Update existing brand
        await updateBrandMutation.mutateAsync({
          id: brand.id,
          data: cleanedData as UpdateBrandRequest,
        });
        onSuccess?.("update", brandName);
      } else {
        // Create new brand
        await createBrandMutation.mutateAsync(
          cleanedData as CreateBrandRequest
        );
        onSuccess?.("create", brandName);
      }
    } catch (error) {
      console.error("Error submitting brand:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "CONFLICT", "VALIDATION_ERROR")
      // Instead of parsing status codes, check: (error as any)?.code === "CONFLICT"
      // This allows for more specific error messages (e.g., "BRAND_NAME_EXISTS" vs generic conflict)

      // Handle 409 Conflict errors (duplicate name)
      const statusCode = getErrorStatus(error);
      if (statusCode === 409) {
        setError("name", {
          type: "server",
          message:
            t("form.duplicateNameError") ||
            "A brand with this name already exists.",
        });
        return; // Don't re-throw, let user fix the error
      }

      // For other errors, set a root error
      if (statusCode) {
        setError("root", {
          type: "server",
          message:
            statusCode === 400
              ? t("form.badRequest") ||
                "Invalid request. Please check your input."
              : statusCode === 404
                ? t("form.notFound") || "Brand not found."
                : statusCode === 422
                  ? t("form.validationError") ||
                    "Validation error. Please check your input."
                  : t("form.genericError") ||
                    "An error occurred. Please try again.",
        });
        return; // Don't re-throw, show error in form
      }

      // For unknown errors, re-throw to be handled by the modal
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Brand Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            {t("form.name")} *
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder={t("form.namePlaceholder")}
            className={errors.name || duplicateError ? "border-red-500" : ""}
          />
          {errors.name && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.name.message}
            </p>
          )}
          {!errors.name && duplicateError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {duplicateError}
            </p>
          )}
        </div>

        {/* Website URL */}
        <div className="space-y-2">
          <Label htmlFor="websiteUrl" className="text-sm font-medium">
            {t("form.websiteUrl")}
          </Label>
          <Input
            id="websiteUrl"
            type="url"
            {...register("websiteUrl")}
            placeholder={t("form.websiteUrlPlaceholder")}
            className={errors.websiteUrl ? "border-red-500" : ""}
          />
          {errors.websiteUrl && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.websiteUrl.message}
            </p>
          )}
        </div>

        {/* Logo URL */}
        <div className="space-y-2">
          <Label htmlFor="logoUrl" className="text-sm font-medium">
            {t("form.logoUrl")}
          </Label>
          <Input
            id="logoUrl"
            type="url"
            {...register("logoUrl")}
            placeholder={t("form.logoUrlPlaceholder")}
            className={errors.logoUrl ? "border-red-500" : ""}
          />
          {errors.logoUrl && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.logoUrl.message}
            </p>
          )}
        </div>

        {/* Country */}
        <div className="space-y-2">
          <Label htmlFor="country" className="text-sm font-medium">
            {t("form.country")}
          </Label>
          <Input
            id="country"
            {...register("country")}
            placeholder={t("form.countryPlaceholder")}
            className={errors.country ? "border-red-500" : ""}
          />
          {errors.country && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.country.message}
            </p>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-sm font-medium">
          {t("form.description")}
        </Label>
        <textarea
          id="description"
          {...register("description")}
          placeholder={t("form.descriptionPlaceholder")}
          rows={4}
          className={`w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm transition-colors placeholder:text-neutral-400 focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-400 ${
            errors.description ? "border-red-500" : ""
          }`}
        />
        {errors.description && (
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.description.message}
          </p>
        )}
      </div>

      {/* Root Error Display */}
      {errors.root && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.root.message}
          </p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t("form.cancel")}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || !!duplicateError}
          loading={isSubmitting}
        >
          {isSubmitting
            ? t("form.saving")
            : brand
              ? t("form.update")
              : t("form.create")}
        </Button>
      </div>
    </form>
  );
}

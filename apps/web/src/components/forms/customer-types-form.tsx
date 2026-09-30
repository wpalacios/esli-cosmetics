"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Button, Input, Label, Checkbox } from "@esli-cosmetics/ui";
import { CreateCustomerTypeRequest, CustomerType } from "@esli-cosmetics/types";
import {
  useCreateCustomerType,
  useUpdateCustomerType,
} from "@/hooks/use-customer-types";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/toast/use-toast";

interface CustomerTypeFormProps {
  initialData?: CustomerType | undefined;
  onSuccess?: (action: "create" | "update", customerTypeName: string) => void;
  onCancel?: () => void;
}

const createCustomerTypeSchema = (t: (key: string, options?: any) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t("form.nameRequired"))
      .min(2, t("form.nameMinLength"))
      .max(255, t("form.nameMaxLength")),
    description: z
      .string()
      .max(255, t("form.descriptionMaxLength"))
      .optional()
      .or(z.literal("")),
    isActive: z.boolean().optional(),
  });

type CustomerTypeFormData = z.infer<
  ReturnType<typeof createCustomerTypeSchema>
>;

export function CustomerTypeForm({
  initialData,
  onSuccess,
  onCancel,
}: CustomerTypeFormProps) {
  const { t } = useTranslation("customer-types");
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = createCustomerTypeSchema(t);
  const isEditing = !!initialData;

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    reset,
    control,
    setError,
  } = useForm<CustomerTypeFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      isActive: initialData?.isActive ?? true,
    },
  });

  const createCustomerTypeMutation = useCreateCustomerType();
  const updateCustomerTypeMutation = useUpdateCustomerType();

  // Using Controller for Checkbox binding

  useEffect(() => {
    if (initialData) {
      reset({
        name: initialData.name,
        description: initialData.description || "",
        isActive: initialData.isActive ?? true,
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: CustomerTypeFormData) => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const name = data.name.trim();
      const descriptionTrimmed = data.description?.trim();
      const isActiveValue = data.isActive ?? true;

      const formData: CreateCustomerTypeRequest = {
        name,
        ...(descriptionTrimmed ? { description: descriptionTrimmed } : {}),
        ...(typeof isActiveValue === "boolean"
          ? { isActive: isActiveValue }
          : {}),
      };

      if (isEditing && initialData) {
        await updateCustomerTypeMutation.mutateAsync({
          id: initialData.id,
          data: formData,
        });
        onSuccess?.("update", formData.name);
      } else {
        await createCustomerTypeMutation.mutateAsync(formData);
        onSuccess?.("create", formData.name);
      }

      reset();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const isDuplicate =
        errorMessage.includes("already exists") ||
        errorMessage.toLowerCase().includes("unique constraint") ||
        errorMessage.includes("Conflict");

      if (isDuplicate) {
        setError("name", {
          type: "manual",
          message:
            t("form.nameExists") ||
            "Ya existe un tipo de cliente con ese nombre",
        });
      } else {
        toast({
          title: t("form.error") || "Error",
          description: errorMessage,
          type: "error",
        });
      }
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
      <div className="space-y-4">
        <div>
          <Label
            htmlFor="name"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("form.name")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder={t("form.namePlaceholder")}
            className="mt-1"
            disabled={isSubmitting}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <Label
            htmlFor="description"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("form.description")}
          </Label>
          <Input
            id="description"
            {...register("description")}
            placeholder={t("form.descriptionPlaceholder")}
            className="mt-1"
            disabled={isSubmitting}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">
              {errors.description.message}
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
                disabled={isSubmitting}
              />
            )}
          />
          <Label
            htmlFor="isActive"
            className="text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {t("form.isActive")}
          </Label>
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleCancel}
          disabled={isSubmitting}
        >
          {t("form.cancel")}
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700"
        >
          {isSubmitting
            ? t("form.saving")
            : isEditing
              ? t("form.update")
              : t("form.create")}
        </Button>
      </div>
    </form>
  );
}

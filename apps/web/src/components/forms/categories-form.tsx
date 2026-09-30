"use client";

import {
  CategoryWithRelations,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@esli-cosmetics/types";
import {
  Button,
  Checkbox,
  Input,
  Label,
  SearchableSelect,
  SearchableSelectOption,
} from "@esli-cosmetics/ui";
import { zodResolver } from "@/lib/zod-resolver";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  useCheckCategoryName,
  useCreateCategory,
  useSearchCategoriesByName,
  useUpdateCategory,
} from "~/hooks/use-categories";

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  slug: z.string().optional(),
  description: z.string().optional(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  category?: CategoryWithRelations | undefined;
  onSuccess?: (action: "create" | "update", categoryName: string) => void;
  onCancel?: () => void;
}

export function CategoryForm({
  category,
  onSuccess,
  onCancel,
}: CategoryFormProps) {
  const { t } = useTranslation("categories");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState("");
  const [activeCategorySearchTerm, setActiveCategorySearchTerm] = useState("");

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();

  // Fetch categories with or without search
  const { data: categoriesData, isLoading: isLoadingCategories } =
    useSearchCategoriesByName(activeCategorySearchTerm, 1, 50);

  // Handle search - trigger on Enter key
  const handleCategorySearchChange = (newSearchTerm: string) => {
    setCategorySearchTerm(newSearchTerm);
  };

  const handleCategorySearchTrigger = () => {
    setActiveCategorySearchTerm(categorySearchTerm);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
    control,
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name || "",
      slug: category?.slug || "",
      description: category?.description || "",
      parentId: category?.parent?.id || null,
      isActive: category?.isActive ?? true,
    },
  });

  const isActive = watch("isActive");
  const categoryName = watch("name");

  // Check for duplicate category names using API
  const { data: nameExists, isLoading: isCheckingName } = useCheckCategoryName(
    categoryName || "",
    category?.id
  );

  const duplicateError = nameExists ? t("form.duplicateNameError") : "";

  // Convert categories to select options (exclude current category to prevent circular reference)
  const parentCategoryOptions: SearchableSelectOption<CategoryWithRelations>[] =
    useMemo(() => {
      const categories = categoriesData?.data || [];
      const filteredCategories = categories.filter(
        cat => cat.id !== category?.id
      );

      // Ensure the current parent is always in the list when editing
      if (category?.parent) {
        const parentExists = filteredCategories.some(
          cat => cat.id === category.parent?.id
        );
        if (!parentExists) {
          // Add the parent to the beginning of the list
          filteredCategories.unshift(category.parent);
        }
      }

      return filteredCategories.map(cat => ({
        value: cat.id,
        label: cat.name,
        data: cat,
      }));
    }, [categoriesData, category?.id, category?.parent]);

  useEffect(() => {
    if (category) {
      reset({
        name: category.name || "",
        slug: category.slug || "",
        description: category.description || "",
        parentId: category.parent?.id || null,
        isActive: category.isActive ?? true,
      });
    } else {
      reset({
        name: "",
        slug: "",
        description: "",
        parentId: null,
        isActive: true,
      });
    }
  }, [category, reset]);

  const onSubmit = async (data: CategoryFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const cleanedData: CreateCategoryRequest = {
        name: data.name.trim(),
        isActive: data.isActive ?? true,
      };

      if (data.description && data.description.trim() !== "") {
        cleanedData.description = data.description.trim();
      }

      if (data.parentId && data.parentId !== category?.id) {
        cleanedData.parentId = data.parentId;
      }

      const categoryName = cleanedData.name;

      if (category) {
        await updateCategoryMutation.mutateAsync({
          id: category.id,
          data: cleanedData as UpdateCategoryRequest,
        });
        onSuccess?.("update", categoryName);
      } else {
        await createCategoryMutation.mutateAsync(cleanedData);
        onSuccess?.("create", categoryName);
      }

      reset();
    } catch (error) {
      console.error("❌ Failed to save category:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "CONFLICT")
      // Instead of parsing status codes, check: (error as any)?.code === "CONFLICT"
      // This allows for more specific error messages per error type
      // Add proper error handling with toast notifications
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Category Information */}
      <div className="space-y-6">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t("form.categoryInfo")}
        </h3>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            {t("form.name")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            className={`h-12 ${errors.name || duplicateError ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
            placeholder={t("form.name")}
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

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            {t("form.description")}
          </Label>
          <Input
            id="description"
            placeholder={t("form.descriptionPlaceholder")}
            {...register("description")}
            className="h-12"
          />
        </div>

        {/* Parent Category (select) */}
        <div className="space-y-2">
          <Label htmlFor="parentId" className="text-sm font-medium">
            {t("form.parentCategory")}
          </Label>
          <Controller
            name="parentId"
            control={control}
            render={({ field }) => (
              <SearchableSelect<CategoryWithRelations>
                options={parentCategoryOptions}
                {...(field.value ? { value: field.value } : {})}
                onValueChange={value => {
                  field.onChange(value || null);
                }}
                placeholder={t("form.parentCategoryNone")}
                searchPlaceholder={t("form.searchCategories")}
                emptyMessage={t("form.noCategoriesFound")}
                onSearchChange={handleCategorySearchChange}
                onSearchTrigger={handleCategorySearchTrigger}
                isLoading={isLoadingCategories}
                loadingMessage={t("form.loadingCategories")}
              />
            )}
          />
        </div>

        {/* Active Status Toggle */}
        <div className="flex items-center space-x-3">
          <Controller
            name="isActive"
            control={control}
            render={({ field }) => (
              <Checkbox
                id="isActive"
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
          <Label
            htmlFor="isActive"
            className="cursor-pointer text-sm font-medium"
          >
            {t("form.isActive")}
          </Label>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isActive ? t("form.activeStatus") : t("form.inactiveStatus")}
          </span>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-3 border-t border-gray-200 pt-6 dark:border-gray-700">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="h-11 px-6"
          >
            {t("form.cancel")}
          </Button>
        )}
        <Button
          type="submit"
          disabled={isSubmitting || !!duplicateError}
          variant="secondary"
          className="h-11 px-6"
        >
          {isSubmitting
            ? t("form.saving")
            : category
              ? t("form.updateCategory")
              : t("form.createCategory")}
        </Button>
      </div>
    </form>
  );
}

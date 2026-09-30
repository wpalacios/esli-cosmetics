"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Permission,
  CreatePermissionRequest,
  UpdatePermissionRequest,
} from "@esli-cosmetics/types";
import { Button, Input, Label } from "@esli-cosmetics/ui";

const getPermissionSchema = (t: (key: string) => string) =>
  z.object({
    key: z.string().min(1, t("form.keyRequired")),
    name: z.string().min(1, t("form.nameRequired")),
    description: z.string().optional(),
  });

type PermissionFormData = z.infer<ReturnType<typeof getPermissionSchema>>;

interface PermissionFormProps {
  permission?: Permission | null;
  onSave: (
    data: CreatePermissionRequest | UpdatePermissionRequest,
    id?: string
  ) => Promise<void>;
  isLoading?: boolean;
  onCancel: () => void;
  showKeyField?: boolean;
}

export function PermissionForm({
  permission,
  onSave,
  isLoading = false,
  onCancel,
  showKeyField = false,
}: PermissionFormProps) {
  const { t } = useTranslation("permissions");
  const isEditMode = !!permission;
  const isSubmitting = isLoading;
  const isFormDisabled = isSubmitting;

  const permissionSchema = getPermissionSchema(t);

  const {
    handleSubmit,
    formState: { errors },
    reset,
    register,
    setError,
  } = useForm<PermissionFormData>({
    resolver: zodResolver(permissionSchema),
    defaultValues: {
      key: "",
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (permission) {
      reset({
        key: permission.key || "",
        name: permission.name || "",
        description: permission.description || "",
      });
    } else {
      reset();
    }
  }, [permission, reset]);

  const onSubmit = async (data: PermissionFormData) => {
    try {
      const cleanOptional = (val: unknown): string | undefined => {
        if (val === null || val === undefined) return undefined;
        if (typeof val === "string" && val.trim() === "") return undefined;
        return val as string | undefined;
      };

      const permissionPayload = {
        key: data.key,
        name: data.name,
        ...(cleanOptional(data.description) && {
          description: data.description,
        }),
      };

      if (isEditMode) {
        // For updates, include key only if showKeyField is true (admin can update key)
        if (showKeyField) {
          await onSave(
            permissionPayload as UpdatePermissionRequest,
            permission!.id
          );
        } else {
          const { key, ...updateData } = permissionPayload;
          await onSave(updateData as UpdatePermissionRequest, permission!.id);
        }
      } else {
        await onSave(permissionPayload as CreatePermissionRequest);
      }
    } catch (error: unknown) {
      console.error("Permission form submission error:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "CONFLICT")
      // Instead of parsing status codes, check: (error as any)?.code === "VALIDATION_ERROR"
      // This allows for more specific error messages per error type

      let errorString = "";
      if (error && typeof error === "object" && "message" in error) {
        errorString = String(error.message);
      } else if (typeof error === "string") {
        errorString = error;
      } else {
        setError("root", {
          type: "server",
          message: t("form.genericError"),
        });
        return;
      }

      const statusMatch = errorString.match(/API Error: (\d+)/);
      const statusCode =
        statusMatch && statusMatch[1] ? parseInt(statusMatch[1]) : null;

      if (statusCode) {
        switch (statusCode) {
          case 400:
            setError("root", {
              type: "server",
              message: t("form.genericConflict"),
            });
            break;
          case 401:
            setError("root", {
              type: "server",
              message: t("form.unauthorized"),
            });
            break;
          case 403:
            setError("root", {
              type: "server",
              message: t("form.forbidden"),
            });
            break;
          case 404:
            setError("root", {
              type: "server",
              message: t("form.notFound"),
            });
            break;
          case 409:
            setError("root", {
              type: "server",
              message: t("form.genericConflict"),
            });
            break;
          case 422:
            setError("root", {
              type: "server",
              message: t("form.validationError"),
            });
            break;
          case 500:
            setError("root", {
              type: "server",
              message: t("form.serverError"),
            });
            break;
          default:
            setError("root", {
              type: "server",
              message: t("form.genericError"),
            });
        }
      } else {
        setError("root", {
          type: "server",
          message: t("form.genericError"),
        });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {errors.root && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.root.message}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {showKeyField && (
          <div className="space-y-2">
            <Label htmlFor="key" className="text-sm font-medium">
              {t("form.key")} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="key"
              {...register("key")}
              placeholder={t("form.keyPlaceholder")}
              disabled={isFormDisabled}
              className={`h-12 ${errors.key ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
            />
            {errors.key?.message && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.key.message}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="name" className="text-sm font-medium">
            {t("form.name")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            {...register("name")}
            placeholder={t("form.namePlaceholder")}
            disabled={isFormDisabled}
            className={`h-12 ${errors.name ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
          />
          {errors.name?.message && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium">
            {t("form.description")}
          </Label>
          <Input
            id="description"
            {...register("description")}
            placeholder={t("form.descriptionPlaceholder")}
            disabled={isFormDisabled}
            className="h-12"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-6">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isFormDisabled}
            className="h-11 px-6"
          >
            {t("form.cancel")}
          </Button>
        )}

        <Button
          type="submit"
          disabled={isFormDisabled}
          variant="secondary"
          className="h-11 px-6"
        >
          {isSubmitting
            ? t("form.saving")
            : isEditMode
              ? t("form.update")
              : t("form.create")}
        </Button>
      </div>
    </form>
  );
}

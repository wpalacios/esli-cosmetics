"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  RoleWithPermissions,
  CreateRoleRequest,
  UpdateRoleRequest,
  Permission,
} from "@esli-cosmetics/types";
import {
  Button,
  Input,
  Label,
  SearchableMultiSelect,
} from "@esli-cosmetics/ui";
import type { SearchableMultiSelectOption } from "@esli-cosmetics/ui";
import { assignPermissions } from "@/actions/roles";
import { usePermissions } from "@/hooks/use-permissions";

// Role type with permissions (from roles module, not auth module)
type RoleWithPermissionsLocal = RoleWithPermissions & {
  permissions?: Array<{ key: string; name: string | null }>;
};

const getRoleSchema = (t: (key: string) => string) =>
  z.object({
    key: z.string().min(1, t("form.keyRequired")),
    name: z.string().min(1, t("form.nameRequired")),
    description: z.string().optional(),
  });

type RoleFormData = z.infer<ReturnType<typeof getRoleSchema>>;

interface RoleFormProps {
  role?: RoleWithPermissionsLocal | null;
  onSave: (
    data: CreateRoleRequest | UpdateRoleRequest,
    id?: string
  ) => Promise<RoleWithPermissionsLocal | void>;
  isLoading?: boolean;
  onCancel: () => void;
  onPermissionsAssigned?: () => void;
}

export function RoleForm({
  role,
  onSave,
  isLoading = false,
  onCancel,
  onPermissionsAssigned,
}: RoleFormProps) {
  const { t } = useTranslation("roles");
  const isEditMode = !!role;
  const isSubmitting = isLoading;
  const isFormDisabled = isSubmitting;
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Fetch all permissions for selection
  const { data: permissionsData, isLoading: isLoadingPermissions } =
    usePermissions({
      page: 1,
      limit: 1000, // Get more permissions for selection
    });

  const permissions = permissionsData?.data || [];

  // Transform permissions into SearchableMultiSelect options
  const permissionOptions: SearchableMultiSelectOption<Permission>[] =
    useMemo(() => {
      return permissions.map(permission => ({
        value: permission.key,
        label: permission.name || permission.key,
        data: permission,
      }));
    }, [permissions]);

  const roleSchema = getRoleSchema(t);

  const {
    handleSubmit,
    formState: { errors },
    reset,
    register,
    setError,
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      key: "",
      name: "",
      description: "",
    },
  });

  useEffect(() => {
    if (role) {
      reset({
        key: role.key || "",
        name: role.name || "",
        description: role.description || "",
      });
      // Set permissions from role if available (extract keys from permission objects)
      setSelectedPermissions(
        role.permissions?.map(p => (typeof p === "string" ? p : p.key)) || []
      );
    } else {
      reset();
      setSelectedPermissions([]);
    }
  }, [role, reset]);

  const onSubmit = async (data: RoleFormData) => {
    try {
      const cleanOptional = (val: unknown): string | undefined => {
        if (val === null || val === undefined) return undefined;
        if (typeof val === "string" && val.trim() === "") return undefined;
        return val as string | undefined;
      };

      const rolePayload = {
        key: data.key,
        name: data.name,
        ...(cleanOptional(data.description) && {
          description: data.description,
        }),
      };

      let roleId: string;
      let savedRole: RoleWithPermissionsLocal | void;

      if (isEditMode) {
        // For updates, don't include key (it's immutable)
        const { key, ...updateData } = rolePayload;
        savedRole = await onSave(updateData as UpdateRoleRequest, role!.id);
        roleId = role!.id;
      } else {
        // For creates, get the role ID from the response
        savedRole = await onSave(rolePayload as CreateRoleRequest);
        if (savedRole && typeof savedRole === "object" && "id" in savedRole) {
          roleId = savedRole.id;
        } else {
          // If onSave doesn't return the role, we can't assign permissions
          // This shouldn't happen, but handle gracefully
          console.warn("Role creation succeeded but no role ID returned");
          if (onPermissionsAssigned) {
            onPermissionsAssigned();
          }
          return;
        }
      }

      // Assign permissions after role is created/updated
      if (selectedPermissions.length > 0) {
        try {
          await assignPermissions(roleId, selectedPermissions);
          if (onPermissionsAssigned) {
            onPermissionsAssigned();
          }
        } catch (error) {
          console.error("Failed to assign permissions:", error);
          // Don't throw - permissions assignment failure shouldn't block form submission
          // But we could show a warning
        }
      } else if (
        isEditMode &&
        role?.permissions &&
        role.permissions.length > 0 &&
        selectedPermissions.length === 0
      ) {
        // If editing and removing all permissions, still call assignPermissions with empty array
        try {
          await assignPermissions(roleId, []);
          if (onPermissionsAssigned) {
            onPermissionsAssigned();
          }
        } catch (error) {
          console.error("Failed to clear permissions:", error);
        }
      } else if (onPermissionsAssigned) {
        onPermissionsAssigned();
      }
    } catch (error: unknown) {
      console.error("Role form submission error:", error);

      // TODO: Use error.code for better error handling
      // Backend now provides error codes (e.g., "VALIDATION_ERROR", "CONFLICT")
      // Instead of parsing status codes, check: (error as any)?.code === "CONFLICT"
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
        <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            {errors.root.message}
          </p>
        </div>
      )}

      <div className="space-y-6">
        <div className="hidden space-y-2">
          <Label htmlFor="key" className="text-sm font-medium">
            {t("form.key")} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="key"
            {...register("key")}
            placeholder={t("form.keyPlaceholder")}
            disabled={isFormDisabled || isEditMode}
            className={`h-12 ${errors.key ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""}`}
          />
          {errors.key?.message && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.key.message}
            </p>
          )}
          {isEditMode && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("form.keyImmutable")}
            </p>
          )}
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="permissions" className="text-sm font-medium">
            {t("form.permissions")}
          </Label>
          <SearchableMultiSelect
            options={permissionOptions}
            value={selectedPermissions}
            onValueChange={setSelectedPermissions}
            placeholder={t("permissions.placeholder")}
            disabled={isFormDisabled}
            isLoading={isLoadingPermissions}
            loadingMessage={t("permissions.loading")}
            emptyMessage={t("permissions.noData")}
            searchPlaceholder={t("permissions.searchPlaceholder")}
            filterOptions={(options, searchTerm) => {
              if (!searchTerm) return options;
              const search = searchTerm.toLowerCase();
              return options.filter(option => {
                const permission = option.data as Permission | undefined;
                if (!permission) return false;
                const key = permission.key?.toLowerCase() || "";
                const name = permission.name?.toLowerCase() || "";
                const description = permission.description?.toLowerCase() || "";
                return (
                  key.includes(search) ||
                  name.includes(search) ||
                  description.includes(search)
                );
              });
            }}
            renderOption={option => {
              const permission = option.data as Permission | undefined;
              if (!permission) return option.label;
              return (
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {permission.name || permission.key}
                    </span>
                  </div>
                  {permission.description && (
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {permission.description}
                    </div>
                  )}
                </div>
              );
            }}
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

"use client";

import { useMemo } from "react";
import { SearchableMultiSelect } from "@esli-cosmetics/ui";
import type { SearchableMultiSelectOption } from "@esli-cosmetics/ui";
import { Permission } from "@esli-cosmetics/types";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "react-i18next";

interface PermissionsMultiSelectProps {
  value?: string[]; // Permission keys (e.g., "products.read", "users.create")
  onChange: (permissionKeys: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
}

export function PermissionsMultiSelect({
  value = [],
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
}: PermissionsMultiSelectProps) {
  const { t } = useTranslation("roles");

  // Fetch all permissions for selection
  const { data: permissionsData, isLoading } = usePermissions({
    page: 1,
    limit: 200, // Get more permissions for selection
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

  return (
    <SearchableMultiSelect
      options={permissionOptions}
      value={value}
      onValueChange={onChange}
      placeholder={placeholder || t("permissions.placeholder")}
      disabled={disabled}
      {...(className && { className })}
      error={error}
      isLoading={isLoading}
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
  );
}

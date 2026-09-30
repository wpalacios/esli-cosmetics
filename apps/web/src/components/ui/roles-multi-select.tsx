"use client";

import { useMemo } from "react";
import {
  SearchableMultiSelect,
  type SearchableMultiSelectOption,
} from "@esli-cosmetics/ui";
import { RoleWithPermissions } from "@esli-cosmetics/types";
import { useRoles } from "@/hooks/use-roles";
import { cn } from "@esli-cosmetics/utils";
import { useTranslation } from "react-i18next";
import { AiOutlineClose } from "react-icons/ai";

interface RolesMultiSelectProps {
  value?: string[]; // Role keys (e.g., "admin", "sales_rep")
  onChange: (roleKeys: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
}

export function RolesMultiSelect({
  value = [],
  onChange,
  placeholder,
  disabled = false,
  className,
  error,
}: RolesMultiSelectProps) {
  const { t } = useTranslation("users");

  // Fetch all roles for selection
  const { data: rolesData, isLoading } = useRoles({
    page: 1,
    limit: 100, // Get more roles for selection
  });

  const roles = rolesData?.data || [];

  // Convert roles to SearchableMultiSelect options
  // Use role.key as the value since that's what the component expects
  const options = useMemo<
    SearchableMultiSelectOption<RoleWithPermissions>[]
  >(() => {
    return roles.map(role => ({
      value: role.key,
      label: role.name || "",
      data: role,
    }));
  }, [roles]);

  // Custom filter function for roles
  const filterOptions = (
    opts: SearchableMultiSelectOption<RoleWithPermissions>[],
    searchTerm: string
  ) => {
    if (!searchTerm) return opts;

    const search = searchTerm.toLowerCase();
    return opts.filter(option => {
      const role = option.data;
      if (!role) return false;

      const key = role.key?.toLowerCase() || "";
      const name = role.name?.toLowerCase() || "";
      const description = role.description?.toLowerCase() || "";

      return (
        key.includes(search) ||
        name.includes(search) ||
        description.includes(search)
      );
    });
  };

  // Custom render for selected badges
  const renderSelectedBadge = (
    option: SearchableMultiSelectOption<RoleWithPermissions>,
    onRemove: () => void
  ) => {
    const role = option.data;
    if (!role) return null;

    return (
      <div className="flex items-center gap-1 rounded-md bg-pink-100 px-2 py-1 text-base text-pink-800 dark:bg-pink-900 dark:text-pink-200">
        <span className="font-medium">{role.name}</span>
        <span
          role="button"
          tabIndex={0}
          aria-label={`Remove ${role.name}`}
          onClick={e => {
            e.stopPropagation();
            onRemove();
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }
          }}
          className={cn(
            "inline-flex cursor-pointer items-center justify-center rounded-sm hover:text-pink-600",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          <AiOutlineClose className="h-3 w-3" />
        </span>
      </div>
    );
  };

  // Custom render for options in dropdown
  const renderOption = (
    option: SearchableMultiSelectOption<RoleWithPermissions>
  ) => {
    const role = option.data;
    if (!role) return option.label;

    return (
      <div className="flex flex-col">
        <span className="font-medium">{role.name}</span>
        {role.description && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {role.description}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={cn("relative", className)}>
      <SearchableMultiSelect<RoleWithPermissions>
        options={options}
        value={value}
        onValueChange={onChange}
        placeholder={placeholder || t("multiSelect.placeholder")}
        disabled={disabled}
        {...(error && { error })}
        searchPlaceholder={t("multiSelect.searchPlaceholder")}
        emptyMessage={
          options.length === 0
            ? t("multiSelect.noData")
            : t("multiSelect.noResults")
        }
        isLoading={isLoading}
        loadingMessage={t("multiSelect.loading")}
        filterOptions={filterOptions}
        renderOption={renderOption}
        renderSelectedBadge={renderSelectedBadge}
      />
    </div>
  );
}

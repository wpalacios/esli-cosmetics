"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@esli-cosmetics/ui";
import { BranchWithRelations } from "@esli-cosmetics/types";
import { useBranches } from "@/hooks/use-branches";
import { cn } from "@esli-cosmetics/utils";

interface BranchSelectProps {
  value?: string | undefined;
  onChange: (branchId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  searchPlaceholder?: string;
  loadingMessage?: string;
  emptyMessage?: string;
}

export function BranchSelect({
  value,
  onChange,
  placeholder = "Seleccionar sucursal...",
  disabled = false,
  className,
  error,
  searchPlaceholder,
  loadingMessage,
  emptyMessage,
}: BranchSelectProps) {
  const { t } = useTranslation("common");

  // Fetch all branches for selection
  const {
    data: branchesData,
    isLoading,
    error: queryError,
    isError,
  } = useBranches({
    page: 1,
    limit: 100,
  });

  const branches = useMemo(() => {
    if (!branchesData) return [];
    if (
      branchesData &&
      typeof branchesData === "object" &&
      "data" in branchesData
    ) {
      return Array.isArray(branchesData.data) ? branchesData.data : [];
    }
    if (Array.isArray(branchesData)) {
      return branchesData;
    }
    return [];
  }, [branchesData]);

  const options = useMemo<SearchableSelectOption<BranchWithRelations>[]>(() => {
    return branches.map(branch => ({
      value: branch.id,
      label: branch.name || "",
      data: branch,
    }));
  }, [branches]);

  const filterOptions = (
    opts: SearchableSelectOption<BranchWithRelations>[],
    searchTerm: string
  ) => {
    if (!searchTerm) return opts;
    const search = searchTerm.toLowerCase();
    return opts.filter(option => {
      const branch = option.data;
      if (!branch) return false;
      const name = branch.name?.toLowerCase() || "";
      const code = branch.code?.toLowerCase() || "";
      const address = branch.address?.toLowerCase() || "";
      return (
        name.includes(search) ||
        code.includes(search) ||
        address.includes(search)
      );
    });
  };

  const renderOption = (
    option: SearchableSelectOption<BranchWithRelations>
  ) => {
    const branch = option.data;
    if (!branch) return option.label;
    return (
      <div className="flex flex-col">
        <span className="font-medium">{branch.name}</span>
        {branch.code && (
          <span className="text-xs text-gray-500">{branch.code}</span>
        )}
        {branch.address && (
          <span className="max-w-xs truncate text-xs text-gray-400">
            {branch.address}
          </span>
        )}
      </div>
    );
  };

  const handleValueChange = (newValue: string) => {
    onChange(newValue === "" ? undefined : newValue);
  };

  const selectValue = value || "";
  const displayError =
    error || (isError && queryError ? String(queryError) : undefined);

  return (
    <div className={cn("relative", className)}>
      <SearchableSelect<BranchWithRelations>
        options={options}
        value={selectValue}
        onValueChange={handleValueChange}
        placeholder={placeholder}
        disabled={disabled}
        {...(displayError && { error: displayError })}
        searchPlaceholder={searchPlaceholder || t("common.search")}
        loadingMessage={loadingMessage || t("common.loading") || "Loading..."}
        emptyMessage={
          emptyMessage ||
          (options.length === 0 ? t("common.noData") : t("common.noResults"))
        }
        isLoading={isLoading}
        filterOptions={filterOptions}
        renderOption={renderOption}
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { CategoryWithRelations } from "@esli-cosmetics/types";
import {
  useCategories,
  useSearchCategoriesByName,
} from "@/hooks/use-categories";
import { SearchableSelect, SearchableSelectOption } from "@esli-cosmetics/ui";
import { useTranslation } from "react-i18next";

interface CategorySelectProps {
  value?: string | undefined;
  onChange: (categoryId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  currentCategory?: CategoryWithRelations; // Pass the current category to ensure it's in the list
  searchPlaceholder?: string;
  emptyMessage?: string;
  loadingMessage?: string;
}

export function CategorySelect({
  value,
  onChange,
  placeholder = "Select a category...",
  disabled = false,
  className,
  error,
  currentCategory,
  searchPlaceholder = "Search categories...",
  emptyMessage = "No categories found",
  loadingMessage = "Loading categories...",
}: CategorySelectProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const { t } = useTranslation("categories");

  // Fetch categories with or without search
  const { data: allCategoriesData, isLoading: isLoadingAll } = useCategories({
    page: 1,
    limit: 200, // Get more categories for selection
  });

  const { data: searchCategoriesData, isLoading: isLoadingSearch } =
    useSearchCategoriesByName(activeSearchTerm, 1, 50);

  // Use search results if searching, otherwise use all categories
  const categoriesData = activeSearchTerm
    ? searchCategoriesData
    : allCategoriesData;
  const isLoading = activeSearchTerm ? isLoadingSearch : isLoadingAll;

  // Handle search - trigger on Enter key or when search button is clicked
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
  };

  const handleSearchTrigger = () => {
    setActiveSearchTerm(searchTerm);
  };
  const categories = categoriesData?.data || [];

  // Convert categories to select options
  const categoryOptions: SearchableSelectOption<CategoryWithRelations>[] =
    useMemo(() => {
      let categoriesList = [...categories];

      // Ensure the current category is always in the list when editing
      if (currentCategory && value) {
        const categoryExists = categoriesList.some(
          cat => cat.id === currentCategory.id
        );
        if (!categoryExists) {
          // Add the current category to the beginning of the list
          categoriesList.unshift(currentCategory);
        }
      }

      // Filter only active categories
      const activeCategories = categoriesList.filter(
        cat => !cat.isDeleted && cat.isActive
      );

      return activeCategories.map(category => ({
        value: category.id,
        label: category.name,
        data: category,
      }));
    }, [categories, currentCategory, value]);

  // Custom render for category options with parent info
  const renderCategoryOption = (
    option: SearchableSelectOption<CategoryWithRelations>
  ) => {
    const category = option.data;
    return (
      <div className="flex flex-col">
        <span className="font-medium">{category?.name}</span>
        {category?.parent && (
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-md bg-gray-50 px-1 py-px text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
              {t("form.parentLabel")}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {category.parent.name}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <SearchableSelect<CategoryWithRelations>
      options={categoryOptions}
      {...(value ? { value } : {})}
      onValueChange={newValue => onChange(newValue)}
      placeholder={placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      disabled={disabled}
      {...(className ? { className } : {})}
      {...(error ? { error } : {})}
      onSearchChange={handleSearchChange}
      onSearchTrigger={handleSearchTrigger}
      isLoading={isLoading}
      loadingMessage={loadingMessage}
      renderOption={renderCategoryOption}
    />
  );
}

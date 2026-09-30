"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSearchCategoriesByName } from "@/hooks/use-categories";
import { CategoryModal } from "@/components/modals/categories-modal";
import { CategoriesTable } from "@/components/tables/categories-table";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/use-categories";
import {
  CategoryWithRelations,
  CategoriesResponse,
} from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface CategoriesPageClientProps {
  initialData: CategoriesResponse | any;
}

export function CategoriesPageClient({
  initialData,
}: CategoriesPageClientProps) {
  const { t } = useTranslation("categories");

  // Debug: Log initial data

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<
    CategoryWithRelations | undefined
  >();

  // Confirmation dialog hook
  const confirmationDialog = useConfirmationDialog();

  // Toast hook
  const { toast } = useToast();

  // React Query hooks
  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useSearchCategoriesByName(activeSearchTerm, currentPage, pageSize);

  const {
    data: categoriesDataAll,
    isLoading: isCategoriesLoading,
    error: categoriesError,
    refetch: refetchCategories,
  } = useCategories({ page: currentPage, limit: pageSize });

  const isSearching = !!activeSearchTerm;

  const data = isSearching ? searchData : categoriesDataAll;
  const isLoading = isSearching ? isSearchLoading : isCategoriesLoading;
  const error = isSearching ? searchError : categoriesError;
  const refetch = isSearching ? refetchSearch : refetchCategories;

  const createCategoryMutation = useCreateCategory();
  const updateCategoryMutation = useUpdateCategory();
  const deleteCategoryMutation = useDeleteCategory();

  // Event handlers
  const handleCreateCategory = useCallback(() => {
    setEditingCategory(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleEditCategory = useCallback((category: CategoryWithRelations) => {
    setEditingCategory(category);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingCategory(undefined);
  }, []);

  const handleSuccess = useCallback(
    (action: "create" | "update" | "delete", categoryName?: string) => {
      handleModalClose();

      const messages = {
        create: {
          title: t("toast.created"),
          description: t("toast.createdDesc", {
            name: categoryName || t("page.title"),
          }),
        },
        update: {
          title: t("toast.updated"),
          description: t("toast.updatedDesc", {
            name: categoryName || t("page.title"),
          }),
        },
        delete: {
          title: t("toast.deleted"),
          description: t("toast.deletedDesc", {
            name: categoryName || t("page.title"),
          }),
        },
      };

      toast({
        type: "success",
        title: messages[action].title,
        description: messages[action].description,
        duration: 5000,
      });
    },
    [handleModalClose, toast, t]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
    },
    [setPageSize]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  const categoriesData = data || initialData;


  const handleDeleteCategory = useCallback(
    async (id: string) => {
      const category = categoriesData?.data?.find(
        (cat: CategoryWithRelations) => cat.id === id
      );
      const categoryName = category?.name || "this category";

      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: categoryName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
        variant: "destructive",
      });

      if (confirmed) {
        try {
          await deleteCategoryMutation.mutateAsync(id);
          handleSuccess("delete", categoryName);
        } catch (error) {
          console.error("Failed to delete category:", error);
          toast({
            type: "error",
            title: t("toast.deleteFailed"),
            description: t("toast.deleteFailedDesc", { name: categoryName }),
            duration: 5000,
          });
        }
      }
    },
    [
      deleteCategoryMutation,
      categoriesData.data,
      confirmationDialog,
      handleSuccess,
      toast,
      t,
    ]
  );

  const totalItems = categoriesData?.pagination?.total ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("page.title")}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t("page.subtitle")}
            </p>
          </div>
          <Button
            onClick={handleCreateCategory}
            variant="primary"
            leftIcon={<PlusIcon className="h-4 w-4" />}
            className="w-full md:w-auto"
          >
            {t("page.addButton")}
          </Button>
        </div>

        <div className="sm:p-7.5 rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
          <div className="text-center">
            <div className="mb-4 text-red-600 dark:text-red-400">
              {t("page.error.loadFailed")}
            </div>
            <Button onClick={() => refetch()} variant="outline">
              {t("page.error.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitle")}
          </p>
        </div>
        <Button
          onClick={handleCreateCategory}
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          className="w-full md:w-auto"
        >
          {t("page.addButton")}
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center space-x-4">
        <div className="relative w-full flex-1 md:w-auto md:max-w-md">
          <SearchInput
            placeholder={t("page.searchPlaceholder")}
            value={searchTerm}
            onChange={handleSearchChange}
            onSearch={handleSearch}
            minLength={0}
          />
        </div>
      </div>

      {/* Categories Table */}
      <CategoriesTable
        data={categoriesData?.data ?? []}
        onEdit={handleEditCategory}
        onDelete={handleDeleteCategory}
        isLoading={isLoading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange,
          totalItems,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      {/* Create/Edit Modal */}
      <CategoryModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        category={editingCategory}
        onSuccess={(action, categoryName) =>
          handleSuccess(action, categoryName)
        }
      />

      {/* Confirmation Dialog */}
      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

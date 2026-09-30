"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { BrandModal } from "@/components/modals/brand-modal";
import { BrandsTable } from "@/components/tables/brands-table";
import {
  useCreateBrand,
  useDeleteBrand,
  useBrands,
  useUpdateBrand,
} from "@/hooks/use-brands";
import { BrandWithRelations, BrandsResponse } from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";
import { getErrorStatus } from "@/lib/errors/api-error";

interface BrandsPageClientProps {
  initialData: BrandsResponse;
}

export function BrandsPageClient({ initialData }: BrandsPageClientProps) {
  const { t } = useTranslation("brands");

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<
    BrandWithRelations | undefined
  >();
  const [viewingBrand, setViewingBrand] = useState<
    BrandWithRelations | undefined
  >();

  // Confirmation dialog hook
  const confirmationDialog = useConfirmationDialog();

  // Toast hook
  const { toast } = useToast();

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  // API hooks
  const {
    data: brandsData,
    isLoading,
    refetch,
  } = useBrands({
    page: currentPage,
    limit: pageSize,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  const createBrandMutation = useCreateBrand();
  const updateBrandMutation = useUpdateBrand();
  const deleteBrandMutation = useDeleteBrand();

  // Use initial data if no fetched data yet
  const brands = brandsData?.data || initialData.data;
  const pagination = brandsData?.pagination || initialData.pagination;

  // Event handlers
  const handleCreateBrand = useCallback(
    async (data: any) => {
      await createBrandMutation.mutateAsync(data);
      await refetch();
    },
    [createBrandMutation, refetch]
  );

  const handleUpdateBrand = useCallback(
    async (data: any) => {
      if (!editingBrand) return;
      await updateBrandMutation.mutateAsync({
        id: editingBrand.id,
        data,
      });
      await refetch();
    },
    [editingBrand, updateBrandMutation, refetch]
  );

  const handleDeleteBrand = useCallback(
    async (brand: BrandWithRelations) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("delete.title"),
        description: t("delete.description", { name: brand.name }),
        confirmText: t("delete.confirm"),
        cancelText: t("delete.cancel"),
        variant: "destructive",
      });

      if (confirmed) {
        try {
          await deleteBrandMutation.mutateAsync(brand.id);
          await refetch();
          toast({
            type: "success",
            title: t("delete.success"),
            description: t("delete.successDescription", { name: brand.name }),
          });
        } catch (error) {
          // Extract status code from error
          const statusCode = getErrorStatus(error);

          let errorTitle = t("delete.error");
          let errorDescription = t("delete.errorDescription");

          if (statusCode === 409) {
            // Conflict: Cannot delete brand with associated products or suppliers
            errorTitle = t("delete.error");
            errorDescription =
              t("delete.hasProducts") || t("delete.errorDescription");
          } else if (statusCode === 404) {
            // Not found
            errorTitle = t("delete.notFoundTitle") || t("delete.error");
            errorDescription =
              t("delete.notFoundDescription") || t("delete.errorDescription");
          }

          toast({
            type: "error",
            title: errorTitle,
            description: errorDescription,
          });
        }
      }
    },
    [confirmationDialog, deleteBrandMutation, refetch, toast, t]
  );

  const handleEditBrand = useCallback((brand: BrandWithRelations) => {
    setViewingBrand(undefined);
    setEditingBrand(brand);
    setIsCreateModalOpen(true);
  }, []);

  const handleViewBrand = useCallback((brand: BrandWithRelations) => {
    setEditingBrand(undefined);
    setViewingBrand(brand);
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingBrand(undefined);
    setViewingBrand(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingBrand(undefined);
    setViewingBrand(undefined);
  }, []);

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

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
  }, []);

  const handleSuccess = useCallback(
    (action: "create" | "update", brandName: string) => {
      toast({
        type: "success",
        title:
          action === "create" ? t("success.created") : t("success.updated"),
        description:
          action === "create"
            ? t("success.createdDescription", { name: brandName })
            : t("success.updatedDescription", { name: brandName }),
      });
    },
    [toast, t]
  );

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
          onClick={handleCreateClick}
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
            onChange={setSearchTerm}
            onSearch={handleSearch}
            minLength={0}
          />
        </div>
      </div>

      {/* Brands Table */}
      <BrandsTable
        brands={brands}
        onEdit={handleEditBrand}
        onDelete={handleDeleteBrand}
        onView={handleViewBrand}
        isLoading={isLoading}
        pagination={{
          currentPage: pagination?.page || 1,
          totalPages: pagination?.total_pages || 1,
          onPageChange: handlePageChange,
          totalItems: pagination?.total || 0,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      {/* Modals */}
      <BrandModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        brand={editingBrand}
        onSuccess={handleSuccess}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

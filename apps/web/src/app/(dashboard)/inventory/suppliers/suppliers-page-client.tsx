"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { SupplierModal } from "@/components/modals/supplier-modal";
import { SuppliersTable } from "@/components/tables/suppliers-table";
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSuppliers,
  useUpdateSupplier,
} from "@/hooks/use-suppliers";
import {
  SupplierWithRelations,
  SuppliersResponse,
} from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface SuppliersPageClientProps {
  initialData: SuppliersResponse;
}

export function SuppliersPageClient({ initialData }: SuppliersPageClientProps) {
  const { t } = useTranslation("suppliers");

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<
    SupplierWithRelations | undefined
  >();
  const [viewingSupplier, setViewingSupplier] = useState<
    SupplierWithRelations | undefined
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
    data: suppliersData,
    isLoading,
    refetch,
  } = useSuppliers({
    page: currentPage,
    limit: pageSize,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  const createSupplierMutation = useCreateSupplier();
  const updateSupplierMutation = useUpdateSupplier();
  const deleteSupplierMutation = useDeleteSupplier();

  // Use initial data if no fetched data yet
  const suppliers = suppliersData?.data || initialData.data;
  const pagination = suppliersData?.pagination || initialData.pagination;

  // Event handlers
  const handleCreateSupplier = useCallback(
    async (data: any) => {
      await createSupplierMutation.mutateAsync(data);
      await refetch();
    },
    [createSupplierMutation, refetch]
  );

  const handleUpdateSupplier = useCallback(
    async (data: any) => {
      if (!editingSupplier) return;
      await updateSupplierMutation.mutateAsync({
        id: editingSupplier.id,
        data,
      });
      await refetch();
    },
    [editingSupplier, updateSupplierMutation, refetch]
  );

  const handleDeleteSupplier = useCallback(
    async (supplier: SupplierWithRelations) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: supplier.name }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deleteSupplierMutation.mutateAsync(supplier.id);
          await refetch();
          toast({
            title: t("toast.success"),
            description: t("toast.deleted"),
            type: "success",
          });
        } catch (error) {
          toast({
            title: t("toast.error"),
            description:
              error instanceof Error ? error.message : t("toast.deleteFailed"),
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, deleteSupplierMutation, refetch, toast]
  );

  const handleEditSupplier = useCallback((supplier: SupplierWithRelations) => {
    setEditingSupplier(supplier);
    setIsCreateModalOpen(true);
  }, []);

  const handleViewSupplier = useCallback((supplier: SupplierWithRelations) => {
    setViewingSupplier(supplier);
    // For now, we'll just show the edit modal in view mode
    // In the future, you could create a separate view-only modal
    setEditingSupplier(supplier);
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingSupplier(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingSupplier(undefined);
    setViewingSupplier(undefined);
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

      {/* Suppliers Table */}
      <SuppliersTable
        suppliers={suppliers}
        onEdit={handleEditSupplier}
        onDelete={handleDeleteSupplier}
        onView={handleViewSupplier}
        isLoading={isLoading}
        pagination={{
          currentPage: pagination?.page || 1,
          totalPages: pagination?.totalPages || 1,
          onPageChange: handlePageChange,
          totalItems: pagination?.total || 0,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      {/* Modals */}
      <SupplierModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSave={editingSupplier ? handleUpdateSupplier : handleCreateSupplier}
        supplier={editingSupplier || null}
        isLoading={
          createSupplierMutation.isPending || updateSupplierMutation.isPending
        }
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

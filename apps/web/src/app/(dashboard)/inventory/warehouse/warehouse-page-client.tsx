"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { WarehouseModal } from "@/components/modals/warehouse-modal";
import { WarehousesTable } from "@/components/tables/warehouses-table";
import {
  useCreateWarehouse,
  useDeleteWarehouse,
  useWarehouses,
  useUpdateWarehouse,
} from "@/hooks/use-warehouses";
import {
  WarehouseWithRelations,
  WarehousesResponse,
} from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface WarehousesPageClientProps {
  initialData: WarehousesResponse;
}

export function WarehousesPageClient({
  initialData,
}: WarehousesPageClientProps) {
  const { t } = useTranslation("warehouses");

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<
    WarehouseWithRelations | undefined
  >();
  const [viewingWarehouse, setViewingWarehouse] = useState<
    WarehouseWithRelations | undefined
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
    data: warehousesData,
    isLoading,
    refetch,
  } = useWarehouses({
    page: currentPage,
    limit: pageSize,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
  }, []);

  const createWarehouseMutation = useCreateWarehouse();
  const updateWarehouseMutation = useUpdateWarehouse();
  const deleteWarehouseMutation = useDeleteWarehouse();

  // Use initial data if no fetched data yet
  const warehouses = warehousesData?.data || initialData.data;
  const pagination = warehousesData?.pagination || initialData.pagination;

  // Event handlers
  const handleCreateWarehouse = useCallback(
    async (data: any) => {
      try {
        await createWarehouseMutation.mutateAsync(data);
        await refetch();
      } catch (error) {
        throw error; // Re-throw to be handled by the modal
      }
    },
    [createWarehouseMutation, refetch]
  );

  const handleUpdateWarehouse = useCallback(
    async (data: any) => {
      if (!editingWarehouse) return;

      try {
        await updateWarehouseMutation.mutateAsync({
          id: editingWarehouse.id,
          data,
        });
        await refetch();
      } catch (error) {
        throw error; // Re-throw to be handled by the modal
      }
    },
    [editingWarehouse, updateWarehouseMutation, refetch]
  );

  const handleDeleteWarehouse = useCallback(
    async (warehouse: WarehouseWithRelations) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: warehouse.name }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deleteWarehouseMutation.mutateAsync(warehouse.id);
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
    [confirmationDialog, deleteWarehouseMutation, refetch, toast]
  );

  const handleEditWarehouse = useCallback(
    (warehouse: WarehouseWithRelations) => {
      setEditingWarehouse(warehouse);
      setIsCreateModalOpen(true);
    },
    []
  );

  const handleViewWarehouse = useCallback(
    (warehouse: WarehouseWithRelations) => {
      setViewingWarehouse(warehouse);
      // For now, we'll just show the edit modal in view mode
      // In the future, you could create a separate view-only modal
      setEditingWarehouse(warehouse);
      setIsCreateModalOpen(true);
    },
    []
  );

  const handleCreateClick = useCallback(() => {
    setEditingWarehouse(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingWarehouse(undefined);
    setViewingWarehouse(undefined);
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

      {/* Warehouses Table */}
      <WarehousesTable
        warehouses={warehouses}
        onEdit={handleEditWarehouse}
        onDelete={handleDeleteWarehouse}
        onView={handleViewWarehouse}
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
      <WarehouseModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSave={
          editingWarehouse ? handleUpdateWarehouse : handleCreateWarehouse
        }
        warehouse={editingWarehouse || null}
        isLoading={
          createWarehouseMutation.isPending || updateWarehouseMutation.isPending
        }
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

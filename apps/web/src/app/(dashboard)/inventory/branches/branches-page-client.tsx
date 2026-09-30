"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { BranchModal } from "@/components/modals/branch-modal";
import { BranchesTable } from "@/components/tables/branches-table";
import {
  useCreateBranch,
  useDeleteBranch,
  useBranches,
  useUpdateBranch,
} from "@/hooks/use-branches";
import {
  BranchWithRelations,
  BranchesResponse,
  CreateBranchRequest,
  UpdateBranchRequest,
} from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface BranchesPageClientProps {
  initialData: BranchesResponse;
}

export function BranchesPageClient({ initialData }: BranchesPageClientProps) {
  const { t } = useTranslation("branches");

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<
    BranchWithRelations | undefined
  >();
  const [viewingBranch, setViewingBranch] = useState<
    BranchWithRelations | undefined
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
    data: branchesData,
    isLoading,
    refetch,
  } = useBranches({
    page: currentPage,
    limit: pageSize,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  const createBranchMutation = useCreateBranch();
  const updateBranchMutation = useUpdateBranch();
  const deleteBranchMutation = useDeleteBranch();

  // Use initial data if no fetched data yet
  const branches = branchesData?.data || initialData.data;
  const pagination = branchesData?.pagination || initialData.pagination;

  // Event handlers
  const handleCreateBranch = useCallback(
    async (data: CreateBranchRequest) => {
      try {
        await createBranchMutation.mutateAsync(data);
        await refetch();
      } catch (error) {
        throw error; // Re-throw to be handled by the modal
      }
    },
    [createBranchMutation, refetch]
  );

  const handleUpdateBranch = useCallback(
    async (data: UpdateBranchRequest) => {
      if (!editingBranch) return;

      try {
        await updateBranchMutation.mutateAsync({
          id: editingBranch.id,
          data,
        });
        await refetch();
      } catch (error) {
        throw error; // Re-throw to be handled by the modal
      }
    },
    [editingBranch, updateBranchMutation, refetch]
  );

  const handleDeleteBranch = useCallback(
    async (branch: BranchWithRelations) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: branch.name }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deleteBranchMutation.mutateAsync(branch.id);
          await refetch();
          toast({
            title: t("toast.deleted"),
            description: t("toast.deletedDesc", { name: branch.name }),
            type: "success",
          });
        } catch (error) {
          toast({
            title: t("toast.deleteFailed"),
            description:
              error instanceof Error
                ? error.message
                : t("toast.deleteFailedDesc", { name: branch.name }),
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, deleteBranchMutation, refetch, toast]
  );

  const handleEditBranch = useCallback((branch: BranchWithRelations) => {
    setEditingBranch(branch);
    setIsCreateModalOpen(true);
  }, []);

  const handleViewBranch = useCallback((branch: BranchWithRelations) => {
    setViewingBranch(branch);
    // For now, we'll just show the edit modal in view mode
    // In the future, you could create a separate view-only modal
    setEditingBranch(branch);
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingBranch(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingBranch(undefined);
    setViewingBranch(undefined);
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

      {/* Branches Table */}
      <BranchesTable
        branches={branches}
        onEdit={handleEditBranch}
        onDelete={handleDeleteBranch}
        onView={handleViewBranch}
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
      <BranchModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSave={editingBranch ? handleUpdateBranch : handleCreateBranch}
        branch={editingBranch || null}
        isLoading={
          createBranchMutation.isPending || updateBranchMutation.isPending
        }
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

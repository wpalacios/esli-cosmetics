"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { PermissionModal } from "@/components/modals/permission-modal";
import { PermissionsTable } from "@/components/tables/permissions-table";
import {
  useCreatePermission,
  useDeletePermission,
  usePermissions,
  useUpdatePermission,
} from "@/hooks/use-permissions";
import { Permission, PermissionsResponse } from "@esli-cosmetics/types";
import { Button, Input } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { useHasRole } from "@/hooks/use-auth";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface PermissionsPageClientProps {
  initialData: PermissionsResponse;
}

export function PermissionsPageClient({
  initialData,
}: PermissionsPageClientProps) {
  const { t } = useTranslation("permissions");

  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [editingPermission, setEditingPermission] = useState<
    Permission | undefined
  >();

  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();
  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    data: permissionsData,
    isLoading,
    refetch,
    isFetching,
  } = usePermissions(
    {
      page: currentPage,
      limit: pageSize,
    },
    isClient ? undefined : initialData
  );

  const createPermissionMutation = useCreatePermission();
  const updatePermissionMutation = useUpdatePermission();
  const deletePermissionMutation = useDeletePermission();

  const permissions = permissionsData?.data || initialData.data;
  const pagination = permissionsData?.pagination || initialData.pagination;

  const handleCreatePermission = useCallback(
    async (data: any) => {
      try {
        await createPermissionMutation.mutateAsync(data);
        await refetch();
      } catch (error) {
        throw error;
      }
    },
    [createPermissionMutation, refetch]
  );

  const handleUpdatePermission = useCallback(
    async (data: any) => {
      if (!editingPermission) return;

      try {
        await updatePermissionMutation.mutateAsync({
          id: editingPermission.id,
          data,
        });
        await refetch();
      } catch (error) {
        throw error;
      }
    },
    [editingPermission, updatePermissionMutation, refetch]
  );

  const handleDeletePermission = useCallback(
    async (permission: Permission) => {
      const permissionName = permission.name || permission.key;
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: permissionName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deletePermissionMutation.mutateAsync(permission.id);
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
    [confirmationDialog, deletePermissionMutation, refetch, toast, t]
  );

  const handleEditPermission = useCallback((permission: Permission) => {
    setEditingPermission(permission);
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingPermission(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingPermission(undefined);
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

  const isAdmin = useHasRole("admin");

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
        {isAdmin && (
          <Button
            onClick={handleCreateClick}
            variant="primary"
            leftIcon={<PlusIcon className="h-4 w-4" />}
            className="w-full md:w-auto"
          >
            {t("page.addButton")}
          </Button>
        )}
      </div>

      <PermissionsTable
        permissions={permissions}
        onEdit={handleEditPermission}
        onDelete={handleDeletePermission}
        isLoading={isLoading || isFetching}
        showKeyColumn={isAdmin}
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

      <PermissionModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSave={
          editingPermission ? handleUpdatePermission : handleCreatePermission
        }
        permission={editingPermission || null}
        isLoading={
          createPermissionMutation.isPending ||
          updatePermissionMutation.isPending
        }
        showKeyField={isAdmin}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

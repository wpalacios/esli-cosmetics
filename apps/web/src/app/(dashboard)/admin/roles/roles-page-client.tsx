"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { RoleModal } from "@/components/modals/role-modal";
import { RolesTable } from "@/components/tables/roles-table";
import {
  useCreateRole,
  useDeleteRole,
  useRoles,
  useUpdateRole,
} from "@/hooks/use-roles";
import { RoleWithPermissions, RolesResponse } from "@esli-cosmetics/types";
import { Button, Input } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface RolesPageClientProps {
  initialData: RolesResponse;
}

export function RolesPageClient({ initialData }: RolesPageClientProps) {
  const { t } = useTranslation("roles");

  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [editingRole, setEditingRole] = useState<
    RoleWithPermissions | undefined
  >();

  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const {
    data: rolesData,
    isLoading,
    refetch,
    isFetching,
  } = useRoles(
    {
      page: currentPage,
      limit: pageSize,
    },
    isClient ? undefined : initialData
  );

  const createRoleMutation = useCreateRole();
  const updateRoleMutation = useUpdateRole();
  const deleteRoleMutation = useDeleteRole();

  const roles = rolesData?.data || initialData.data;
  const pagination = rolesData?.pagination || initialData.pagination;

  const handleCreateRole = useCallback(
    async (data: any): Promise<RoleWithPermissions> => {
      try {
        const result = await createRoleMutation.mutateAsync(data);
        await refetch();
        // Return the created role (result should contain the role)
        return result as RoleWithPermissions;
      } catch (error) {
        throw error;
      }
    },
    [createRoleMutation, refetch]
  );

  const handleUpdateRole = useCallback(
    async (data: any, id?: string): Promise<RoleWithPermissions> => {
      if (!editingRole && !id) return {} as RoleWithPermissions;

      try {
        const roleId = id || editingRole!.id;
        const result = await updateRoleMutation.mutateAsync({
          id: roleId,
          data,
        });
        await refetch();
        // Return the updated role (result should contain the role)
        return result as RoleWithPermissions;
      } catch (error) {
        throw error;
      }
    },
    [editingRole, updateRoleMutation, refetch]
  );

  const handleDeleteRole = useCallback(
    async (role: RoleWithPermissions) => {
      const roleName = role.name || role.key;
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: roleName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deleteRoleMutation.mutateAsync(role.id);
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
    [confirmationDialog, deleteRoleMutation, refetch, toast, t]
  );

  const handleEditRole = useCallback((role: RoleWithPermissions) => {
    setEditingRole(role);
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingRole(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingRole(undefined);
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
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitle")}
          </p>
        </div>
        {/* <Button
          onClick={handleCreateClick}
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          className="w-full md:w-auto"
        >
          {t("page.addButton")}
        </Button> */}
      </div>

      <RolesTable
        roles={roles}
        onEdit={handleEditRole}
        onDelete={handleDeleteRole}
        isLoading={isLoading || isFetching}
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

      <RoleModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSave={editingRole ? handleUpdateRole : handleCreateRole}
        role={editingRole || null}
        isLoading={createRoleMutation.isPending || updateRoleMutation.isPending}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

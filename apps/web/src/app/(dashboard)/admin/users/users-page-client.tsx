"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { UserModal } from "@/components/modals/user-modal";
import { UsersTable } from "@/components/tables/users-table";
import {
  useCreateUser,
  useDeleteUser,
  useUsers,
  useUpdateUser,
} from "@/hooks/use-users";
import { UserWithRelations, UsersResponse } from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface UsersPageClientProps {
  initialData: UsersResponse;
}

export function UsersPageClient({ initialData }: UsersPageClientProps) {
  const { t } = useTranslation("users");

  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [editingUser, setEditingUser] = useState<
    UserWithRelations | undefined
  >();

  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  const {
    data: usersData,
    isLoading,
    refetch,
    isFetching,
  } = useUsers(
    {
      page: currentPage,
      limit: pageSize,
      ...(activeSearchTerm && { search: activeSearchTerm }),
    },
    isClient ? undefined : initialData
  );

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
  }, []);

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();

  const users = usersData?.data || initialData.data;
  const pagination = usersData?.pagination || initialData.pagination;

  const handleCreateUser = useCallback(
    async (data: any) => {
      try {
        await createUserMutation.mutateAsync(data);
        await refetch();
      } catch (error) {
        throw error;
      }
    },
    [createUserMutation, refetch]
  );

  const handleUpdateUser = useCallback(
    async (data: any) => {
      if (!editingUser) return;

      try {
        await updateUserMutation.mutateAsync({
          id: editingUser.id,
          data,
        });
        await refetch();
      } catch (error) {
        throw error;
      }
    },
    [editingUser, updateUserMutation, refetch]
  );

  const handleDeleteUser = useCallback(
    async (user: UserWithRelations) => {
      const userName = user.person?.firstName
        ? `${user.person.firstName} ${user.person.lastName || ""}`.trim()
        : user.email;
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: userName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deleteUserMutation.mutateAsync(user.id);
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
    [confirmationDialog, deleteUserMutation, refetch, toast, t]
  );

  const handleEditUser = useCallback((user: UserWithRelations) => {
    setEditingUser(user);
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingUser(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingUser(undefined);
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
        <Button
          onClick={handleCreateClick}
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          className="w-full md:w-auto"
        >
          {t("page.addButton")}
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative w-full flex-1 md:w-auto md:max-w-md">
          <SearchInput
            placeholder={t("page.searchPlaceholder")}
            value={searchTerm}
            onChange={setSearchTerm}
            onSearch={handleSearch}
            minLength={0}
          />
          {isFetching && activeSearchTerm && (
            <p className="mt-1 text-xs text-gray-500">{t("page.searching")}</p>
          )}
        </div>
      </div>

      <UsersTable
        users={users}
        onEdit={handleEditUser}
        onDelete={handleDeleteUser}
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

      <UserModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSave={editingUser ? handleUpdateUser : handleCreateUser}
        user={editingUser || null}
        isLoading={createUserMutation.isPending || updateUserMutation.isPending}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

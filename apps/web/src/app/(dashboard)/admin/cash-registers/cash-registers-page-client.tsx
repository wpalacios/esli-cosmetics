"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { CashRegisterModal } from "@/components/modals/cash-register-modal";
import { CashRegistersTable } from "@/components/tables/cash-registers-table";
import {
  useDeleteCashRegister,
  useCashRegisters,
} from "@/hooks/use-cash-register";
import { CashRegister, CashRegistersResponse } from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { useCurrentUser } from "@/hooks/use-auth";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface CashRegistersPageClientProps {
  initialData: CashRegistersResponse;
}

export function CashRegistersPageClient({
  initialData,
}: CashRegistersPageClientProps) {
  const { t } = useTranslation("cashRegisters");

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingCashRegister, setEditingCashRegister] = useState<
    CashRegister | undefined
  >();

  // Confirmation dialog hook
  const confirmationDialog = useConfirmationDialog();

  // Toast hook
  const { toast } = useToast();

  // Get current user for permission checks
  const { data: userData } = useCurrentUser();
  // Roles can be either string[] or array of objects with key property
  const userRoles =
    userData?.roles?.map((r: any) =>
      typeof r === "string" ? r : r?.key || r
    ) || [];
  const isAdmin = userRoles.includes("admin");
  const isStoreManager = userRoles.includes("store_manager");
  const canCreate = isAdmin || isStoreManager;
  const canEdit = isAdmin || isStoreManager;
  const canDelete = isAdmin || isStoreManager;

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  // API hooks
  const { data: cashRegistersData, isLoading } = useCashRegisters({
    page: currentPage,
    limit: pageSize,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
  }, []);

  const deleteCashRegisterMutation = useDeleteCashRegister();

  // Use initial data if no fetched data yet
  const cashRegisters = cashRegistersData?.data || initialData.data;
  const pagination = cashRegistersData?.pagination || initialData.pagination;

  const handleDeleteCashRegister = useCallback(
    async (cashRegister: CashRegister) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: cashRegister.name }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deleteCashRegisterMutation.mutateAsync(cashRegister.id);

          toast({
            title: t("toast.deleted"),
            description: t("toast.deletedDesc", { name: cashRegister.name }),
            type: "success",
          });
        } catch (error) {
          toast({
            title: t("toast.deleteFailed"),
            description:
              error instanceof Error
                ? error.message
                : t("toast.deleteFailedDesc", { name: cashRegister.name }),
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, deleteCashRegisterMutation, toast, t]
  );

  const handleEditCashRegister = useCallback((cashRegister: CashRegister) => {
    setEditingCashRegister(cashRegister);
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingCashRegister(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingCashRegister(undefined);
  }, []);

  const handleSuccess = useCallback(
    (action: "create" | "update", cashRegisterName: string) => {
      toast({
        type: "success",
        title: t("toast.success"),
        description:
          action === "create" ? t("toast.created") : t("toast.updated"),
      });
    },
    [toast, t]
  );

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
    },
    [setPageSize]
  );

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.title")}
          </h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            {t("page.description")}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={handleCreateClick}
            variant="primary"
            leftIcon={<PlusIcon className="h-4 w-4" />}
            className="w-full md:w-auto"
          >
            {t("page.newCashRegister")}
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <div className="max-w-sm flex-1">
          <SearchInput
            placeholder={t("page.searchPlaceholder")}
            value={searchTerm}
            onChange={setSearchTerm}
            onSearch={handleSearch}
            minLength={0}
          />
        </div>
      </div>

      <CashRegistersTable
        cashRegisters={cashRegisters}
        onEdit={handleEditCashRegister}
        onDelete={handleDeleteCashRegister}
        isLoading={isLoading}
        canEdit={canEdit}
        canDelete={canDelete}
        {...(pagination && {
          pagination: {
            currentPage: pagination.page,
            totalPages: pagination.total_pages,
            totalItems: pagination.total,
            onPageChange: setCurrentPage,
            pageSize,
            onPageSizeChange: handlePageSizeChange,
            pageSizeOptions,
          },
        })}
      />

      <CashRegisterModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        cashRegister={editingCashRegister || null}
        onSuccess={handleSuccess}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

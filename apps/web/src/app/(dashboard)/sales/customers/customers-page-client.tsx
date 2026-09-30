"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { CustomerModal } from "@/components/modals/customer-modal";
import { CustomersTable } from "@/components/tables/customers-table";
import {
  useCreateCustomer,
  useDeleteCustomer,
  useCustomers,
  useUpdateCustomer,
} from "@/hooks/use-customers";
import {
  CustomerWithRelations,
  CustomersResponse,
} from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface CustomersPageClientProps {
  initialData: CustomersResponse;
}

export function CustomersPageClient({ initialData }: CustomersPageClientProps) {
  const { t } = useTranslation("customers");
  const { t: tCommon } = useTranslation("common");

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<
    CustomerWithRelations | undefined
  >();
  const [viewingCustomer, setViewingCustomer] = useState<
    CustomerWithRelations | undefined
  >();

  // Confirmation dialog hook
  const confirmationDialog = useConfirmationDialog();

  // Toast hook
  const { toast } = useToast();

  // Set client flag to prevent hydration issues
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  // API hooks - only enable query after client-side hydration
  const {
    data: customersData,
    isLoading,
    refetch,
    isFetching,
  } = useCustomers(
    {
      page: currentPage,
      limit: pageSize,
      ...(activeSearchTerm && { search: activeSearchTerm }),
    },
    isClient ? undefined : initialData
  );

  const createCustomerMutation = useCreateCustomer();
  const updateCustomerMutation = useUpdateCustomer();
  const deleteCustomerMutation = useDeleteCustomer();

  // Use React Query data or initial data
  const customers = customersData?.data || initialData.data;
  const pagination = customersData?.pagination || initialData.pagination;

  // Event handlers
  const handleCreateCustomer = useCallback(
    async (data: any) => {
      try {
        await createCustomerMutation.mutateAsync(data);
        await refetch();
      } catch (error) {
        throw error; // Re-throw to be handled by the modal
      }
    },
    [createCustomerMutation, refetch]
  );

  const handleUpdateCustomer = useCallback(
    async (data: any) => {
      if (!editingCustomer) return;

      try {
        await updateCustomerMutation.mutateAsync({
          id: editingCustomer.id,
          data,
        });
        await refetch();
      } catch (error) {
        throw error; // Re-throw to be handled by the modal
      }
    },
    [editingCustomer, updateCustomerMutation, refetch]
  );

  const handleDeleteCustomer = useCallback(
    async (customer: CustomerWithRelations) => {
      const customerName =
        `${customer.person?.firstName || "Customer"} ${customer.person?.lastName || ""}`.trim();
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: customerName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deleteCustomerMutation.mutateAsync(customer.id);
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
    [confirmationDialog, deleteCustomerMutation, refetch, toast]
  );

  const handleEditCustomer = useCallback((customer: CustomerWithRelations) => {
    setEditingCustomer(customer);
    setIsCreateModalOpen(true);
  }, []);

  const handleViewCustomer = useCallback((customer: CustomerWithRelations) => {
    setViewingCustomer(customer);
    // For now, we'll just show the edit modal in view mode
    // In the future, you could create a separate view-only modal
    setEditingCustomer(customer);
    setIsCreateModalOpen(true);
  }, []);

  const handleViewStatement = useCallback((customer: CustomerWithRelations) => {
    if (typeof window !== "undefined") {
      window.location.href = `/sales/customers/${customer.id}/statement`;
    }
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingCustomer(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingCustomer(undefined);
    setViewingCustomer(undefined);
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
            translations={{
              hintPressEnter: tCommon("ui.searchInput.hintPressEnter"),
              hintToSearch: tCommon("ui.searchInput.hintToSearch"),
              hintToFocus: tCommon("ui.searchInput.hintToFocus"),
              hintEnter: tCommon("ui.searchInput.hintEnter"),
              hintCmd: tCommon("ui.searchInput.hintCmd"),
              hintCtrl: tCommon("ui.searchInput.hintCtrl"),
            }}
          />
          {isFetching && activeSearchTerm && (
            <p className="mt-1 text-xs text-gray-500">{t("page.searching")}</p>
          )}
        </div>
      </div>

      {/* Customers Table */}
      <CustomersTable
        customers={customers}
        onEdit={handleEditCustomer}
        onDelete={handleDeleteCustomer}
        onView={handleViewCustomer}
        onViewStatement={handleViewStatement}
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

      {/* Modals */}
      <CustomerModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSave={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
        customer={editingCustomer || null}
        isLoading={
          createCustomerMutation.isPending || updateCustomerMutation.isPending
        }
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

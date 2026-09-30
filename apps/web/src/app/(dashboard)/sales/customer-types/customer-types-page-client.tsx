"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { IoAdd, IoSearch } from "react-icons/io5";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import {
  CustomerType,
  PaginatedCustomerTypesResponse,
} from "@esli-cosmetics/types";
import { CustomerTypesTable } from "@/components/tables/customer-types-table";
import { CustomerTypeModal } from "@/components/modals/customer-types-modal";
import {
  useSearchCustomerType,
  useCustomerTypes,
  useDeleteCustomerType,
} from "@/hooks/use-customer-types";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { PlusIcon } from "@radix-ui/react-icons";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface CustomerTypesPageClientProps {
  initialData: PaginatedCustomerTypesResponse;
}

export function CustomerTypesPageClient({
  initialData,
}: CustomerTypesPageClientProps) {
  const { t } = useTranslation("customer-types");

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomerType, setEditingCustomerType] = useState<
    CustomerType | undefined
  >();

  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();
  const deleteCustomerTypeMutation = useDeleteCustomerType();

  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();

  // Use React Query hooks for data fetching
  const {
    data: customerTypesData,
    isLoading: isCustomerTypesLoading,
    error: customerTypesError,
    refetch: refetchCustomerTypes,
  } = useCustomerTypes({ page: currentPage, limit: pageSize });

  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useSearchCustomerType(activeSearchTerm, currentPage, pageSize);

  const isSearching = !!activeSearchTerm && activeSearchTerm.trim().length > 0;

  // Use React Query data when available, fallback to initialData
  const dataToUse = isSearching ? searchData : customerTypesData || initialData;
  const isLoading = isSearching ? isSearchLoading : isCustomerTypesLoading;
  const error = isSearching ? searchError : customerTypesError;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
  }, []);

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
    },
    [setPageSize]
  );

  const handleCreateCustomerType = useCallback(() => {
    setEditingCustomerType(undefined);
    setIsModalOpen(true);
  }, []);

  const handleEditCustomerType = useCallback((customerType: CustomerType) => {
    setEditingCustomerType(customerType);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingCustomerType(undefined);
  }, []);

  const handleSuccess = useCallback(
    (action: "create" | "update", customerTypeName: string) => {
      toast({
        title:
          action === "create" ? t("success.created") : t("success.updated"),
        description: t(
          action === "create"
            ? "success.createdMessage"
            : "success.updatedMessage",
          { name: customerTypeName }
        ),
        type: "success",
      });

      // Refetch data - React Query mutations will automatically invalidate queries
      // But we can also manually refetch if needed
      if (isSearching) {
        refetchSearch();
      } else {
        refetchCustomerTypes();
      }
    },
    [toast, t, isSearching, refetchSearch, refetchCustomerTypes]
  );

  const handleDelete = useCallback(
    async (customerType: CustomerType) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: customerType.name }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          const response = await deleteCustomerTypeMutation.mutateAsync(
            customerType.id
          );
          toast({
            title: t("success.deleted"),
            description: response.message || t("success.deleteMessage"),
            type: "success",
          });
        } catch (error: any) {
          console.error("Delete error:", error);

          // Handle specific error cases
          let errorMessage = t("error.deleteFailed");

          if (error?.message?.includes("being used by")) {
            errorMessage = t("error.inUse", { name: customerType.name });
          } else if (error?.message?.includes("not found")) {
            errorMessage = t("error.notFound");
          } else if (error?.response?.status === 409) {
            errorMessage = t("error.inUse", { name: customerType.name });
          }

          toast({
            title: t("error"),
            description: errorMessage,
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, deleteCustomerTypeMutation, toast, t]
  );

  const data = dataToUse ?? initialData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t("title")}
          </h1>
          <p className="text-gray-600">{t("description")}</p>
        </div>
        <Button
          variant="primary"
          onClick={handleCreateCustomerType}
          leftIcon={<PlusIcon className="h-4 w-4" />}
        >
          {t("createButton")}
        </Button>
      </div>

      {/* Search */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative w-full flex-1 md:w-auto md:max-w-md">
          <SearchInput
            placeholder={t("searchPlaceholder")}
            value={searchTerm}
            onChange={setSearchTerm}
            onSearch={handleSearch}
            minLength={0}
          />
        </div>
      </div>

      {/* Table */}
      <CustomerTypesTable
        customerTypes={data?.data || []}
        onEdit={handleEditCustomerType}
        onDelete={handleDelete}
        isLoading={isLoading}
        pagination={
          data
            ? {
                currentPage,
                totalPages: data.totalPages,
                totalItems: data.total,
                onPageChange: setCurrentPage,
                pageSize,
                onPageSizeChange: handlePageSizeChange,
                pageSizeOptions,
              }
            : undefined
        }
      />

      {/* Modal */}
      <CustomerTypeModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        {...(editingCustomerType ? { customerType: editingCustomerType } : {})}
        onSuccess={handleSuccess}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

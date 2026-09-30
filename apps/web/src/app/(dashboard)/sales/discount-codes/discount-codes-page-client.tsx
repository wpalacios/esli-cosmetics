"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import { DiscountCodeModal } from "@/components/modals/discount-code-modal";
import { DiscountCodesTable } from "@/components/tables/discount-codes-table";
import {
  useDeleteDiscountCode,
  useDiscountCodes,
} from "@/hooks/use-discount-codes";
import { DiscountCode, DiscountCodesResponse } from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface DiscountCodesPageClientProps {
  initialData: DiscountCodesResponse;
}

export function DiscountCodesPageClient({
  initialData,
}: DiscountCodesPageClientProps) {
  const { t } = useTranslation("discount-codes");

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [editingDiscountCode, setEditingDiscountCode] = useState<
    DiscountCode | undefined
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
    data: discountCodesData,
    isLoading,
    refetch,
    isFetching,
  } = useDiscountCodes({
    page: currentPage,
    limit: pageSize,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
  }, []);

  const deleteDiscountCodeMutation = useDeleteDiscountCode();

  // Use React Query data or initial data
  const discountCodes = discountCodesData?.data || initialData.data;
  const pagination = discountCodesData?.pagination || initialData.pagination;

  // Event handlers
  const handleFormSuccess = useCallback(async () => {
    await refetch();
    setEditingDiscountCode(undefined);
    setIsCreateModalOpen(false);
  }, [refetch]);

  const handleDeleteDiscountCode = useCallback(
    async (discountCode: DiscountCode) => {
      const discountCodeName = discountCode.code;
      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: discountCodeName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
      });

      if (confirmed) {
        try {
          await deleteDiscountCodeMutation.mutateAsync(discountCode.id);
          await refetch();
          toast({
            title: t("toast.success"),
            description: t("toast.deleted"),
            type: "success",
          });
        } catch (error) {
          console.error("Delete discount code error:", error);

          let errorMessage = t("toast.deleteFailed");

          if (error && typeof error === "object" && "message" in error) {
            const errorString = String(error.message);

            // Extract status code from API error format: "API Error: 400 - {...}"
            const statusMatch = errorString.match(/API Error: (\d+)/);
            const statusCode =
              statusMatch && statusMatch[1] ? parseInt(statusMatch[1]) : null;

            // Show user-friendly messages based on status code
            if (statusCode) {
              switch (statusCode) {
                case 400:
                  errorMessage = t("toast.badRequest");
                  break;
                case 401:
                  errorMessage = t("toast.unauthorized");
                  break;
                case 403:
                  errorMessage = t("toast.forbidden");
                  break;
                case 404:
                  errorMessage = t("toast.notFound");
                  break;
                case 500:
                  errorMessage = t("toast.serverError");
                  break;
                default:
                  errorMessage = t("toast.deleteFailed");
              }
            } else {
              errorMessage = t("toast.deleteFailed");
            }
          } else if (typeof error === "string") {
            errorMessage = t("toast.deleteFailed");
          }

          toast({
            title: t("toast.error"),
            description: errorMessage,
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, deleteDiscountCodeMutation, refetch, toast]
  );

  const handleEditDiscountCode = useCallback((discountCode: DiscountCode) => {
    setEditingDiscountCode(discountCode);
    setIsCreateModalOpen(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setEditingDiscountCode(undefined);
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
    setEditingDiscountCode(undefined);
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

  // If not ready, don't show anything
  if (!isClient) {
    return null;
  }

  if (!discountCodes) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 dark:text-gray-400">
            {t("page.error")}
          </div>
        </div>
      </div>
    );
  }

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

      {/* Discount Codes Table */}
      <DiscountCodesTable
        data={discountCodes || []}
        onEdit={handleEditDiscountCode}
        onDelete={handleDeleteDiscountCode}
        isLoading={isLoading || isFetching}
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
      <DiscountCodeModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        discountCode={editingDiscountCode || null}
        onSuccess={handleFormSuccess}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

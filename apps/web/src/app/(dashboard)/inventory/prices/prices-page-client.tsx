"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import {
  usePrices,
  useCreatePrice,
  useUpdatePrice,
  useDeletePrice,
  useSearchPrice,
} from "@/hooks/use-prices";
import { PriceModal } from "@/components/modals/prices-modal";
import { PricesTable } from "@/components/tables/prices-table";
import { PriceType, PricesResponse } from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { useTranslation } from "react-i18next";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface PricesPageClientProps {
  initialData: PricesResponse;
}

export function PricesPageClient({ initialData }: PricesPageClientProps) {
  const { t } = useTranslation("prices");

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrice, setEditingPrice] = useState<PriceType | undefined>();

  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();

  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();

  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useSearchPrice(activeSearchTerm, currentPage, pageSize);

  const {
    data: pricesDataAll,
    isLoading: isPricesLoading,
    error: pricesError,
    refetch: refetchPrices,
  } = usePrices({ page: currentPage, limit: pageSize });

  const isSearching = !!activeSearchTerm && activeSearchTerm.trim().length > 0;

  const dataToUse = isSearching ? searchData : pricesDataAll;
  const isLoading = isSearching ? isSearchLoading : isPricesLoading;
  const error = isSearching ? searchError : pricesError;
  const refetch = isSearching ? refetchSearch : refetchPrices;

  const createPriceMutation = useCreatePrice();
  const updatePriceMutation = useUpdatePrice();
  const deletePriceMutation = useDeletePrice();

  const data = dataToUse ?? initialData;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
  }, []);

  const handleCreatePrice = useCallback(() => {
    setEditingPrice(undefined);
    setIsModalOpen(true);
  }, []);

  const handleEditPrice = useCallback((priceType: PriceType) => {
    setEditingPrice(priceType);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingPrice(undefined);
  }, []);

  const handleSuccess = useCallback(
    (action: "create" | "update" | "delete", priceName?: string) => {
      refetch();
      handleModalClose();
      const name = priceName || t("common.price");

      const messages = {
        create: {
          title: t("toast.created"),
          description: t("toast.createdDesc", { name }),
        },
        update: {
          title: t("toast.updated"),
          description: t("toast.updatedDesc", { name }),
        },
        delete: {
          title: t("toast.deleted"),
          description: t("toast.deletedDesc", { name }),
        },
      };

      toast({
        type: "success",
        title: messages[action].title,
        description: messages[action].description,
        duration: 5000,
      });
    },
    [refetch, handleModalClose, toast, t]
  );

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

  const handleDeletePrice = useCallback(
    async (id: string) => {
      const priceType = data.data?.find(p => p.id === id);
      const priceName = priceType?.name || t("common.price");

      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: priceName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
        variant: "destructive",
      });

      if (confirmed) {
        try {
          await deletePriceMutation.mutateAsync(id);
          handleSuccess("delete", priceName);
        } catch (error) {
          console.error("Failed to delete price type:", error);
          toast({
            type: "error",
            title: t("toast.deleteFailed"),
            description: t("toast.deleteFailedDesc", { name: priceName }),
            duration: 5000,
          });
        }
      }
    },
    [
      deletePriceMutation,
      data.data,
      confirmationDialog,
      handleSuccess,
      toast,
      t,
    ]
  );

  const totalItems = data.pagination.total ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  if (error) {
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
            onClick={handleCreatePrice}
            variant="primary"
            leftIcon={<PlusIcon className="h-4 w-4" />}
            className="w-full md:w-auto"
          >
            {t("page.addButton")}
          </Button>
        </div>

        <div className="sm:p-7.5 rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
          <div className="text-center">
            <div className="mb-4 text-red-600 dark:text-red-400">
              {t("page.error.loadFailed")}
            </div>
            <Button onClick={() => refetch()} variant="outline">
              {t("page.error.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
          onClick={handleCreatePrice}
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
        </div>
      </div>

      <PricesTable
        data={data.data ?? []}
        onEdit={handleEditPrice}
        onDelete={handleDeletePrice}
        isLoading={isLoading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange,
          totalItems,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      <PriceModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        priceType={editingPrice}
        onSuccess={handleSuccess}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import {
  useTaxRates,
  useCreateTaxRate,
  useUpdateTaxRate,
  useDeleteTaxRate,
} from "@/hooks/use-tax-rates";
import { TaxRateModal } from "@/components/modals/tax-rates.modal";
import { TaxRatesTable } from "~/components/tables/tax-rates-table";
import { TaxRate, PaginatedTaxRates } from "@esli-cosmetics/types";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "next/navigation";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface TaxRatesPageClientProps {
  initialData: PaginatedTaxRates;
}

export function TaxRatesPageClient({ initialData }: TaxRatesPageClientProps) {
  const { t } = useTranslation("tax-rates");
  const searchParams = useSearchParams();

  const initialPage = Number(searchParams.get("page")) || 1;

  const [currentPage, setCurrentPage] = useState(initialPage);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaxRate, setEditingTaxRate] = useState<TaxRate | undefined>();

  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();

  const {
    data: taxRatesData,
    isLoading: isTaxRatesLoading,
    error: taxRatesError,
    refetch: refetchTaxRates,
  } = useTaxRates({
    page: currentPage,
    limit: pageSize,
    ...(activeSearchTerm && { search: activeSearchTerm }),
  });

  const createTaxRateMutation = useCreateTaxRate();
  const updateTaxRateMutation = useUpdateTaxRate();
  const deleteTaxRateMutation = useDeleteTaxRate();

  const data = taxRatesData ?? initialData;

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value.trim());
  }, []);

  const handleCreateTaxRate = useCallback(() => {
    setEditingTaxRate(undefined);
    setIsModalOpen(true);
  }, []);

  const handleEditTaxRate = useCallback((taxRate: TaxRate) => {
    setEditingTaxRate(taxRate);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingTaxRate(undefined);
  }, []);

  const handleSuccess = useCallback(
    (action: "create" | "update" | "delete", taxRateName?: string) => {
      refetchTaxRates();
      handleModalClose();
      const name = taxRateName || t("common.taxRate");

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
    [refetchTaxRates, handleModalClose, toast, t]
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

  const handleDeleteTaxRate = useCallback(
    async (id: string) => {
      const taxRate = data.data?.find(t => t.id === id);
      const taxRateName = taxRate?.name || t("common.taxRate");

      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: taxRateName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
        variant: "destructive",
      });

      if (confirmed) {
        try {
          await deleteTaxRateMutation.mutateAsync(id);
          handleSuccess("delete", taxRateName);
        } catch (error) {
          console.error("Failed to delete tax rate:", error);
          toast({
            type: "error",
            title: t("toast.deleteFailed"),
            description: t("toast.deleteFailedDesc", { name: taxRateName }),
            duration: 5000,
          });
        }
      }
    },
    [
      deleteTaxRateMutation,
      data.data,
      confirmationDialog,
      handleSuccess,
      toast,
      t,
    ]
  );

  const totalItems = data.pagination.total ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  if (taxRatesError) {
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
            onClick={handleCreateTaxRate}
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
            <Button onClick={() => refetchTaxRates()} variant="outline">
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
          onClick={handleCreateTaxRate}
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

      <TaxRatesTable
        data={data.data ?? []}
        onEdit={handleEditTaxRate}
        onDelete={handleDeleteTaxRate}
        isLoading={isTaxRatesLoading}
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

      <TaxRateModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        taxRate={editingTaxRate}
        onSuccess={handleSuccess}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

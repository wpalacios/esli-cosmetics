"use client";

import { PlusIcon } from "@radix-ui/react-icons";
import { useCallback, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  useStockTransfers,
  useCancelTransfer,
} from "@/hooks/use-stock-transfers";
import {
  StockTransfer,
  StockTransfersResponse,
} from "@/actions/stock-transfers";
import { Button, SearchInput, SearchableSelect } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { StockTransfersTable } from "./_components/stock-transfers-table";
import { CreateTransferModal } from "./_components/create-transfer-modal";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

interface StockTransfersPageClientProps {
  initialData: StockTransfersResponse;
}

export function StockTransfersPageClient({
  initialData,
}: StockTransfersPageClientProps) {
  const { t } = useTranslation("stock");
  const router = useRouter();

  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [isClient, setIsClient] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm, selectedStatus]);

  const {
    data: transfersData,
    isLoading,
    refetch,
    isFetching,
  } = useStockTransfers(
    {
      page: currentPage,
      limit: pageSize,
      ...(activeSearchTerm && { trackingNumber: activeSearchTerm }),
      ...(selectedStatus && { status: selectedStatus }),
    },
    isClient ? undefined : initialData
  );

  const cancelTransferMutation = useCancelTransfer();

  const transfers = transfersData?.data || initialData.data;
  const pagination = transfersData?.pagination || initialData.pagination;

  const handleViewTransfer = useCallback(
    (transfer: StockTransfer) => {
      router.push(`/stock/transfers/${transfer.id}`);
    },
    [router]
  );

  const handleCancelTransfer = useCallback(
    async (transfer: StockTransfer) => {
      const confirmed = await confirmationDialog.openDialog({
        title: t("transfers.confirm.cancelTitle"),
        description: t("transfers.confirm.cancelDesc", {
          trackingNumber: transfer.trackingNumber,
        }),
        confirmText: t("transfers.confirm.cancelButton"),
        cancelText: t("transfers.confirm.keep"),
      });

      if (confirmed) {
        try {
          await cancelTransferMutation.mutateAsync(transfer.id);
          await refetch();
          toast({
            title: t("transfers.toast.success"),
            description: t("transfers.toast.cancelled"),
            type: "success",
          });
        } catch (error) {
          toast({
            title: t("transfers.toast.error"),
            description:
              error instanceof Error
                ? error.message
                : t("transfers.toast.cancelFailed"),
            type: "error",
          });
        }
      }
    },
    [confirmationDialog, cancelTransferMutation, refetch, toast, t]
  );

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
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

  const handleCreateClick = useCallback(() => {
    setIsCreateModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  if (!isClient) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("transfers.page.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("transfers.page.subtitle")}
          </p>
        </div>
        <Button
          onClick={handleCreateClick}
          variant="primary"
          leftIcon={<PlusIcon className="h-4 w-4" />}
          className="w-full md:w-auto"
        >
          {t("transfers.page.addButton")}
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative w-full flex-1 md:w-auto md:max-w-md">
          <SearchInput
            placeholder={t("transfers.page.searchPlaceholder")}
            value={searchTerm}
            onChange={setSearchTerm}
            onSearch={handleSearch}
            minLength={0}
          />
          {isFetching && activeSearchTerm && (
            <p className="mt-1 text-xs text-gray-500">
              {t("transfers.page.searching")}
            </p>
          )}
        </div>
        <SearchableSelect
          options={[
            { value: "CREATED", label: t("transfers.status.CREATED") },
            { value: "ACCEPTED", label: t("transfers.status.ACCEPTED") },
            { value: "DISPATCHING", label: t("transfers.status.DISPATCHING") },
            { value: "IN_TRANSIT", label: t("transfers.status.IN_TRANSIT") },
            {
              value: "RECEIVED_COMPLETE",
              label: t("transfers.status.RECEIVED_COMPLETE"),
            },
            {
              value: "RECEIVED_PARTIAL",
              label: t("transfers.status.RECEIVED_PARTIAL"),
            },
            { value: "CANCELLED", label: t("transfers.status.CANCELLED") },
          ]}
          value={selectedStatus || ""}
          onValueChange={val => setSelectedStatus(val || undefined)}
          placeholder={`${t("transfers.table.status")} - Todas`}
          searchPlaceholder="Buscar estado..."
          emptyMessage="No hay estados"
          className="w-48"
        />
      </div>

      <StockTransfersTable
        transfers={transfers}
        onView={handleViewTransfer}
        onCancel={handleCancelTransfer}
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

      <CreateTransferModal
        isOpen={isCreateModalOpen}
        onClose={handleModalClose}
        onSuccess={() => {
          refetch();
          handleModalClose();
        }}
      />
      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

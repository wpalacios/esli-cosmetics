"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { PlusIcon } from "@radix-ui/react-icons";
import { Button, SearchInput } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { useGetSupplierOrderById } from "@/hooks/use-supplier-order";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

import { SupplierOrderTable } from "@/components/tables/supplier-order-table";
import { SupplierOrderModal } from "@/components/modals/supplier-order-modal";
import {
  useGetSupplierOrder,
  useCreateSupplierOrder,
  useUpdateSupplierOrder,
  useDeleteSupplierOrder,
  useExportSupplierOrderPdf,
} from "@/hooks/use-supplier-order";
import {
  PaginatedSupplierOrdersResponse,
  SupplierOrder,
  Supplier,
  ProductVariant,
  Brand,
  UpdateSupplierOrder,
} from "@esli-cosmetics/types";

interface Props {
  initialData: PaginatedSupplierOrdersResponse;
  supplierOptions: Supplier[];
  productVariantOptions: ProductVariant[];
  brandOptions: Brand[];
}

export function SupplierOrdersPageClient({
  initialData,
  supplierOptions,
  productVariantOptions,
  brandOptions,
}: Props) {
  const { t } = useTranslation("supplier-order");
  const { toast } = useToast();
  const confirmationDialog = useConfirmationDialog();

  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const { isLoading: isOrdersLoading } = useGetSupplierOrder({
    page: currentPage,
    limit: pageSize,
    search: activeSearchTerm,
  });

  const { data: orderDetail, isLoading: isLoadingOrderDetail } =
    useGetSupplierOrderById(editOrderId || "");

  const { data: ordersData } = useGetSupplierOrder({
    page: currentPage,
    limit: pageSize,
    search: activeSearchTerm,
  });

  const ordersRaw = ordersData?.data || initialData.data;
  const orders = ordersRaw.map(order => ({
    ...order,
    createdAt: order.createdAt ? new Date(order.createdAt) : new Date(),
  }));
  const pagination = ordersData?.pagination || initialData.pagination;

  const createMutation = useCreateSupplierOrder();
  const updateMutation = useUpdateSupplierOrder();
  const deleteMutation = useDeleteSupplierOrder();
  const exportPdfMutation = useExportSupplierOrderPdf();

  const handleOpenCreate = () => {
    setEditOrderId(null);
    setIsModalOpen(true);
  };

  const mapOrderDetailForModal = (
    orderDetail: UpdateSupplierOrder | undefined
  ): UpdateSupplierOrder | undefined => {
    if (!orderDetail) return undefined;
    return {
      ...orderDetail,
      id: orderDetail.id ?? "",
      supplierId: orderDetail.supplierId ?? "",
      brandId: orderDetail.brandId ?? "",
      expectedDate: orderDetail.expectedDate ?? "",
      purchaseOrderItems:
        orderDetail.purchaseOrderItems ?? orderDetail.items ?? [],
      total: orderDetail.total ?? "",
    };
  };
  const mappedOrder = mapOrderDetailForModal(
    orderDetail as UpdateSupplierOrder
  );

  const handleEdit = (orderDetail: UpdateSupplierOrder) => {
    setEditOrderId(orderDetail.id ?? null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditOrderId(null);
  };

  const handleSave = async (formData: any) => {
    try {
      if (editOrderId) {
        const result = await updateMutation.mutateAsync({
          id: editOrderId,
          data: formData,
        });
        toast({ title: t("toast.updated"), type: "success" });
        handleCloseModal();
        return result;
      } else {
        const result = await createMutation.mutateAsync(formData);
        toast({ title: t("toast.created"), type: "success" });
        return result;
      }
    } catch (error) {
      toast({
        title: t("toast.error"),
        description: "Operation failed",
        type: "error",
      });
      throw error;
    }
  };

  const handleDelete = async (order: SupplierOrder) => {
    const confirmed = await confirmationDialog.openDialog({
      title: t("confirm.deleteTitle"),
      description: t("confirm.deleteDesc"),
      confirmText: t("confirm.deleteButton"),
      cancelText: t("confirm.cancel"),
      variant: "destructive",
    });

    if (confirmed) {
      try {
        await deleteMutation.mutateAsync(order.id ?? "");
        toast({ title: t("toast.deleted"), type: "success" });
      } catch (error) {
        toast({
          title: t("toast.error"),
          description: t("toast.deleteFailed"),
          type: "error",
        });
      }
    }
  };

  const handleExportPdf = async (order: SupplierOrder) => {
    try {
      toast({ title: "Generando PDF...", type: "info" });
      const { base64, fileName } = await exportPdfMutation.mutateAsync(
        order.id ?? ""
      );

      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ title: "PDF Descargado", type: "success" });
    } catch (error) {
      toast({ title: "Error al exportar", type: "error" });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const handleSearch = (value: string) => {
    setActiveSearchTerm(value);
    setCurrentPage(1);
  };

  useEffect(() => {
  }, [initialData, supplierOptions, productVariantOptions, brandOptions]);

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
          onClick={handleOpenCreate}
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

      <SupplierOrderTable
        data={orders}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onExportPdf={handleExportPdf}
        loading={isOrdersLoading}
        pagination={{
          currentPage: pagination.page,
          totalPages: pagination.totalPages,
          totalItems: pagination.total,
          onPageChange: handlePageChange,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      <SupplierOrderModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSave}
        isLoading={
          isLoadingOrderDetail ||
          createMutation.isPending ||
          updateMutation.isPending
        }
        supplierOptions={supplierOptions}
        isEditMode={!!editOrderId}
        {...(mappedOrder ? { editingOrder: mappedOrder } : {})}
      />

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

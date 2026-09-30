"use client";

import { StockTransfer } from "@/actions/stock-transfers";
import { useToast } from "@/hooks/toast/use-toast";
import {
  useCancelTransfer,
  useDispatchTransfer,
  useExportTransferPdf,
  useReceiveTransfer,
  useStockTransfer,
  useUpdateTransferStatus,
} from "@/hooks/use-stock-transfers";
import { StockMovementType } from "@esli-cosmetics/types";
import {
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Timeline,
  type TimelineItem,
} from "@esli-cosmetics/ui";
import { useClipboard } from "@esli-cosmetics/utils";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircledIcon,
  CopyIcon,
  CrossCircledIcon,
  CubeIcon,
  DotsHorizontalIcon,
  ExclamationTriangleIcon,
  LoopIcon,
  PlusCircledIcon,
  ShuffleIcon,
} from "@radix-ui/react-icons";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { BiPrinter } from "react-icons/bi";
import { ChangeTransferStatusModal } from "../_components/change-transfer-status-modal";

type StockMovement = NonNullable<StockTransfer["movements"]>[number];

interface StockTransferDetailClientProps {
  initialData: StockTransfer;
}

// Helper function to get movement type icon and color (matching create-stock-movement-dropdown.tsx)
const getMovementTypeConfig = (movementType: StockMovementType) => {
  const configs: Record<
    StockMovementType,
    { icon: React.ElementType; color: string; bgColor: string }
  > = {
    [StockMovementType.PURCHASE]: {
      icon: PlusCircledIcon,
      color: "text-green-800 dark:text-green-300",
      bgColor: "bg-green-100 dark:bg-green-900/50",
    },
    [StockMovementType.POSITIVE_ADJUSTMENT]: {
      icon: ArrowUpIcon,
      color: "text-yellow-800 dark:text-yellow-300",
      bgColor: "bg-yellow-100 dark:bg-yellow-900/50",
    },
    [StockMovementType.NEGATIVE_ADJUSTMENT]: {
      icon: ArrowDownIcon,
      color: "text-orange-800 dark:text-orange-300",
      bgColor: "bg-orange-100 dark:bg-orange-900/50",
    },
    [StockMovementType.TRANSFER]: {
      icon: ShuffleIcon,
      color: "text-blue-800 dark:text-blue-300",
      bgColor: "bg-blue-100 dark:bg-blue-900/50",
    },
    [StockMovementType.DAMAGE]: {
      icon: ExclamationTriangleIcon,
      color: "text-orange-800 dark:text-orange-300",
      bgColor: "bg-orange-100 dark:bg-orange-900/50",
    },
    [StockMovementType.RETURN]: {
      icon: LoopIcon,
      color: "text-purple-800 dark:text-purple-300",
      bgColor: "bg-purple-100 dark:bg-purple-900/50",
    },
    // Default fallbacks for types not in dropdown
    [StockMovementType.SALE]: {
      icon: ArrowDownIcon,
      color: "text-red-800 dark:text-red-300",
      bgColor: "bg-red-100 dark:bg-red-900/50",
    },
    [StockMovementType.ANNULMENT]: {
      icon: CrossCircledIcon,
      color: "text-gray-800 dark:text-gray-300",
      bgColor: "bg-gray-100 dark:bg-gray-900/50",
    },
    [StockMovementType.RESTOCK]: {
      icon: ArrowUpIcon,
      color: "text-blue-800 dark:text-blue-300",
      bgColor: "bg-blue-100 dark:bg-blue-900/50",
    },
  };

  return (
    configs[movementType] || {
      icon: CubeIcon,
      color: "text-gray-800 dark:text-gray-300",
      bgColor: "bg-gray-100 dark:bg-gray-900/50",
    }
  );
};

export function StockTransferDetailClient({
  initialData,
}: StockTransferDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("stock");
  const { copy, hasCopied } = useClipboard();
  const { data: transfer, refetch } = useStockTransfer(initialData.id);
  const updateStatusMutation = useUpdateTransferStatus();
  const dispatchMutation = useDispatchTransfer();
  const receiveMutation = useReceiveTransfer();
  const cancelMutation = useCancelTransfer();
  const exportPdfMutation = useExportTransferPdf();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<
    "ACCEPT" | "DISPATCH" | "RECEIVE"
  >("ACCEPT");

  const currentTransfer = transfer || initialData;

  const getStatusBadgeColor = () => {
    const status = currentTransfer.status;
    if (status === "CANCELLED" || status === "RECEIVED_PARTIAL") {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    }
    if (status === "DISPATCHING" || status === "IN_TRANSIT") {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
    if (status === "RECEIVED_COMPLETE") {
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    }
    return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  };

  const getStatusLabel = () => {
    return t(`transfers.status.${currentTransfer.status}`);
  };

  const handleAccept = () => {
    setModalAction("ACCEPT");
    setIsModalOpen(true);
  };

  const handleDispatch = () => {
    setModalAction("DISPATCH");
    setIsModalOpen(true);
  };

  const handleReceive = () => {
    setModalAction("RECEIVE");
    setIsModalOpen(true);
  };

  const handleStartDispatching = useCallback(async () => {
    try {
      await updateStatusMutation.mutateAsync({
        id: currentTransfer.id,
        data: {
          status: "DISPATCHING",
          note: t("transfers.modal.infoDispatch"),
        },
      });
      await refetch();
      toast({
        title: t("transfers.toast.success"),
        description: t("transfers.toast.statusUpdated"),
        type: "success",
      });
    } catch (error) {
      toast({
        title: t("transfers.toast.error"),
        description:
          error instanceof Error
            ? error.message
            : t("transfers.toast.statusUpdateFailed"),
        type: "error",
      });
    }
  }, [updateStatusMutation, currentTransfer.id, refetch, toast, t]);

  const handleCancel = useCallback(async () => {
    try {
      await cancelMutation.mutateAsync(currentTransfer.id);
      await refetch();
      toast({
        title: t("transfers.toast.success"),
        description: t("transfers.toast.cancelled"),
        type: "success",
      });
      router.push("/stock/transfers");
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
  }, [cancelMutation, currentTransfer.id, refetch, toast, t, router]);

  const handleModalConfirm = useCallback(
    async (data: {
      items: Array<{
        itemId: string;
        quantitySent?: number;
        quantityReceived?: number;
        discrepancyType?: "DAMAGE" | "NOT_RECEIVED";
      }>;
      note?: string;
    }) => {
      try {
        if (modalAction === "ACCEPT") {
          await updateStatusMutation.mutateAsync({
            id: currentTransfer.id,
            data: { status: "ACCEPTED", ...(data.note && { note: data.note }) },
          });
        } else if (modalAction === "DISPATCH") {
          // Use refetched transfer to avoid stale state (e.g. another tab or double submit)
          const { data: freshTransfer } = await refetch();
          const transfer = freshTransfer ?? currentTransfer;

          if (transfer.status !== "DISPATCHING") {
            setIsModalOpen(false);
            toast({
              title: t("transfers.toast.success"),
              description: t("transfers.toast.alreadyDispatched"),
              type: "info",
            });
            return;
          }
          await dispatchMutation.mutateAsync({
            id: transfer.id,
            data: {
              items: data.items.map(item => ({
                itemId: item.itemId,
                quantitySent: item.quantitySent!,
              })),
              ...(data.note && { note: data.note }),
            },
          });
        } else if (modalAction === "RECEIVE") {
          await receiveMutation.mutateAsync({
            id: currentTransfer.id,
            data: {
              items: data.items.map(item => ({
                itemId: item.itemId,
                quantityReceived: item.quantityReceived!,
                ...(item.discrepancyType && {
                  discrepancyType: item.discrepancyType,
                }),
              })),
              ...(data.note && { note: data.note }),
            },
          });
        }

        await refetch();
        setIsModalOpen(false);
        toast({
          title: t("transfers.toast.success"),
          description: t("transfers.toast.statusUpdated"),
          type: "success",
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : t("transfers.toast.updateFailed");
        const isAlreadyDispatched =
          typeof message === "string" &&
          (message.includes("IN_TRANSIT") ||
            message.includes("DISPATCHING status"));
        if (isAlreadyDispatched) {
          await refetch();
          setIsModalOpen(false);
          toast({
            title: t("transfers.toast.success"),
            description: t("transfers.toast.alreadyDispatched"),
            type: "info",
          });
        } else {
          toast({
            title: t("transfers.toast.error"),
            description: message,
            type: "error",
          });
        }
      }
    },
    [
      modalAction,
      currentTransfer,
      updateStatusMutation,
      dispatchMutation,
      receiveMutation,
      refetch,
      toast,
      t,
    ]
  );

  // Movements table columns
  const movementsColumns: ColumnDef<StockMovement>[] = [
    {
      id: "movementType",
      header: () => t("transfers.detail.type"),
      cell: ({ row }: { row: { original: StockMovement } }) => {
        const config = getMovementTypeConfig(row.original.movementType);
        const Icon = config.icon;
        return (
          <Badge
            variant="secondary"
            className={`flex w-fit items-center gap-1.5 text-xs ${config.bgColor} ${config.color} border-0`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{t(`movements.types.${row.original.movementType}`)}</span>
          </Badge>
        );
      },
    },
    {
      id: "quantity",
      header: () => t("transfers.detail.quantity"),
      cell: ({ row }: { row: { original: StockMovement } }) => (
        <span className="font-semibold">{row.original.quantity}</span>
      ),
    },
    {
      id: "product",
      header: () => t("transfers.detail.itemName"),
      cell: ({ row }: { row: { original: StockMovement } }) =>
        row.original.productVariant?.name || row.original.product?.name || "-",
    },
    {
      id: "fromLocation",
      header: () => t("transfers.detail.from"),
      cell: ({ row }: { row: { original: StockMovement } }) =>
        row.original.fromLocation?.name || "-",
    },
    {
      id: "toLocation",
      header: () => t("transfers.detail.to"),
      cell: ({ row }: { row: { original: StockMovement } }) =>
        row.original.toLocation?.name || "-",
    },
    {
      id: "createdAt",
      header: () => t("transfers.detail.createdAt"),
      cell: ({ row }: { row: { original: StockMovement } }) =>
        format(new Date(row.original.createdAt), "dd/MM/yyyy HH:mm"),
    },
    {
      id: "note",
      header: () => t("transfers.detail.note"),
      cell: ({ row }) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {row.original.note || "-"}
        </span>
      ),
    },
  ];

  const canAccept = currentTransfer.status === "CREATED";
  const canStartDispatching = currentTransfer.status === "ACCEPTED";
  const canDispatch = currentTransfer.status === "DISPATCHING";
  const canReceive = currentTransfer.status === "IN_TRANSIT";
  const canCancel =
    currentTransfer.status === "CREATED" ||
    currentTransfer.status === "ACCEPTED";
  const canExportPdf =
    currentTransfer.status === "IN_TRANSIT" ||
    currentTransfer.status === "RECEIVED_COMPLETE" ||
    currentTransfer.status === "RECEIVED_PARTIAL";

  const isAnyMutationPending =
    updateStatusMutation.isPending ||
    dispatchMutation.isPending ||
    receiveMutation.isPending ||
    cancelMutation.isPending ||
    exportPdfMutation.isPending;

  // Get movement creation status message
  const getMovementStatusMessage = () => {
    const status = currentTransfer.status;
    if (
      status === "CREATED" ||
      status === "ACCEPTED" ||
      status === "DISPATCHING"
    ) {
      return t("transfers.detail.movementsWillBeCreatedAtDispatch");
    }
    if (status === "IN_TRANSIT") {
      return t("transfers.detail.movementsCreatedAtDispatch");
    }
    if (status === "RECEIVED_COMPLETE" || status === "RECEIVED_PARTIAL") {
      return t("transfers.detail.movementsCreatedAtReceive");
    }
    return t("transfers.detail.noMovementsYet");
  };

  // Get sender/receiver employee names
  const getSenderName = () => {
    if (!currentTransfer.sender) return "N/A";
    return (
      currentTransfer.sender.email ||
      `${currentTransfer.sender.firstName || ""} ${currentTransfer.sender.lastName || ""}`.trim() ||
      "Unknown"
    );
  };

  const getReceiverName = () => {
    if (!currentTransfer.receiver) return "N/A";
    return (
      currentTransfer.receiver.email ||
      `${currentTransfer.receiver.firstName || ""} ${currentTransfer.receiver.lastName || ""}`.trim() ||
      "Unknown"
    );
  };

  // Helper to download PDF
  const downloadPdf = useCallback((base64: string, fileName: string) => {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], {
      type: "application/pdf",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportPdf = useCallback(async () => {
    try {
      const result = await exportPdfMutation.mutateAsync(currentTransfer.id);
      downloadPdf(result.base64, result.fileName);
      toast({
        title: t("transfers.toast.success"),
        description:
          t("transfers.detail.pdfExported") || "PDF exported successfully",
        type: "success",
      });
    } catch (error) {
      toast({
        title: t("transfers.toast.error"),
        description:
          error instanceof Error
            ? error.message
            : t("transfers.detail.pdfExportFailed") || "Failed to export PDF",
        type: "error",
      });
    }
  }, [exportPdfMutation, currentTransfer.id, downloadPdf, toast, t]);

  return (
    <div className="space-y-6 pb-6">
      {/* Top Header Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                {t("transfers.detail.title", {
                  trackingNumber: currentTransfer.trackingNumber,
                })}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-lg font-semibold text-[#ff48b0] sm:text-xl">
                  {currentTransfer.trackingNumber}
                </span>
                <Badge
                  variant={
                    currentTransfer.status === "CANCELLED" ||
                    currentTransfer.status === "RECEIVED_PARTIAL"
                      ? "error"
                      : "primary"
                  }
                  className={getStatusBadgeColor()}
                >
                  {getStatusLabel()}
                </Badge>
              </div>
            </div>
          </div>
          {currentTransfer.status !== "CANCELLED" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex w-full items-center gap-2 sm:w-auto"
                >
                  <DotsHorizontalIcon className="h-4 w-4" />
                  <span>{t("transfers.detail.actions")}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {canAccept && (
                  <DropdownMenuItem
                    onClick={handleAccept}
                    disabled={isAnyMutationPending}
                    className="flex items-center gap-2 text-green-600 focus:text-green-700"
                  >
                    <CheckCircledIcon className="h-4 w-4" />
                    <span>
                      {updateStatusMutation.isPending
                        ? t("common.loading") || "Loading..."
                        : t("transfers.detail.acceptTransfer")}
                    </span>
                  </DropdownMenuItem>
                )}
                {canStartDispatching && (
                  <>
                    {canAccept && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={handleStartDispatching}
                      disabled={isAnyMutationPending}
                      className="flex items-center gap-2 text-blue-600 focus:text-blue-700"
                    >
                      <CheckCircledIcon className="h-4 w-4" />
                      <span>
                        {updateStatusMutation.isPending
                          ? t("common.loading") || "Loading..."
                          : t("transfers.detail.startDispatch")}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
                {canDispatch && (
                  <>
                    {(canAccept || canStartDispatching) && (
                      <DropdownMenuSeparator />
                    )}
                    <DropdownMenuItem
                      onClick={handleDispatch}
                      disabled={isAnyMutationPending}
                      className="flex items-center gap-2 text-blue-600 focus:text-blue-700"
                    >
                      <CheckCircledIcon className="h-4 w-4" />
                      <span>
                        {dispatchMutation.isPending
                          ? t("common.loading") || "Loading..."
                          : t("transfers.detail.dispatchSend")}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
                {canReceive && (
                  <>
                    {(canAccept || canStartDispatching || canDispatch) && (
                      <DropdownMenuSeparator />
                    )}
                    <DropdownMenuItem
                      onClick={handleReceive}
                      disabled={isAnyMutationPending}
                      className="flex items-center gap-2 text-green-600 focus:text-green-700"
                    >
                      <CheckCircledIcon className="h-4 w-4" />
                      <span>
                        {receiveMutation.isPending
                          ? t("common.loading") || "Loading..."
                          : t("transfers.detail.receive")}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
                {canCancel && (
                  <>
                    {(canAccept ||
                      canStartDispatching ||
                      canDispatch ||
                      canReceive) && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={handleCancel}
                      disabled={isAnyMutationPending}
                      className="flex items-center gap-2 text-red-600 focus:text-red-700"
                    >
                      <CrossCircledIcon className="h-4 w-4" />
                      <span>
                        {cancelMutation.isPending
                          ? t("common.loading") || "Loading..."
                          : t("transfers.detail.cancelTransfer")}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
                {canExportPdf && (
                  <>
                    {(canAccept ||
                      canStartDispatching ||
                      canDispatch ||
                      canReceive ||
                      canCancel) && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={handleExportPdf}
                      disabled={isAnyMutationPending}
                      className="flex items-center gap-2 text-purple-600 focus:text-purple-700"
                    >
                      <BiPrinter className="h-4 w-4" />
                      <span>
                        {exportPdfMutation.isPending
                          ? t("common.loading") || "Loading..."
                          : t("transfers.detail.exportPdf") || "Export PDF"}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Transfer Information Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 border-b border-gray-200 pb-3 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
          {t("transfers.detail.transferInformation")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <span className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              {t("transfers.detail.createdAt")}
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {format(new Date(currentTransfer.createdAt), "dd/MM/yyyy HH:mm")}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              {t("transfers.detail.fromLocation")}
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {currentTransfer.fromLocation?.name || "N/A"}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              {t("transfers.detail.toLocation")}
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {currentTransfer.toLocation?.name || "N/A"}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              {t("transfers.detail.createdBy")}
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {currentTransfer.createdBy?.email || "N/A"}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              {t("transfers.detail.sender")}
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {getSenderName()}
            </p>
          </div>
          <div>
            <span className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              {t("transfers.detail.receiver")}
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {getReceiverName()}
            </p>
          </div>
          {currentTransfer.dispatchedAt && (
            <div>
              <span className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                {t("transfers.detail.dispatchedAt")}
              </span>
              <p className="font-medium text-gray-900 dark:text-white">
                {format(
                  new Date(currentTransfer.dispatchedAt),
                  "dd/MM/yyyy HH:mm"
                )}
              </p>
            </div>
          )}
          {currentTransfer.receivedAt && (
            <div>
              <span className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
                {t("transfers.detail.receivedAt")}
              </span>
              <p className="font-medium text-gray-900 dark:text-white">
                {format(
                  new Date(currentTransfer.receivedAt),
                  "dd/MM/yyyy HH:mm"
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Transfer Items Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t("transfers.detail.transferItems")}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="space-y-4">
              {(currentTransfer.items || []).map(item => {
                // Only show discrepancies when transfer is in transit or received
                // A discrepancy exists if:
                // - In IN_TRANSIT: requested != sent (dispatch phase discrepancy)
                // - In RECEIVED_PARTIAL or RECEIVED_COMPLETE: sent != received (receiving phase discrepancy)
                const shouldShowDiscrepancy =
                  currentTransfer.status === "IN_TRANSIT" ||
                  currentTransfer.status === "RECEIVED_PARTIAL" ||
                  currentTransfer.status === "RECEIVED_COMPLETE";

                let hasDiscrepancy = false;
                if (currentTransfer.status === "IN_TRANSIT") {
                  // For IN_TRANSIT, check if requested != sent
                  hasDiscrepancy =
                    item.quantityRequested !==
                    (item.quantitySent ?? item.quantityRequested);
                } else if (
                  currentTransfer.status === "RECEIVED_PARTIAL" ||
                  currentTransfer.status === "RECEIVED_COMPLETE"
                ) {
                  // For received statuses, check if sent != received
                  const quantitySent =
                    item.quantitySent ?? item.quantityRequested;
                  hasDiscrepancy =
                    quantitySent !== (item.quantityReceived ?? quantitySent);
                }

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-4 rounded-lg border p-4 transition-shadow sm:flex-row sm:items-center sm:justify-between ${
                      hasDiscrepancy
                        ? "border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/50"
                        : "border-gray-200 bg-gray-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start gap-2">
                        <div className="mb-1 font-semibold text-gray-900 dark:text-white">
                          {item.productVariant?.name ||
                            item.product?.name ||
                            t("transfers.modal.unknownProduct")}
                          {(() => {
                            const sku =
                              item.productVariant?.sku ||
                              item.product?.sku ||
                              (item.productVariant as any)?.sku;
                            const hasSku = sku && String(sku).trim();
                            return (
                              <div className="mt-1">
                                <span className="flex w-fit items-center rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800">
                                  <span>SKU: {hasSku ? sku : "NO-SKU"}</span>
                                  {hasSku && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      type="button"
                                      className="ml-1 size-5 rounded p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (sku) {
                                          copy(sku);
                                          toast({
                                            title: t("transfers.toast.success"),
                                            description: t(
                                              "table.copied",
                                              "¡Copiado!"
                                            ),
                                            type: "success",
                                          });
                                        }
                                      }}
                                      title={
                                        hasCopied
                                          ? t("table.copied", "¡Copiado!")
                                          : t("table.copySku", "Copiar SKU")
                                      }
                                    >
                                      <CopyIcon
                                        className={`h-3 w-3 ${
                                          hasCopied
                                            ? "text-green-600"
                                            : "text-gray-400"
                                        }`}
                                      />
                                      <span className="sr-only">
                                        {t("table.copySku", "Copiar SKU")}
                                      </span>
                                    </Button>
                                  )}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                        {hasDiscrepancy && (
                          <Badge variant="error" className="shrink-0 text-xs">
                            {t("transfers.detail.discrepancy")}
                          </Badge>
                        )}
                      </div>
                      {item.productVariant?.product?.brand && (
                        <div className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                          {item.productVariant.product.brand.name}
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">
                            {t("transfers.detail.requested")}:
                          </span>
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {item.quantityRequested}
                          </span>
                        </div>
                        <span className="text-gray-400">|</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">
                            {t("transfers.detail.sent")}:
                          </span>
                          <span
                            className={`font-semibold ${
                              shouldShowDiscrepancy &&
                              item.quantitySent !== item.quantityRequested
                                ? "text-orange-600 dark:text-orange-400"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {item.quantitySent ?? "-"}
                          </span>
                        </div>
                        <span className="text-gray-400">|</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">
                            {t("transfers.detail.received")}:
                          </span>
                          <span
                            className={`font-semibold ${
                              shouldShowDiscrepancy &&
                              item.quantityReceived !== item.quantitySent
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {item.quantityReceived ?? "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Stock Movements Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 border-b border-gray-200 pb-3 text-xl font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
          {t("transfers.detail.inventoryMovements")}
        </h2>
        {currentTransfer.movements && currentTransfer.movements.length > 0 ? (
          <DataTable
            data={currentTransfer.movements}
            columns={movementsColumns}
            clientPagination
            paginationLabels={{
              showing: t("pagination.showing"),
              of: t("pagination.of"),
              results: t("pagination.results"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              page: t("pagination.page"),
              rowsPerPage: t("pagination.rowsPerPage"),
            }}
          />
        ) : (
          <div className="py-8 text-center">
            <div className="text-gray-500 dark:text-gray-400">
              {getMovementStatusMessage()}
            </div>
          </div>
        )}
      </div>

      {/* Transfer Logs Timeline Section */}
      {currentTransfer.logs && currentTransfer.logs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
          <h2 className="mb-4 border-b border-gray-200 pb-3 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-white sm:text-xl">
            {t("transfers.detail.activityLog")}
          </h2>
          <Timeline
            items={currentTransfer.logs.map((log): TimelineItem => {
              const statusVariant =
                log.newStatus === "RECEIVED_PARTIAL" ? "error" : "success";

              const badges: TimelineItem["badges"] = [
                {
                  label: t(`transfers.status.${log.newStatus}`),
                  variant: statusVariant,
                },
              ];

              const item: TimelineItem = {
                id: log.id,
                timestamp: log.createdAt,
                badges,
              };

              if (log.note) {
                item.description = log.note;
              }

              if (log.user) {
                item.user = {
                  email: log.user.email,
                  firstName: log.user.firstName,
                  lastName: log.user.lastName,
                };
              }
              return item;
            })}
            dotColor="#ff48b0"
            showUser={true}
            formatTimestamp={timestamp =>
              format(new Date(timestamp), "dd/MM/yyyy HH:mm")
            }
            emptyMessage={t("transfers.detail.noActivity")}
          />
        </div>
      )}

      {/* Status Change Modal */}
      {isModalOpen && (
        <ChangeTransferStatusModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleModalConfirm}
          transfer={currentTransfer}
          action={modalAction}
          isLoading={isAnyMutationPending}
        />
      )}
    </div>
  );
}

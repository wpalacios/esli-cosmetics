"use client";

import {
  AnnulOrderItemRequest,
  BulkAnnulOrderItemsRequest,
  getOrder,
  Order,
  PayInstallmentRequest,
} from "@/actions/orders";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { useCurrentUser } from "@/hooks/use-auth";
import {
  useAnnulOrder,
  useAnnulOrderItem,
  useBulkAnnulOrderItems,
  useApproveOrder,
  useExportInstallmentReceiptPdf,
  useExportReceiptPdf,
  useExportPaymentReceiptPdf,
  useManualReverseOrderPayment,
  usePayInstallment,
  usePayOrder,
  useReverseOrderPayment,
} from "@/hooks/use-orders";
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@esli-cosmetics/ui";
import { formatCurrency, useClipboard } from "@esli-cosmetics/utils";
import {
  CheckCircledIcon,
  CrossCircledIcon,
  CopyIcon,
  DotsHorizontalIcon,
} from "@radix-ui/react-icons";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ReversePaymentModal } from "../../_components/reverse-payment-modal";
import { useTranslation } from "react-i18next";
import {
  BiChevronDown,
  BiChevronUp,
  BiInfoCircle,
  BiPrinter,
} from "react-icons/bi";
import { AnnulItemModal } from "./_components/annul-item-modal";
import { BulkAnnulItemsModal } from "./_components/bulk-annul-items-modal";
import { PaymentItem, PaymentModal } from "./_components/payment-modal";

interface OrderViewPageClientProps {
  order: Order;
}

// Helper function to check if an installment is overdue
function isInstallmentOverdue(installment: {
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: string;
}): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day for accurate comparison

  const dueDate = new Date(installment.dueDate);
  dueDate.setHours(0, 0, 0, 0);

  // Check if installment is overdue:
  // 1. Due date is before or equal to today
  // 2. Not fully paid (paidAmount < amount or status is not PAID)
  const isPastDue = dueDate <= today;
  const isNotFullyPaid =
    installment.paidAmount < installment.amount ||
    installment.status !== "PAID";

  return isPastDue && isNotFullyPaid;
}

// Shared type for items to ensure State and Function parameters match exactly
type OrderItemWithKit = NonNullable<Order["items"]>[number];
const LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL_CODE =
  "LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL";

function shouldFallbackToManualReversal(error: unknown): boolean {
  const maybeError = error as
    | {
        code?: string;
        response?: { code?: string; message?: string | string[] };
        message?: string;
        errorText?: string;
      }
    | undefined;
  const code = maybeError?.code ?? maybeError?.response?.code;
  if (code === LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL_CODE) return true;

  // Next server-action errors can lose structured fields, but keep raw API payload as errorText.
  if (typeof maybeError?.errorText === "string" && maybeError.errorText) {
    try {
      const parsed = JSON.parse(maybeError.errorText) as {
        code?: string;
        message?: string | string[];
      };
      if (parsed.code === LEGACY_PAYMENT_REQUIRES_MANUAL_REVERSAL_CODE)
        return true;
      if (Array.isArray(parsed.message)) {
        if (parsed.message.join(" ").toLowerCase().includes("legacy payment"))
          return true;
      } else if (
        typeof parsed.message === "string" &&
        parsed.message.toLowerCase().includes("legacy payment")
      ) {
        return true;
      }
    } catch {
      // Ignore parse errors and continue with message-based fallback.
    }
  }
  let message = "";
  if (typeof maybeError?.message === "string") {
    message = maybeError.message;
  } else if (Array.isArray(maybeError?.response?.message)) {
    message = maybeError.response.message.join(" ");
  } else if (typeof maybeError?.response?.message === "string") {
    message = maybeError.response.message;
  }
  return message.toLowerCase().includes("legacy payment");
}

export function OrderViewPageClient({ order }: OrderViewPageClientProps) {
  const { t } = useTranslation("orders");
  const router = useRouter();
  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();
  const { copy, hasCopied } = useClipboard();
  const annulOrderMutation = useAnnulOrder();
  const approveOrderMutation = useApproveOrder();
  const payInstallmentMutation = usePayInstallment();
  const payOrderMutation = usePayOrder();
  const exportInstallmentReceiptMutation = useExportInstallmentReceiptPdf();
  const exportReceiptMutation = useExportReceiptPdf();
  const exportPaymentReceiptMutation = useExportPaymentReceiptPdf();
  const reversePaymentMutation = useReverseOrderPayment();
  const manualReversePaymentMutation = useManualReverseOrderPayment();
  const annulOrderItemMutation = useAnnulOrderItem();
  const bulkAnnulOrderItemsMutation = useBulkAnnulOrderItems();

  // Payment modal state
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<
    "installment" | "order" | null
  >(null);
  const [selectedInstallment, setSelectedInstallment] = useState<{
    id: string;
    amount: number;
    paidAmount: number;
  } | null>(null);
  /** Fresh order refetched when opening "Pay order" modal to avoid stale outstanding amount */
  const [orderForPaymentModal, setOrderForPaymentModal] =
    useState<Order | null>(null);

  const [reversePaymentModalOpen, setReversePaymentModalOpen] = useState(false);
  const [reversePaymentTarget, setReversePaymentTarget] = useState<{
    id: string;
    amount: number;
    creditInstallmentId?: string | null;
  } | null>(null);

  // Annul item modal state
  const [annulItemModalOpen, setAnnulItemModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OrderItemWithKit | null>(
    null
  );

  // Bulk annul items modal state
  const [bulkAnnulModalOpen, setBulkAnnulModalOpen] = useState(false);

  // Filter state for annulled items
  const [showFullyAnnulled, setShowFullyAnnulled] = useState(true);
  const [expandedAnnulments, setExpandedAnnulments] = useState<Set<string>>(
    new Set()
  );

  // Calculate annulment statistics
  const annulmentStats = useMemo(() => {
    const items = order.items || [];
    const totalItems = items.length;
    const annulledItems = items.filter(
      item => (item.annulledQuantity || 0) > 0
    ).length;
    const fullyAnnulledItems = items.filter(
      item => (item.annulledQuantity || 0) === item.quantity
    ).length;
    const totalAnnulledAmount = items.reduce(
      (sum, item) => sum + (item.annulledAmount || 0),
      0
    );

    // Calculate percentage based on ORIGINAL order total (current + annulled)
    // This gives the correct percentage of what was annulled from the original order
    const originalTotal = order.totalAmount + totalAnnulledAmount;
    const annulmentPercentage =
      originalTotal > 0 ? (totalAnnulledAmount / originalTotal) * 100 : 0;

    return {
      totalItems,
      annulledItems,
      fullyAnnulledItems,
      totalAnnulledAmount,
      annulmentPercentage,
    };
  }, [order]);

  // Filter and sort items: maintain original order but move fully annulled to bottom
  const filteredItems = useMemo(() => {
    const items = order.items || [];

    // Create array with original index from the full items array
    const itemsWithIndex = items.map((item, originalIndex) => ({
      item,
      originalIndex,
      isFullyAnnulled: (item.annulledQuantity || 0) === item.quantity,
    }));

    // Filter if needed (before sorting to preserve original order)
    const filtered = showFullyAnnulled
      ? itemsWithIndex
      : itemsWithIndex.filter(
          ({ item }) => (item.annulledQuantity || 0) < item.quantity
        );

    // Sort: fully annulled items go to bottom, others maintain original order
    filtered.sort((a, b) => {
      // Fully annulled items go to bottom
      if (a.isFullyAnnulled && !b.isFullyAnnulled) return 1;
      if (!a.isFullyAnnulled && b.isFullyAnnulled) return -1;
      // Otherwise maintain original order from the backend
      return a.originalIndex - b.originalIndex;
    });

    return filtered.map(({ item }) => item);
  }, [order.items, showFullyAnnulled]);

  const toggleAnnulmentDetails = (itemId: string) => {
    setExpandedAnnulments(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Get current user for role-based access control
  const { data: userData } = useCurrentUser();
  const userRoles =
    userData?.roles?.map((r: any) =>
      typeof r === "string" ? r : r?.key || r
    ) || [];
  const isAdmin = userRoles.includes("admin");
  const isStoreManager = userRoles.includes("store_manager");
  const canManageOrders = isAdmin || isStoreManager;

  const isAnnulled = order.status === "ANNULLED";
  const isPending = order.status === "PENDING";
  const isApproved = order.status === "APPROVED";
  const isCompleted = order.status === "COMPLETED";
  const isCreditOrder = order.paymentMethod === "CREDIT";
  const canApprove = canManageOrders && isCreditOrder && isPending;
  const canAnnul =
    canManageOrders && !isAnnulled && (isCompleted || isApproved);

  // Use refetched order outstanding when opening "Pay order" modal to avoid stale amount
  const orderForAmount =
    paymentType === "order" && orderForPaymentModal
      ? orderForPaymentModal
      : order;
  const totalOutstanding =
    isCreditOrder && orderForAmount.credit
      ? orderForAmount.credit.outstandingAmount
      : 0;

  // Check if there are pending/partial/overdue installments
  // Only APPROVED orders can be paid
  const hasPayableInstallments =
    isApproved &&
    isCreditOrder &&
    order.credit &&
    order.credit.installments &&
    order.credit.installments.some(
      inst =>
        inst.status === "PENDING" ||
        inst.status === "PARTIAL" ||
        inst.status === "OVERDUE"
    );

  // Check if any mutation is currently executing
  const isAnyMutationPending =
    approveOrderMutation.isPending ||
    payOrderMutation.isPending ||
    payInstallmentMutation.isPending ||
    exportReceiptMutation.isPending ||
    annulOrderMutation.isPending;

  const handleAnnulOrder = useCallback(async () => {
    // Validate that order can be annulled (COMPLETED or APPROVED)
    if (!isCompleted && !isApproved) {
      toast({
        title: t("toast.error"),
        description:
          t("table.annulDisabledStatus") ||
          "Only completed or approved orders can be annulled",
        type: "error",
      });
      return;
    }

    const confirmed = await confirmationDialog.openDialog({
      title: t("confirm.annulTitle"),
      description: t("confirm.annulDesc", {
        orderNumber: order.orderNumber,
      }),
      confirmText: t("confirm.annulButton"),
      cancelText: t("confirm.cancel"),
    });

    if (confirmed) {
      try {
        await annulOrderMutation.mutateAsync(order.id);
        toast({
          title: t("toast.success"),
          description: t("toast.annulled"),
          type: "success",
        });
        // Refresh the page to show updated status
        router.refresh();
        router.back();
      } catch (error) {
        toast({
          title: t("toast.error"),
          description:
            error instanceof Error ? error.message : t("toast.annulFailed"),
          type: "error",
        });
      }
    }
  }, [
    confirmationDialog,
    annulOrderMutation,
    toast,
    t,
    order,
    router,
    isCompleted,
    isApproved,
  ]);

  const handleApproveOrder = useCallback(async () => {
    const confirmed = await confirmationDialog.openDialog({
      title: t("confirm.approveTitle"),
      description: t("confirm.approveDesc", {
        orderNumber: order.orderNumber,
      }),
      confirmText: t("confirm.approveButton"),
      cancelText: t("confirm.cancel"),
    });

    if (confirmed) {
      try {
        await approveOrderMutation.mutateAsync(order.id);
        toast({
          title: t("toast.success"),
          description: t("toast.approved"),
          type: "success",
        });
        // Refresh the page to show updated status
        router.refresh();
      } catch (error) {
        toast({
          title: t("toast.error"),
          description:
            error instanceof Error ? error.message : t("toast.approveFailed"),
          type: "error",
        });
      }
    }
  }, [confirmationDialog, approveOrderMutation, toast, t, order, router]);

  const getStatusBadgeColor = () => {
    if (isAnnulled) {
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
    }
    if (isPending) {
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
    if (order.status === "APPROVED") {
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
    return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  };

  const getStatusLabel = () => {
    if (isAnnulled) return t("table.annulled");
    if (isPending) return t("table.pending");
    if (order.status === "APPROVED") return t("table.approved");
    return t("table.completed");
  };

  // Helper function to translate payment types
  const getPaymentTypeLabel = (paymentType: string) => {
    const upperType = paymentType.toUpperCase();
    switch (upperType) {
      case "CASH":
        return t("payment.cash");
      case "CARD":
        return t("payment.card");
      case "TRANSFER":
        return t("payment.transfer");
      case "DOWN_PAYMENT":
        return t("payment.downPayment");
      case "CREDIT_PAYMENT":
        return t("payment.creditPayment");
      default:
        return paymentType;
    }
  };

  // Helper function to translate credit statuses
  const getCreditStatusLabel = (status: string) => {
    const upperStatus = status.toUpperCase();
    switch (upperStatus) {
      case "ACTIVE":
        return t("view.active", "Activo");
      case "PENDING":
        return t("view.pending", "Pendiente");
      case "APPROVED":
        return t("view.approved", "Aprobado");
      case "REJECTED":
        return t("view.rejected", "Rechazado");
      case "PAID":
        return t("view.paid", "Pagado");
      case "ANNULLED":
        return t("view.annulled", "Anulado");
      default:
        return status;
    }
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

  // Handle annul item
  const handleAnnulItem = useCallback(
    (item: OrderItemWithKit) => {
      const remaining = item.quantity - (item.annulledQuantity || 0);
      if (remaining <= 0) return;

      // Kit Integrity Guard: Check if the item is a bundle and has components
      const product = item.productVariant?.product;
      const isKit = product?.type === "KIT";

      if (isKit) {
        const components = product?.kitItems;
        const hasComponents =
          Array.isArray(components) && components.length > 0;

        if (!hasComponents) {
          toast({
            title: t("toast.error"),
            description: t(
              "view.kitEmptyError",
              "Critical: This kit has no components defined in the database. Stock cannot be reverted."
            ),
            type: "error",
          });
          return;
        }

        // Deep Validation: Ensure all components have variant data to prevent server crashes
        if (!components.every(ki => ki.productVariant)) {
          toast({
            title: t("toast.error"),
            description: t(
              "view.kitIncompleteError",
              "Error: Some kit components are missing variant data."
            ),
            type: "error",
          });
          return;
        }
      }

      // Success: Set state to open the modal
      setSelectedItem(item);
      setAnnulItemModalOpen(true);
    },
    [t, toast]
  );

  const handleConfirmAnnulItem = useCallback(
    async (data: AnnulOrderItemRequest) => {
      if (!selectedItem) return;

      try {
        await annulOrderItemMutation.mutateAsync({
          orderId: order.id,
          orderItemId: selectedItem.id,
          data,
        });
        toast({
          title: t("toast.success"),
          description: t("toast.itemAnnulled", "Item anulado exitosamente"),
          type: "success",
        });
        setAnnulItemModalOpen(false);
        setSelectedItem(null);
        router.refresh();
      } catch (error) {
        toast({
          title: t("toast.error"),
          description:
            error instanceof Error
              ? error.message
              : t("toast.annulItemFailed", "Error al anular el item"),
          type: "error",
        });
      }
    },
    [selectedItem, annulOrderItemMutation, toast, t, order.id, router]
  );

  // Handle bulk annul items
  const handleBulkAnnulItems = useCallback(() => {
    setBulkAnnulModalOpen(true);
  }, []);

  const handleConfirmBulkAnnulItems = useCallback(
    async (data: BulkAnnulOrderItemsRequest) => {
      try {
        await bulkAnnulOrderItemsMutation.mutateAsync({
          orderId: order.id,
          data,
        });
        toast({
          title: t("toast.success"),
          description: t(
            "toast.itemsAnnulled",
            `${data.items.length} items anulados exitosamente`
          ),
          type: "success",
        });
        setBulkAnnulModalOpen(false);
        router.refresh();
      } catch (error) {
        toast({
          title: t("toast.error"),
          description:
            error instanceof Error
              ? error.message
              : t("toast.bulkAnnulItemsFailed", "Error al anular los items"),
          type: "error",
        });
      }
    },
    [bulkAnnulOrderItemsMutation, toast, t, order.id, router]
  );

  // Handle installment payment
  const handlePayInstallment = useCallback(
    async (installmentId: string, amount: number, paidAmount: number) => {
      setSelectedInstallment({ id: installmentId, amount, paidAmount });
      setPaymentType("installment");
      setPaymentModalOpen(true);
    },
    []
  );

  // Handle full order payment: refetch order so modal shows current outstanding
  const handlePayOrder = useCallback(async () => {
    setSelectedInstallment(null);
    setPaymentType("order");
    try {
      const freshOrder = await getOrder(order.id);
      setOrderForPaymentModal(freshOrder);
    } catch {
      setOrderForPaymentModal(null);
    }
    setPaymentModalOpen(true);
  }, [order.id]);

  // Confirm installment payment
  const handleConfirmInstallmentPayment = useCallback(
    async (payments: PaymentItem[]) => {
      if (!selectedInstallment) return;

      // Validate that order is APPROVED
      if (!isApproved) {
        toast({
          title: t("toast.error"),
          description:
            t("payment.onlyApprovedOrders") ||
            "Only approved orders can be paid",
          type: "error",
        });
        return;
      }

      try {
        const firstPayment = payments[0];
        if (!firstPayment) return;

        const paymentData: PayInstallmentRequest = {
          installmentId: selectedInstallment.id,
          amount: payments.reduce((sum, p) => sum + p.amount, 0),
          paymentType: firstPayment.paymentType,
          ...(firstPayment.provider && { provider: firstPayment.provider }),
          ...(firstPayment.transactionReference && {
            transactionReference: firstPayment.transactionReference,
          }),
        };

        await payInstallmentMutation.mutateAsync({
          orderId: order.id,
          installmentId: selectedInstallment.id,
          data: paymentData,
        });

        // Generate and download receipt
        try {
          const receipt = await exportInstallmentReceiptMutation.mutateAsync(
            selectedInstallment.id
          );
          downloadPdf(receipt.base64, receipt.fileName);
        } catch (error) {
          console.error("Error generating receipt:", error);
        }

        toast({
          title: t("toast.success"),
          description:
            t("payment.installmentPaid") || "Installment paid successfully",
          type: "success",
        });

        setPaymentModalOpen(false);
        router.refresh();
      } catch (error) {
        toast({
          title: t("toast.error"),
          description:
            error instanceof Error
              ? error.message
              : t("payment.paymentFailed") || "Payment failed",
          type: "error",
        });
      }
    },
    [
      selectedInstallment,
      payInstallmentMutation,
      exportInstallmentReceiptMutation,
      downloadPdf,
      toast,
      t,
      order.id,
      router,
      isApproved,
    ]
  );

  // Confirm full order payment
  const handleConfirmOrderPayment = useCallback(
    async (payments: PaymentItem[]) => {
      // Validate that order is APPROVED
      if (!isApproved) {
        toast({
          title: t("toast.error"),
          description:
            t("payment.onlyApprovedOrders") ||
            "Only approved orders can be paid",
          type: "error",
        });
        return;
      }

      try {
        await payOrderMutation.mutateAsync({
          orderId: order.id,
          data: { payments },
        });

        // Generate and download receipt
        try {
          const receipt = await exportReceiptMutation.mutateAsync(order.id);
          downloadPdf(receipt.base64, receipt.fileName);
        } catch (error) {
          console.error("Error generating receipt:", error);
        }

        toast({
          title: t("toast.success"),
          description: t("payment.orderPaid") || "Order paid successfully",
          type: "success",
        });
        router.refresh();
      } catch (error) {
        toast({
          title: t("toast.error"),
          description:
            error instanceof Error
              ? error.message
              : t("payment.paymentFailed") || "Payment failed",
          type: "error",
        });
      } finally {
        setPaymentModalOpen(false);
      }
    },
    [
      payOrderMutation,
      exportReceiptMutation,
      downloadPdf,
      toast,
      t,
      order.id,
      router,
      isApproved,
    ]
  );

  const openReversePaymentModal = useCallback(
    (payment: {
      id: string;
      amount: number;
      creditInstallmentId?: string | null;
    }) => {
      setReversePaymentTarget(payment);
      setReversePaymentModalOpen(true);
    },
    []
  );

  const handleReversePaymentConfirm = useCallback(
    async (reason: string) => {
      if (!reversePaymentTarget) return;
      const payment = reversePaymentTarget;
      const manualEntries = payment.creditInstallmentId
        ? [
            {
              targetType: "INSTALLMENT" as const,
              creditInstallmentId: payment.creditInstallmentId,
              amount: payment.amount,
            },
          ]
        : [{ targetType: "OPENING_BALANCE" as const, amount: payment.amount }];

      try {
        const autoResult = await reversePaymentMutation.mutateAsync({
          orderId: order.id,
          paymentId: payment.id,
          data: { reason },
        });

        if ((autoResult as { manualRequired?: boolean })?.manualRequired) {
          setReversePaymentModalOpen(false);
          await manualReversePaymentMutation.mutateAsync({
            orderId: order.id,
            paymentId: payment.id,
            data: {
              reason,
              entries: manualEntries,
            },
          });
          toast({
            title: t("toast.success"),
            description:
              t("payment.reverseManualSuccess") ||
              "Reversión manual contable aplicada",
            type: "success",
          });
          setReversePaymentTarget(null);
          router.refresh();
          return;
        }
        toast({
          title: t("toast.success"),
          description:
            t("payment.reverseSuccess") || "Pago revertido correctamente",
          type: "success",
        });
        setReversePaymentModalOpen(false);
        setReversePaymentTarget(null);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo revertir el pago";
        const isLegacy = shouldFallbackToManualReversal(error);
        if (!isLegacy) {
          toast({
            title: t("toast.error"),
            description: message,
            type: "error",
          });
          return;
        }

        setReversePaymentModalOpen(false);

        try {
          await manualReversePaymentMutation.mutateAsync({
            orderId: order.id,
            paymentId: payment.id,
            data: {
              reason,
              entries: manualEntries,
            },
          });
          toast({
            title: t("toast.success"),
            description:
              t("payment.reverseManualSuccess") ||
              "Reversión manual contable aplicada",
            type: "success",
          });
        } catch (manualErr) {
          toast({
            title: t("toast.error"),
            description:
              manualErr instanceof Error
                ? manualErr.message
                : "Error en reversión manual",
            type: "error",
          });
        } finally {
          setReversePaymentTarget(null);
          router.refresh();
        }
      }
    },
    [
      manualReversePaymentMutation,
      order.id,
      reversePaymentMutation,
      reversePaymentTarget,
      router,
      t,
      toast,
    ]
  );

  return (
    <div className="space-y-6 pb-6">
      {/* Top Header Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
                {t("view.title")}
              </h1>
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-lg font-semibold text-[#ff48b0] sm:text-xl">
                  {order.orderNumber}
                </span>
                <Badge
                  variant={isAnnulled ? "error" : "primary"}
                  className={getStatusBadgeColor()}
                >
                  {getStatusLabel()}
                </Badge>
              </div>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="primary"
                size="sm"
                className="flex w-full items-center gap-2 sm:w-auto"
              >
                <DotsHorizontalIcon className="h-4 w-4" />
                <span>{t("view.actions")}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {canApprove && (
                <DropdownMenuItem
                  onClick={handleApproveOrder}
                  disabled={isAnyMutationPending}
                  className="flex items-center gap-2 text-green-600 focus:text-green-700"
                >
                  <CheckCircledIcon className="h-4 w-4" />
                  <span>
                    {approveOrderMutation.isPending
                      ? t("common.loading") || "Loading..."
                      : t("table.approve")}
                  </span>
                </DropdownMenuItem>
              )}
              {isApproved &&
                isCreditOrder &&
                hasPayableInstallments &&
                (canApprove || canManageOrders) && (
                  <>
                    {canApprove && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      onClick={handlePayOrder}
                      disabled={isAnyMutationPending}
                      className="flex items-center gap-2 text-blue-600 focus:text-blue-700"
                    >
                      <CheckCircledIcon className="h-4 w-4" />
                      <span>
                        {payOrderMutation.isPending
                          ? t("common.loading") || "Loading..."
                          : t("payment.payOrder") || "Pay Order"}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
              {(canApprove ||
                (isApproved &&
                  isCreditOrder &&
                  hasPayableInstallments &&
                  (canApprove || canManageOrders))) && (
                <DropdownMenuSeparator />
              )}
              <DropdownMenuItem
                onClick={async () => {
                  try {
                    const result = await exportReceiptMutation.mutateAsync(
                      order.id
                    );
                    downloadPdf(result.base64, result.fileName);
                    toast({
                      title: t("toast.success"),
                      description:
                        t("view.exportPdf") || "Receipt exported successfully",
                      type: "success",
                    });
                  } catch (error) {
                    toast({
                      title: t("toast.error"),
                      description:
                        error instanceof Error
                          ? error.message
                          : t("toast.error") || "Failed to export receipt",
                      type: "error",
                    });
                  }
                }}
                disabled={isAnyMutationPending}
                className="flex items-center gap-2 text-purple-600 focus:text-purple-700"
              >
                <BiPrinter className="h-4 w-4" />
                <span>
                  {exportReceiptMutation.isPending
                    ? t("common.loading") || "Loading..."
                    : t("view.exportPdf") || "Export Receipt PDF"}
                </span>
              </DropdownMenuItem>
              {canAnnul &&
                order.items &&
                order.items.some(
                  item => item.quantity - (item.annulledQuantity || 0) > 0
                ) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleBulkAnnulItems}
                      disabled={isAnyMutationPending}
                      className="flex items-center gap-2 text-orange-600 focus:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CrossCircledIcon className="h-4 w-4" />
                      <span>
                        {bulkAnnulOrderItemsMutation.isPending
                          ? t("common.loading") || "Loading..."
                          : t("view.bulkAnnulItems") || "Anular Items"}
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
              {canAnnul && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleAnnulOrder}
                    disabled={isAnyMutationPending}
                    className="flex items-center gap-2 text-red-600 focus:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <CrossCircledIcon className="h-4 w-4" />
                    <span>
                      {annulOrderMutation.isPending
                        ? t("common.loading") || "Loading..."
                        : t("table.annul")}
                    </span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Annulment Statistics Card */}
      {annulmentStats.annulledItems > 0 && (
        <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-6 shadow-sm dark:border-orange-800 dark:from-orange-900/20 dark:to-amber-900/20">
          <div className="mb-4 flex items-center gap-2">
            <BiInfoCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t("view.annulmentStatistics")}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                {t("view.totalItems")}
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {annulmentStats.totalItems}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                {t("view.annulledItems")}
              </div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {annulmentStats.annulledItems}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                {t("view.fullyAnnulled")}
              </div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {annulmentStats.fullyAnnulledItems}
              </div>
            </div>
            <div>
              <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                {t("view.annulledAmount")}
              </div>
              <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(annulmentStats.totalAnnulledAmount)}
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                ({annulmentStats.annulmentPercentage.toFixed(1)}%{" "}
                {t("view.ofTotal")})
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Boxes - Horizontal Layout */}
      <div
        className={`grid grid-cols-1 gap-6 ${
          isCreditOrder &&
          order.credit &&
          order.credit.installments &&
          order.credit.installments.length > 0
            ? "md:grid-cols-2 lg:grid-cols-3"
            : isCreditOrder && order.credit
              ? "md:grid-cols-2"
              : "lg:grid-cols-1"
        }`}
      >
        {/* Order Info & Summary Box */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 border-b border-gray-200 pb-3 text-lg font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
            {t("view.information")}
          </h2>
          <div className="mb-6 space-y-3 text-sm">
            <div>
              <span className="mb-1 block text-gray-600 dark:text-gray-400">
                {t("view.orderNumber")}:
              </span>
              <span className="font-mono font-medium text-gray-900 dark:text-white">
                {order.orderNumber}
              </span>
            </div>
            <div>
              <span className="mb-1 block text-gray-600 dark:text-gray-400">
                {t("view.date")}:
              </span>
              <span className="text-gray-900 dark:text-white">
                {order.createdAt
                  ? new Date(order.createdAt).toLocaleDateString()
                  : "N/A"}
              </span>
            </div>
            {order.customer && (
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.customer")}:
                </span>
                <Link
                  href={`/sales/customers/${order.customer.id}/statement`}
                  className="font-medium text-gray-900 text-primary-600 underline-offset-2 transition-colors hover:underline dark:text-white dark:hover:text-primary-400"
                >
                  {order.customer.name}
                </Link>
              </div>
            )}
            {order.location && (
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.location")}:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {order.location.name}
                </span>
              </div>
            )}
            {order.cashier && (
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.cashier")}:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {order.cashier.name}
                </span>
              </div>
            )}
            {order.seller && (
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.seller")}:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {order.seller.name}
                </span>
              </div>
            )}
            <div>
              <span className="mb-1 block text-gray-600 dark:text-gray-400">
                {t("view.paymentMethod") || "Payment Method"}:
              </span>
              <Badge
                variant="secondary"
                className={
                  order.paymentMethod === "CREDIT"
                    ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                }
              >
                {order.paymentMethod === "CREDIT"
                  ? t("view.credit") || "Credit"
                  : t("view.cash") || "Cash"}
              </Badge>
            </div>
          </div>

          {/* Summary Section */}
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              {t("view.summary")}
            </h3>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  {t("view.subtotal")}
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {formatCurrency(order.subtotal)}
                </span>
              </div>
              {(() => {
                const itemsDiscount = order.itemsDiscountTotal ?? 0;
                return itemsDiscount > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t("view.itemsDiscount")}
                    </span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      - {formatCurrency(itemsDiscount)}
                    </span>
                  </div>
                ) : null;
              })()}
              {(() => {
                const discountCode = order.discountCodeValue ?? 0;
                return discountCode > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t("view.discountCode")}
                    </span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      - {formatCurrency(discountCode)}
                    </span>
                  </div>
                ) : null;
              })()}
              {(() => {
                const manualDiscount = order.manualDiscount ?? 0;
                return manualDiscount > 0 ? (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">
                      {t("view.manualDiscount")}
                    </span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      - {formatCurrency(manualDiscount)}
                    </span>
                  </div>
                ) : null;
              })()}
              {order.taxes > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    {t("view.taxes")}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatCurrency(order.taxes)}
                  </span>
                </div>
              )}
              <div className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t("view.total")}
                  </span>
                  <span className="text-xl font-bold text-[#ff48b0]">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Credit Information Box */}
        {isCreditOrder && order.credit && (
          <div className="rounded-xl border p-6 shadow-sm">
            <h2 className="mb-4 border-b pb-3 text-lg font-semibold text-gray-900 dark:text-white">
              {t("view.creditInformation") || "Credit Information"}
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.creditType") || "Credit Type"}:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {order.credit.creditType === "SHORT_TERM"
                    ? t("view.shortTerm") || "Short Term"
                    : order.credit.creditType === "EMPLOYEE_CREDIT"
                      ? t("view.employeeCredit") || "Employee Credit"
                      : t("view.promotional") || "Promotional"}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.paymentFrequency") || "Payment Frequency"}:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {order.credit.paymentFrequency === "WEEKLY"
                    ? t("view.weekly") || "Weekly"
                    : order.credit.paymentFrequency === "BI_WEEKLY"
                      ? t("view.biWeekly") || "Bi-Weekly"
                      : t("view.monthly") || "Monthly"}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.principalAmount") || "Principal Amount"}:
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(order.credit.principalAmount)}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.outstandingAmount") || "Outstanding Amount"}:
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(order.credit.outstandingAmount)}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.installmentCount") || "Installments"}:
                </span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {order.credit.installmentCount}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.firstDueDate") || "First Due Date"}:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {order.credit.firstDueDate
                    ? format(new Date(order.credit.firstDueDate), "dd/MM/yyyy")
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.lastDueDate") || "Last Due Date"}:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {order.credit.lastDueDate
                    ? format(new Date(order.credit.lastDueDate), "dd/MM/yyyy")
                    : "N/A"}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-gray-600 dark:text-gray-400">
                  {t("view.creditStatus") || "Credit Status"}:
                </span>
                <Badge
                  variant={
                    order.credit.status === "ACTIVE" ? "primary" : "secondary"
                  }
                  className={
                    order.credit.status === "ACTIVE"
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : order.credit.status === "ANNULLED"
                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        : order.credit.status === "PAID"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : order.credit.status === "REJECTED"
                            ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                  }
                >
                  {getCreditStatusLabel(order.credit.status)}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Installment Schedule Box */}
        {isCreditOrder &&
          order.credit &&
          order.credit.installments &&
          order.credit.installments.length > 0 && (
            <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 pb-3 text-lg font-semibold text-gray-900 dark:text-white">
                {t("view.installments") || "Installments"}
              </h2>
              <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
                {order.credit.installments.map(installment => (
                  <div
                    key={installment.id}
                    className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#ff48b0]/10 text-sm font-semibold text-[#ff48b0]">
                          {installment.installmentNo}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {t("view.installment") || "Installment"}{" "}
                            {installment.installmentNo}
                          </div>
                          <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                            {format(
                              new Date(installment.dueDate),
                              "dd/MM/yyyy"
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(installment.amount)}
                        </div>
                        {installment.paidAmount > 0 && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {t("view.paid") || "Paid"}:{" "}
                            {formatCurrency(installment.paidAmount)}
                          </div>
                        )}
                        {installment.paidAmount > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-1 h-6 w-6 p-0"
                            onClick={async e => {
                              e.stopPropagation();
                              try {
                                const receipt =
                                  await exportInstallmentReceiptMutation.mutateAsync(
                                    installment.id
                                  );
                                downloadPdf(receipt.base64, receipt.fileName);
                                toast({
                                  title: t("toast.success"),
                                  description:
                                    t("view.receiptExported") ||
                                    "Receipt exported successfully",
                                  type: "success",
                                });
                              } catch (error) {
                                toast({
                                  title: t("toast.error"),
                                  description:
                                    error instanceof Error
                                      ? error.message
                                      : t("view.receiptExportFailed") ||
                                        "Failed to export receipt",
                                  type: "error",
                                });
                              }
                            }}
                            title={
                              t("view.reprintReceipt") || "Reprint Receipt"
                            }
                          >
                            <BiPrinter className="h-3 w-3" />
                          </Button>
                        )}
                        <Badge
                          variant={
                            installment.status === "PAID"
                              ? "primary"
                              : "secondary"
                          }
                          className={
                            installment.status === "PAID"
                              ? "mt-1 bg-green-100 text-xs text-green-800 dark:bg-green-900 dark:text-green-200"
                              : installment.status === "ANNULLED"
                                ? "mt-1 bg-red-100 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
                                : isInstallmentOverdue(installment)
                                  ? "mt-1 bg-red-100 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
                                  : "mt-1 bg-yellow-100 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }
                        >
                          {installment.status === "PAID"
                            ? t("view.paid") || "Paid"
                            : installment.status === "ANNULLED"
                              ? t("view.annulled") || "Annulled"
                              : isInstallmentOverdue(installment)
                                ? t("view.overduePayment") || "Overdue Payment"
                                : installment.status === "PENDING"
                                  ? t("view.pending") || "Pending"
                                  : installment.status === "PARTIAL"
                                    ? t("view.partial") || "Partial"
                                    : installment.status === "OVERDUE"
                                      ? t("view.overdue") || "Overdue"
                                      : installment.status}
                        </Badge>
                        {(installment.status === "PENDING" ||
                          installment.status === "PARTIAL" ||
                          installment.status === "OVERDUE" ||
                          isInstallmentOverdue(installment)) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 w-full text-xs"
                            onClick={() =>
                              handlePayInstallment(
                                installment.id,
                                installment.amount,
                                installment.paidAmount
                              )
                            }
                            disabled={
                              !isApproved ||
                              payInstallmentMutation.isPending ||
                              payOrderMutation.isPending
                            }
                            title={
                              !isApproved
                                ? t("payment.onlyApprovedOrders") ||
                                  "Only approved orders can be paid"
                                : undefined
                            }
                          >
                            {payInstallmentMutation.isPending
                              ? t("common.loading") || "Loading..."
                              : t("payment.pay") || "Pay"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Order Items Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t("view.items")}
          </h2>
          {annulmentStats.fullyAnnulledItems > 0 && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Checkbox
                checked={showFullyAnnulled}
                onCheckedChange={checked =>
                  setShowFullyAnnulled(checked === true)
                }
              />
              <span>{t("view.showFullyAnnulled")}</span>
            </label>
          )}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            <div className="space-y-4">
              {filteredItems.map(item => {
                const annulledQuantity = item.annulledQuantity || 0;
                const remainingQuantity = item.quantity - annulledQuantity;
                const isFullyAnnulled = annulledQuantity === item.quantity;
                const isPartiallyAnnulled =
                  annulledQuantity > 0 && annulledQuantity < item.quantity;
                const annulledAmount = item.annulledAmount || 0;
                // Detect if item is a kit
                const isKit =
                  item.productVariant?.product?.type === "KIT" &&
                  Array.isArray(item.productVariant?.product?.kitItems) &&
                  item.productVariant.product.kitItems.length > 0;

                return (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-4 rounded-lg border p-4 transition-shadow sm:flex-row sm:items-center sm:justify-between ${
                      isFullyAnnulled
                        ? "border-red-200 bg-red-50 dark:border-red-700 dark:bg-red-900/50"
                        : isPartiallyAnnulled
                          ? "border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/10"
                          : "border-gray-200 bg-gray-50 hover:shadow-md dark:border-gray-700 dark:bg-gray-900/50"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start gap-2">
                        <div
                          className={`mb-1 font-semibold ${
                            isFullyAnnulled
                              ? "text-gray-500 line-through dark:text-gray-500"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {item.productVariant?.name ||
                            item.productVariant?.product?.name ||
                            t("view.unknownProduct")}
                          {(() => {
                            const sku = item.productVariant?.sku;
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
                                            title: t("toast.success"),
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
                        {(isFullyAnnulled || isPartiallyAnnulled) && (
                          <Badge
                            variant={isFullyAnnulled ? "error" : "warning"}
                            className="shrink-0 text-xs"
                          >
                            {isFullyAnnulled
                              ? t("view.fullyAnnulledBadge")
                              : t("view.partiallyAnnulled")}
                          </Badge>
                        )}
                      </div>
                      {item.productVariant?.product?.brand && (
                        <div className="mb-1 text-sm text-gray-500 dark:text-gray-400">
                          {item.productVariant.product.brand.name}
                        </div>
                      )}
                      {/* KIT COMPONENTS DISPLAY */}
                      {isKit && item.productVariant?.product?.kitItems && (
                        <div className="mb-3 mt-2 rounded-lg border border-dashed border-gray-300 bg-gray-50/80 p-3 dark:border-gray-700 dark:bg-black/20">
                          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
                            <BiInfoCircle className="h-3 w-3" />
                            {t("view.kitContent", "Contenido del Kit")}
                          </div>
                          <div className="grid grid-cols-1 gap-1">
                            {item.productVariant.product.kitItems.map(
                              (ki, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-xs"
                                >
                                  <span className="italic text-gray-600 dark:text-gray-400">
                                    •{" "}
                                    {ki.productVariant?.name ||
                                      "Unknown component"}
                                  </span>
                                  <span className="shrink-0 font-mono font-semibold text-[#ff48b0]">
                                    {ki.quantity * remainingQuantity} un.
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">
                            {t("view.quantity")}:
                          </span>
                          <div className="flex items-center gap-1">
                            {annulledQuantity > 0 ? (
                              <>
                                {remainingQuantity > 0 && (
                                  <span className="font-semibold text-gray-900 dark:text-white">
                                    {remainingQuantity}
                                  </span>
                                )}
                                {remainingQuantity > 0 &&
                                  annulledQuantity > 0 && (
                                    <span className="text-gray-400">/</span>
                                  )}
                                <span className="text-orange-600 line-through dark:text-orange-400">
                                  {annulledQuantity}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400">
                                  ({t("view.total")}: {item.quantity})
                                </span>
                              </>
                            ) : (
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {item.quantity}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-gray-400">×</span>
                        <span className="text-gray-600 dark:text-gray-300">
                          {formatCurrency(item.unitPrice)}
                        </span>
                        {item.discountAmount > 0 && (
                          <span className="font-medium text-red-600 dark:text-red-400">
                            - {formatCurrency(item.discountAmount)}{" "}
                            {t("view.discount")}
                          </span>
                        )}
                        {item.taxAmount > 0 && (
                          <span className="text-gray-500 dark:text-gray-400">
                            {t("view.tax")}: {formatCurrency(item.taxAmount)}
                          </span>
                        )}
                      </div>
                      {annulledAmount > 0 && (
                        <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                          {t("view.annulledAmount")}:{" "}
                          <span className="font-medium">
                            {formatCurrency(annulledAmount)}
                          </span>
                        </div>
                      )}
                      {/* Annulment History/Details */}
                      {item.annulments && item.annulments.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleAnnulmentDetails(item.id)}
                            className="flex items-center gap-1 text-xs text-orange-600 transition-colors hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                          >
                            {expandedAnnulments.has(item.id) ? (
                              <BiChevronUp className="h-4 w-4" />
                            ) : (
                              <BiChevronDown className="h-4 w-4" />
                            )}
                            <span>
                              {t("view.annulmentHistory")} (
                              {item.annulments.length})
                            </span>
                          </button>
                          {expandedAnnulments.has(item.id) && (
                            <div className="mt-2 space-y-2 border-l-2 border-orange-200 pl-4 dark:border-orange-800">
                              {item.annulments.map(annulment => {
                                // Calculate breakdown for transparency
                                const proportion =
                                  annulment.quantity / item.quantity;
                                const grossAmount =
                                  item.unitPrice * annulment.quantity;
                                const proportionalDiscount =
                                  (item.discountAmount || 0) * proportion;
                                const proportionalTax =
                                  (item.taxAmount || 0) * proportion;
                                const hasDiscount = proportionalDiscount > 0;
                                const hasTax = proportionalTax > 0;

                                return (
                                  <div
                                    key={annulment.id}
                                    className={
                                      annulment.quantity === item.quantity
                                        ? "rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-700 dark:bg-red-900/50"
                                        : "rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs dark:border-orange-800 dark:bg-orange-900/10"
                                    }
                                  >
                                    <div className="mb-2 flex items-start justify-between gap-2">
                                      <div className="font-medium text-gray-900 dark:text-white">
                                        {t("view.quantity", "Quantity")}:{" "}
                                        {annulment.quantity} ×{" "}
                                        {formatCurrency(item.unitPrice)}
                                      </div>
                                      <div className="text-gray-500 dark:text-gray-400">
                                        {format(
                                          new Date(annulment.createdAt),
                                          "dd/MM/yyyy HH:mm"
                                        )}
                                      </div>
                                    </div>

                                    {/* Breakdown */}
                                    <div className="mb-2 space-y-1 border-l-2 border-gray-200 pl-2 dark:border-gray-700">
                                      <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                                        <span>
                                          {t("view.grossAmount", "Monto bruto")}
                                          :
                                        </span>
                                        <span className="font-medium">
                                          {formatCurrency(grossAmount)}
                                        </span>
                                      </div>
                                      {hasDiscount && (
                                        <div className="flex items-center justify-between text-green-600 dark:text-green-400">
                                          <span>
                                            {t(
                                              "view.discountReversed",
                                              "Descuento revertido"
                                            )}
                                            :
                                          </span>
                                          <span className="font-medium">
                                            -{" "}
                                            {formatCurrency(
                                              proportionalDiscount
                                            )}
                                          </span>
                                        </div>
                                      )}
                                      {hasTax && (
                                        <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                                          <span>
                                            {t(
                                              "view.taxReversed",
                                              "Impuesto revertido"
                                            )}
                                            :
                                          </span>
                                          <span className="font-medium">
                                            + {formatCurrency(proportionalTax)}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between border-t border-gray-300 pt-1 font-semibold text-gray-900 dark:border-gray-600 dark:text-white">
                                        <span>
                                          {t("view.netAmount", "Monto neto")}:
                                        </span>
                                        <span>
                                          {formatCurrency(annulment.amount)}
                                        </span>
                                      </div>
                                    </div>

                                    {annulment.reason && (
                                      <div className="mb-1 text-gray-600 dark:text-gray-300">
                                        {t("view.reason")}:{" "}
                                        <span className="italic">
                                          {annulment.reason}
                                        </span>
                                      </div>
                                    )}
                                    {annulment.creator && (
                                      <div className="text-gray-500 dark:text-gray-400">
                                        {t("view.annulledBy")}:{" "}
                                        {annulment.creator.name}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-2 text-left sm:text-right">
                      <div className="flex flex-col items-end gap-1">
                        {remainingQuantity > 0 && (
                          <div className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(
                              (item.lineTotal * remainingQuantity) /
                                item.quantity
                            )}
                          </div>
                        )}
                        {annulledAmount > 0 && (
                          <div className="text-sm text-orange-600 line-through dark:text-orange-400">
                            {formatCurrency(annulledAmount)}
                          </div>
                        )}
                        {remainingQuantity === 0 && (
                          <div className="text-xl font-bold text-gray-400 line-through dark:text-gray-500">
                            {formatCurrency(item.lineTotal)}
                          </div>
                        )}
                      </div>
                      {remainingQuantity > 0 &&
                        (order.status === "COMPLETED" ||
                          order.status === "APPROVED") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAnnulItem(item)}
                            className="text-xs"
                          >
                            {t("view.annulItem", "Anular Item")}
                          </Button>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Payments Section */}
      {order.payments && order.payments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 border-b border-gray-200 pb-3 text-xl font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
            {t("view.payments")}
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {order.payments.map(payment => (
              <div
                key={payment.id}
                className="rounded-lg border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 dark:border-green-800 dark:from-green-900/20 dark:to-emerald-900/20"
              >
                <div className="mb-2 flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {getPaymentTypeLabel(payment.paymentType)}
                      </div>
                      {payment.status === "REVERSED" && (
                        <Badge
                          variant="error"
                          className="bg-red-100 text-xs text-red-800 dark:bg-red-900 dark:text-red-200"
                        >
                          {t("view.reversed", "Revertido")}
                        </Badge>
                      )}
                    </div>
                    {payment.provider && (
                      <div className="mb-1 text-sm text-gray-600 dark:text-gray-400">
                        {payment.provider}
                      </div>
                    )}
                    {payment.transactionReference && (
                      <div className="mb-2 break-all font-mono text-xs text-gray-500 dark:text-gray-500">
                        {payment.transactionReference}
                      </div>
                    )}
                    <div className="text-lg font-bold text-green-700 dark:text-green-400">
                      {formatCurrency(payment.amount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={async () => {
                        try {
                          const receipt =
                            await exportPaymentReceiptMutation.mutateAsync(
                              payment.id
                            );
                          downloadPdf(receipt.base64, receipt.fileName);
                          toast({
                            title: t("toast.success"),
                            description:
                              t("view.receiptExported") ||
                              "Receipt exported successfully",
                            type: "success",
                          });
                        } catch (error) {
                          toast({
                            title: t("toast.error"),
                            description:
                              error instanceof Error
                                ? error.message
                                : t("view.receiptExportFailed") ||
                                  "Failed to export receipt",
                            type: "error",
                          });
                        }
                      }}
                      title={t("view.reprintReceipt") || "Reprint Receipt"}
                    >
                      <BiPrinter className="h-4 w-4" />
                    </Button>
                    {payment.status !== "REVERSED" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() =>
                          openReversePaymentModal({
                            id: payment.id,
                            amount: payment.amount,
                            ...(payment.creditInstallmentId === undefined
                              ? {}
                              : {
                                  creditInstallmentId:
                                    payment.creditInstallmentId,
                                }),
                          })
                        }
                      >
                        Revertir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Order Adjustments Section */}
      {order.adjustments && order.adjustments.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="mb-4 border-b border-gray-200 pb-3 text-xl font-semibold text-gray-900 dark:border-gray-700 dark:text-white">
            {t("view.adjustments") || "Ajustes de Orden"}
          </h2>
          <div className="space-y-3">
            {order.adjustments.map(adjustment => {
              const isRefund = adjustment.type === "REFUND";
              const isCreditAdjustment =
                adjustment.type === "CREDIT_BALANCE_ADJUSTMENT";

              return (
                <div
                  key={adjustment.id}
                  className={`rounded-lg border p-4 ${
                    isRefund
                      ? "border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:border-blue-800 dark:from-blue-900/20 dark:to-indigo-900/20"
                      : isCreditAdjustment
                        ? "border-purple-200 bg-gradient-to-br from-purple-50 to-violet-50 dark:border-purple-800 dark:from-purple-900/20 dark:to-violet-900/20"
                        : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <Badge
                          variant={isRefund ? "primary" : "secondary"}
                          className={
                            isRefund
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : isCreditAdjustment
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                          }
                        >
                          {isRefund
                            ? t("view.refund") || "Reembolso"
                            : isCreditAdjustment
                              ? t("view.creditAdjustment") ||
                                "Ajuste de Crédito"
                              : adjustment.type}
                        </Badge>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {format(
                            new Date(adjustment.createdAt),
                            "dd/MM/yyyy HH:mm"
                          )}
                        </span>
                      </div>
                      {adjustment.reason && (
                        <div className="mb-2 text-sm text-gray-600 dark:text-gray-300">
                          {adjustment.reason}
                        </div>
                      )}
                      {adjustment.creator && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {t("view.createdBy") || "Creado por"}:{" "}
                          {adjustment.creator.name}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div
                        className={`text-xl font-bold ${
                          adjustment.amount >= 0
                            ? "text-green-700 dark:text-green-400"
                            : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {adjustment.amount >= 0 ? "+" : ""}
                        {formatCurrency(Math.abs(adjustment.amount))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmationDialog {...confirmationDialog.dialogProps} />

      <ReversePaymentModal
        isOpen={reversePaymentModalOpen}
        onClose={() => {
          if (
            reversePaymentMutation.isPending ||
            manualReversePaymentMutation.isPending
          ) {
            return;
          }
          setReversePaymentModalOpen(false);
          setReversePaymentTarget(null);
        }}
        onConfirm={handleReversePaymentConfirm}
        isLoading={
          reversePaymentMutation.isPending ||
          manualReversePaymentMutation.isPending
        }
        title={t("payment.reverseTitle") || "Revertir pago"}
        description={
          t("payment.reverseDescription") ||
          "Indique el motivo de la reversión."
        }
        reasonLabel={t("payment.reverseReasonLabel") || "Motivo"}
        confirmLabel={t("payment.reverseConfirm") || "Revertir pago"}
        cancelLabel={t("confirm.cancel") || "Cancelar"}
        {...(() => {
          const ph = t("payment.reverseReasonPlaceholder");
          const key = "payment.reverseReasonPlaceholder";
          return ph && ph !== key ? { reasonPlaceholder: ph } : {};
        })()}
        {...(reversePaymentTarget
          ? {
              amountSummary: `${t("payment.reverseAmountLabel") || "Monto"}: ${formatCurrency(reversePaymentTarget.amount)}`,
            }
          : {})}
      />

      {/* Payment Modal */}
      {/* Annul Item Modal */}
      {selectedItem && (
        <AnnulItemModal
          isOpen={annulItemModalOpen}
          onClose={() => {
            setAnnulItemModalOpen(false);
            setSelectedItem(null);
          }}
          onConfirm={handleConfirmAnnulItem}
          item={selectedItem}
          isLoading={annulOrderItemMutation.isPending}
          isCreditOrder={isCreditOrder}
        />
      )}

      {/* Bulk Annul Items Modal */}
      <BulkAnnulItemsModal
        isOpen={bulkAnnulModalOpen}
        onClose={() => setBulkAnnulModalOpen(false)}
        onConfirm={handleConfirmBulkAnnulItems}
        items={order.items || []}
        isLoading={bulkAnnulOrderItemsMutation.isPending}
        isCreditOrder={isCreditOrder}
        orderDiscountCodeValue={order.discountCodeValue || 0}
        orderManualDiscount={order.manualDiscount || 0}
        orderSubtotal={order.subtotal || 0}
      />

      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedInstallment(null);
          setPaymentType(null);
          setOrderForPaymentModal(null);
        }}
        onConfirm={
          paymentType === "installment"
            ? handleConfirmInstallmentPayment
            : handleConfirmOrderPayment
        }
        amount={
          paymentType === "installment" && selectedInstallment
            ? selectedInstallment.amount - selectedInstallment.paidAmount
            : totalOutstanding
        }
        title={
          paymentType === "installment"
            ? t("payment.payInstallment") || "Pay Installment"
            : t("payment.payOrder") || "Pay Order"
        }
        description={
          paymentType === "installment"
            ? t("payment.payInstallmentDesc") ||
              "Enter payment details for this installment"
            : t("payment.payOrderDesc") ||
              "Enter payment details to pay all pending installments"
        }
        isLoading={
          payInstallmentMutation.isPending || payOrderMutation.isPending
        }
      />
    </div>
  );
}

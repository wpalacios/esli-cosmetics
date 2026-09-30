"use client";

import {
  useCustomerAccountStatement,
  useCreateCustomerPayment,
  useCreateCustomerRefund,
  useManualReversePayment,
  useReversePayment,
  useExportPaymentReceiptPdf,
} from "@/hooks/use-customers";
import { formatShortDateInUserTimeZone } from "@/lib/report-export-meta";
import {
  AccountStatementCredit,
  AccountStatementResponse,
  AccountStatementTransaction,
} from "@esli-cosmetics/types";
import {
  Card,
  DataTable,
  Input,
  Button,
  SearchableSelect,
} from "@esli-cosmetics/ui";
import { cn, formatNicaraguanCurrency } from "@esli-cosmetics/utils";
import { usePageSizeParam } from "@/hooks/use-page-size-param";
import {
  CalendarIcon,
  FileTextIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "@radix-ui/react-icons";
import { ColumnDef } from "@tanstack/react-table";
import {
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FaArrowDown,
  FaArrowUp,
  FaCheckCircle,
  FaCreditCard,
  FaDollarSign,
} from "react-icons/fa";
import { BiPrinter } from "react-icons/bi";
import { useToast } from "@/hooks/toast/use-toast";
import { useRouter } from "next/navigation";
import { CustomerPaymentModal } from "./_components/customer-payment-modal";
import { CustomerRefundModal } from "./_components/customer-refund-modal";
import { CreateCustomerPaymentRequest } from "@/actions/customers";
import { ReversePaymentModal } from "../../../_components/reverse-payment-modal";

const MIGRATION_DATE = "2025-12-31";
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

// Date formatting helpers
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateToNumeric(d: Date): string {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatYmdToNumeric(ymd?: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const y = ymd.slice(0, 4);
  const m = ymd.slice(5, 7);
  const d = ymd.slice(8, 10);
  return `${d}/${m}/${y}`;
}

function DateFilterInput({
  placeholder,
  value,
  onChange,
  min,
  disabled,
}: {
  placeholder: string;
  value?: string;
  onChange: (next?: string) => void;
  min?: string;
  disabled?: boolean;
}) {
  const hiddenRef = useRef<HTMLInputElement | null>(null);

  const openPicker = () => {
    const el = hiddenRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  };

  return (
    <div className="relative">
      <input
        ref={hiddenRef}
        type="date"
        value={value ?? ""}
        onChange={e => onChange(e.target.value || undefined)}
        min={min}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
      />
      <Input
        type="text"
        readOnly
        placeholder={placeholder}
        value={value ? formatYmdToNumeric(value) : ""}
        onClick={openPicker}
        {...(disabled !== undefined && { disabled })}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
          if (e.key === "Escape") {
            onChange(undefined);
          }
        }}
      />
    </div>
  );
}

interface StatementPageClientProps {
  customer: any;
  initialStatement: AccountStatementResponse | null;
  customerId: string;
}

export function StatementPageClient({
  customer,
  initialStatement,
  customerId,
}: StatementPageClientProps) {
  const { t } = useTranslation("customers");
  const { toast } = useToast();
  const router = useRouter();
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [fromDate, setFromDate] = useState<string | undefined>(
    initialStatement ? undefined : MIGRATION_DATE
  );
  const [toDate, setToDate] = useState<string | undefined>(
    initialStatement ? undefined : format(new Date(), "yyyy-MM-dd")
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [creditsExpanded, setCreditsExpanded] = useState(false);
  const [transactionTypeFilter, setTransactionTypeFilter] =
    useState<string>("");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [reverseContext, setReverseContext] = useState<{
    paymentId: string;
    amount: number;
    installmentId?: string;
  } | null>(null);

  const createCustomerPaymentMutation = useCreateCustomerPayment();
  const createCustomerRefundMutation = useCreateCustomerRefund();
  const reversePaymentMutation = useReversePayment();
  const manualReversePaymentMutation = useManualReversePayment();
  const exportPaymentReceiptMutation = useExportPaymentReceiptPdf();

  const {
    data: statementData,
    isLoading,
    error,
  } = useCustomerAccountStatement(
    customerId,
    {
      ...(fromDate && { from: fromDate }),
      ...(toDate && { to: toDate }),
      page: currentPage,
      limit: pageSize,
      ...(transactionTypeFilter && { transactionType: transactionTypeFilter }),
    },
    {
      enabled: !!customerId,
    }
  );

  const statement = statementData || initialStatement;

  const todayNumeric = useMemo(() => formatDateToNumeric(new Date()), []);

  const handleDateChange = useCallback(
    (type: "from" | "to", value?: string) => {
      if (type === "from") {
        setFromDate(value || MIGRATION_DATE);
        setCurrentPage(1);
      } else {
        setToDate(value);
        setCurrentPage(1);
      }
    },
    []
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

  const handleTransactionTypeChange = useCallback((value: string) => {
    setTransactionTypeFilter(value);
    setCurrentPage(1);
  }, []);

  // Calculate outstanding amount from statement
  const outstandingAmount = useMemo(() => {
    return statement?.summary?.outstandingAmount || 0;
  }, [statement]);

  // Calculate opening balance from statement
  const openingBalance = useMemo(() => {
    return statement?.summary?.openingBalance || 0;
  }, [statement]);

  // Closing balance from the transaction ledger = opening + charges - payments.
  // This is the single source of truth and includes initial balance and all payments.
  const closingBalance = useMemo(() => {
    return statement?.summary?.closingBalance ?? 0;
  }, [statement]);

  // Amount due = when positive (customer owes). When negative, customer has credit.
  const totalPayable = useMemo(
    () => Math.max(0, closingBalance),
    [closingBalance]
  );

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

  // Handle customer payment
  const handleCustomerPayment = useCallback(
    async (data: CreateCustomerPaymentRequest) => {
      try {
        const result = await createCustomerPaymentMutation.mutateAsync({
          customerId,
          data,
        });

        // Generate and download receipt
        try {
          const receipt = await exportPaymentReceiptMutation.mutateAsync(
            result.payment.id
          );
          downloadPdf(receipt.base64, receipt.fileName);
        } catch (error) {
          console.error("Error generating receipt:", error);
        }

        toast({
          title: t("toast.success") || "Success",
          description:
            t("statement.paymentSuccess") || "Payment processed successfully",
          type: "success",
        });

        setPaymentModalOpen(false);
        router.refresh();
      } catch (error) {
        toast({
          title: t("toast.error") || "Error",
          description:
            error instanceof Error
              ? error.message
              : t("statement.paymentFailed") || "Payment failed",
          type: "error",
        });
      }
    },
    [
      customerId,
      createCustomerPaymentMutation,
      exportPaymentReceiptMutation,
      toast,
      t,
      router,
      downloadPdf,
    ]
  );

  const handleCustomerRefund = useCallback(
    async (data: CreateCustomerPaymentRequest) => {
      try {
        await createCustomerRefundMutation.mutateAsync({
          customerId,
          data,
        });
        toast({
          title: t("toast.success") || "Success",
          description:
            t("statement.refundSuccess") || "Refund recorded successfully",
          type: "success",
        });
        setRefundModalOpen(false);
        router.refresh();
      } catch (error) {
        toast({
          title: t("toast.error") || "Error",
          description:
            error instanceof Error
              ? error.message
              : t("statement.refundFailed") || "Failed to record refund",
          type: "error",
        });
      }
    },
    [customerId, createCustomerRefundMutation, toast, t, router]
  );

  // Handle reprint payment receipt
  const handleReprintPaymentReceipt = useCallback(
    async (paymentId: string) => {
      try {
        const receipt =
          await exportPaymentReceiptMutation.mutateAsync(paymentId);
        downloadPdf(receipt.base64, receipt.fileName);
        toast({
          title: t("toast.success") || "Success",
          description:
            t("statement.receiptExported") || "Receipt exported successfully",
          type: "success",
        });
      } catch (error) {
        toast({
          title: t("toast.error") || "Error",
          description:
            error instanceof Error
              ? error.message
              : t("statement.receiptExportFailed") ||
                "Failed to export receipt",
          type: "error",
        });
      }
    },
    [exportPaymentReceiptMutation, downloadPdf, toast, t]
  );

  const openReversePaymentModal = useCallback(
    (paymentId: string, amount: number, installmentId?: string) => {
      setReverseContext({
        paymentId,
        amount,
        ...(installmentId?.trim()
          ? { installmentId: installmentId.trim() }
          : {}),
      });
      setReverseModalOpen(true);
    },
    []
  );

  const handleReversePaymentConfirm = useCallback(
    async (reason: string) => {
      if (!reverseContext) return;
      const { paymentId, amount, installmentId } = reverseContext;
      const manualEntries =
        installmentId && installmentId.trim().length > 0
          ? [
              {
                targetType: "INSTALLMENT" as const,
                creditInstallmentId: installmentId,
                amount,
              },
            ]
          : [{ targetType: "OPENING_BALANCE" as const, amount }];

      try {
        const autoResult = await reversePaymentMutation.mutateAsync({
          customerId,
          paymentId,
          data: { reason },
        });

        if ((autoResult as { manualRequired?: boolean })?.manualRequired) {
          setReverseModalOpen(false);
          await manualReversePaymentMutation.mutateAsync({
            customerId,
            paymentId,
            data: {
              reason,
              entries: manualEntries,
            },
          });
          toast({
            title: t("toast.success") || "Success",
            description:
              t("statement.reversePayment.manualSuccess") ||
              "Reversión manual contable aplicada",
            type: "success",
          });
          setReverseContext(null);
          router.refresh();
          return;
        }
        toast({
          title: t("toast.success") || "Success",
          description:
            t("statement.reversePayment.success") ||
            "Pago revertido correctamente",
          type: "success",
        });
        setReverseModalOpen(false);
        setReverseContext(null);
        router.refresh();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo revertir el pago";
        const isLegacy = shouldFallbackToManualReversal(error);
        if (!isLegacy) {
          toast({
            title: t("toast.error") || "Error",
            description: message,
            type: "error",
          });
          return;
        }

        setReverseModalOpen(false);

        try {
          await manualReversePaymentMutation.mutateAsync({
            customerId,
            paymentId,
            data: {
              reason,
              entries: manualEntries,
            },
          });
          toast({
            title: t("toast.success") || "Success",
            description:
              t("statement.reversePayment.manualSuccess") ||
              "Reversión manual contable aplicada",
            type: "success",
          });
        } catch (manualErr) {
          toast({
            title: t("toast.error") || "Error",
            description:
              manualErr instanceof Error
                ? manualErr.message
                : "Error en reversión manual",
            type: "error",
          });
        } finally {
          setReverseContext(null);
          router.refresh();
        }
      }
    },
    [
      customerId,
      manualReversePaymentMutation,
      reverseContext,
      reversePaymentMutation,
      router,
      t,
      toast,
    ]
  );

  // Define columns for transactions table
  const transactionColumns = useMemo<ColumnDef<AccountStatementTransaction>[]>(
    () => [
      {
        accessorKey: "date",
        header: t("statement.table.date"),
        cell: ({ row }) => (
          <span className="text-sm font-medium text-gray-900 dark:text-white">
            {formatShortDateInUserTimeZone(row.original.date)}
          </span>
        ),
      },
      {
        accessorKey: "type",
        header: t("statement.table.type"),
        cell: ({ row }) => {
          const transactionType = row.original.type;
          const metadata = row.original.metadata as
            | { transactionType?: string }
            | undefined;
          const isPaymentReversal =
            transactionType === "REFUND" &&
            metadata?.transactionType === "REVERSAL";
          const isAnnulledOrder =
            transactionType === "ORDER" &&
            (row.original.metadata?.annulled === true ||
              row.original.description?.includes("(Anulada)"));
          const isPaymentOrCreditNote =
            transactionType === "PAYMENT" || transactionType === "CREDIT_NOTE";

          let typeLabel: string;
          if (isPaymentReversal) {
            typeLabel = t("statement.transactionTypes.REVERSAL") || "Reversión";
          } else if (isAnnulledOrder) {
            typeLabel =
              t("statement.transactionTypes.ORDER_ANNULLED") ||
              "Pedido (Anulada)";
          } else {
            typeLabel =
              t(`statement.transactionTypes.${transactionType}` as any) ||
              transactionType.replace("_", " ");
          }

          let badgeClass: string;
          if (isPaymentReversal) {
            badgeClass =
              "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
          } else if (isPaymentOrCreditNote) {
            badgeClass =
              "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
          } else if (isAnnulledOrder) {
            badgeClass =
              "bg-gray-100 text-gray-700 dark:bg-gray-700/30 dark:text-gray-300";
          } else {
            badgeClass =
              "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300";
          }

          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-1 text-sm font-medium",
                badgeClass
              )}
            >
              {typeLabel}
            </span>
          );
        },
      },
      {
        accessorKey: "description",
        header: t("statement.table.description"),
        cell: ({ row }) => (
          <span className="block break-words text-sm text-gray-900 dark:text-white">
            {row.original.description}
          </span>
        ),
      },
      {
        accessorKey: "reference",
        header: t("statement.table.reference"),
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="min-w-56 break-words font-mono text-sm text-gray-600 dark:text-gray-400">
              {row.original.reference}
            </span>
            {row.original.type === "PAYMENT" &&
              row.original.metadata?.paymentId && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={e => {
                      e.stopPropagation();
                      const paymentId = row.original.metadata?.paymentId;
                      if (paymentId) {
                        handleReprintPaymentReceipt(paymentId);
                      }
                    }}
                    title={t("statement.reprintReceipt") || "Reprint Receipt"}
                  >
                    <BiPrinter className="h-4 w-4" />
                  </Button>
                  {!row.original.metadata?.reversed && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={e => {
                        e.stopPropagation();
                        const paymentId = row.original.metadata?.paymentId;
                        if (!paymentId) return;
                        openReversePaymentModal(
                          paymentId,
                          row.original.credit || 0,
                          row.original.metadata?.installmentId
                        );
                      }}
                    >
                      Revertir
                    </Button>
                  )}
                </>
              )}
          </div>
        ),
      },
      {
        accessorKey: "debit",
        header: t("statement.table.debit"),
        cell: ({ row }) => (
          <span className="block min-w-32 text-right text-sm font-medium text-red-600 dark:text-red-400">
            {row.original.debit ? (
              formatNicaraguanCurrency(row.original.debit)
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "credit",
        header: t("statement.table.credit"),
        cell: ({ row }) => (
          <span className="block min-w-32 text-right text-sm font-medium text-green-600 dark:text-green-400">
            {row.original.credit ? (
              formatNicaraguanCurrency(row.original.credit)
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </span>
        ),
      },
      {
        accessorKey: "balance",
        header: t("statement.table.balance"),
        cell: ({ row }) => {
          return (
            <span className="block min-w-32 text-right text-sm font-semibold text-gray-900 dark:text-white">
              {formatNicaraguanCurrency(row.original.balance)}
            </span>
          );
        },
      },
    ],
    [t, handleReprintPaymentReceipt, openReversePaymentModal]
  );

  const transactionTypeOptions = useMemo(
    () => [
      {
        value: "",
        label: t("statement.filters.allTypes") || "Todos los tipos",
      },
      {
        value: "ORDER",
        label: t("statement.transactionTypes.ORDER") || "Pedido",
      },
      {
        value: "PAYMENT",
        label: t("statement.transactionTypes.PAYMENT") || "Pago",
      },
      {
        value: "REFUND",
        label: t("statement.transactionTypes.REFUND") || "Devolución",
      },
      {
        value: "CREDIT_NOTE",
        label: t("statement.transactionTypes.CREDIT_NOTE") || "Nota de Crédito",
      },
      {
        value: "INITIAL_BALANCE",
        label:
          t("statement.transactionTypes.INITIAL_BALANCE") || "Saldo Inicial",
      },
    ],
    [t]
  );

  const customerName = customer?.person
    ? `${customer.person.firstName || ""} ${customer.person.lastName || ""}`.trim()
    : "Customer";

  // Quick date range presets
  const quickDateRanges = useMemo(() => {
    const today = new Date();
    return [
      {
        label: t("statement.dateRanges.today"),
        from: format(today, "dd/MM/yyyy"),
        to: format(today, "dd/MM/yyyy"),
      },
      {
        label: t("statement.dateRanges.thisWeek"),
        from: format(startOfWeek(today), "dd/MM/yyyy"),
        to: format(today, "dd/MM/yyyy"),
      },
      {
        label: t("statement.dateRanges.thisMonth"),
        from: format(startOfMonth(today), "dd/MM/yyyy"),
        to: format(today, "dd/MM/yyyy"),
      },
      {
        label: t("statement.dateRanges.last30Days"),
        from: format(subDays(today, 30), "dd/MM/yyyy"),
        to: format(today, "dd/MM/yyyy"),
      },
      {
        label: t("statement.dateRanges.last3Months"),
        from: format(subMonths(today, 3), "dd/MM/yyyy"),
        to: format(today, "dd/MM/yyyy"),
      },
    ];
  }, [t]);

  const handleQuickRange = useCallback((from: string, to: string) => {
    setFromDate(from);
    setToDate(to);
    setCurrentPage(1);
  }, []);

  if (!statement && !isLoading && !error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("statement.title")} - {customerName}
          </h1>
        </div>
        <Card padding="lg" className="py-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {t("statement.noData")}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
            {t("statement.title")}
          </h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-gray-600 dark:text-gray-400 sm:text-base">
            <span>{customerName}</span>
            {customer?.person?.phone && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="text-gray-500 dark:text-gray-500">
                  {customer.person.phone}
                </span>
              </>
            )}
            {customer?.person?.email && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="text-gray-500 dark:text-gray-500">
                  {customer.person.email}
                </span>
              </>
            )}
          </p>
        </div>
        {statement && totalPayable > 0 && (
          <Button
            variant="primary"
            size="sm"
            className="shrink-0 gap-2"
            onClick={() => setPaymentModalOpen(true)}
          >
            <FaDollarSign className="h-4 w-4" />
            {t("statement.makePayment") || "Make Payment"}
          </Button>
        )}
        {statement && closingBalance < 0 && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/20"
            onClick={() => setRefundModalOpen(true)}
          >
            <FaDollarSign className="h-4 w-4" />
            {t("statement.refund") || "Refund"}
          </Button>
        )}
      </div>

      {/* Date Filters */}
      <Card padding="lg">
        <div className="mb-4 flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t("statement.dateRange")}
          </h2>
        </div>

        {/* TODO: ENABLE THIS WHEN WE Enough time has passed */}
        {/* Quick Date Range Presets */}
        {/* <div className="mb-4 flex flex-wrap gap-2">
          {quickDateRanges.map((range) => (
            <Button
              key={range.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickRange(range.from, range.to)}
              className={cn(
                "text-sm",
                fromDate === range.from && toDate === range.to
                  ? "bg-primary-50 border-primary-300 text-primary-700 dark:bg-primary-900/20 dark:border-primary-700 dark:text-primary-300"
                  : ""
              )}
            >
              {range.label}
            </Button>
          ))}
        </div> */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("statement.fromDateMin")}
            </label>
            <DateFilterInput
              placeholder={formatYmdToNumeric(MIGRATION_DATE)}
              {...(fromDate && { value: fromDate })}
              onChange={value => handleDateChange("from", value)}
              min={MIGRATION_DATE}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("statement.toDate")}
            </label>
            <DateFilterInput
              placeholder={todayNumeric}
              {...(toDate && { value: toDate })}
              onChange={value => handleDateChange("to", value)}
              min={fromDate || MIGRATION_DATE}
            />
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {String(error)}
        </div>
      )}

      {isLoading && !statement && (
        <Card padding="lg" className="py-12 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary-600" />
          <p className="mt-4 text-gray-500 dark:text-gray-400">
            {t("statement.loading")}
          </p>
        </Card>
      )}

      {statement && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card
              padding="md"
              className="border-primary-200/50 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t("statement.openingBalance")}
                  </p>
                  <p className="mt-2 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">
                    {formatNicaraguanCurrency(statement.summary.openingBalance)}
                  </p>
                </div>
                <div className="rounded-xl bg-primary-100/50 p-3 dark:bg-primary-900/30">
                  <FaDollarSign className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
              </div>
            </Card>
            <Card
              padding="md"
              className="border-red-200/50 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t("statement.totalCharges")}
                  </p>
                  <p className="mt-2 text-xl font-bold text-red-600 dark:text-red-400 sm:text-2xl">
                    {formatNicaraguanCurrency(statement.summary.totalCharges)}
                  </p>
                </div>
                <div className="rounded-xl bg-red-100/50 p-3 dark:bg-red-900/30">
                  <FaArrowUp className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
              </div>
            </Card>
            <Card
              padding="md"
              className="border-green-200/50 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t("statement.totalPayments")}
                  </p>
                  <p className="mt-2 text-xl font-bold text-green-600 dark:text-green-400 sm:text-2xl">
                    {formatNicaraguanCurrency(statement.summary.totalPayments)}
                  </p>
                </div>
                <div className="rounded-xl bg-green-100/50 p-3 dark:bg-green-900/30">
                  <FaArrowDown className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </Card>
            <Card
              padding="md"
              className={cn(
                "border-2",
                statement.summary.closingBalance < 0
                  ? "border-green-300/50 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-800/20"
                  : "border-primary-200/50 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t("statement.closingBalance")}
                  </p>
                  <p
                    className={cn(
                      "mt-2 text-xl font-bold sm:text-2xl",
                      statement.summary.closingBalance < 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-900 dark:text-white"
                    )}
                  >
                    {formatNicaraguanCurrency(statement.summary.closingBalance)}
                  </p>
                  {statement.summary.closingBalance < 0 && (
                    <p className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">
                      {t("statement.creditInFavor")}
                    </p>
                  )}
                </div>
                <div
                  className={cn(
                    "rounded-xl p-3",
                    statement.summary.closingBalance < 0
                      ? "bg-green-100/50 dark:bg-green-900/30"
                      : "bg-primary-100/50 dark:bg-primary-900/30"
                  )}
                >
                  {statement.summary.closingBalance < 0 ? (
                    <FaCheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <FaCheckCircle className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  )}
                </div>
              </div>
            </Card>
          </div>

          {statement.customer.creditAllowed && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {statement.summary.creditLimit !== null && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t("statement.creditLimit")}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatNicaraguanCurrency(statement.summary.creditLimit)}
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  {t("statement.outstandingAmount")}
                </h3>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatNicaraguanCurrency(
                    statement.summary.outstandingAmount
                  )}
                </p>
              </div>
              {statement.summary.availableCredit !== null && (
                <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                    {t("statement.availableCredit")}
                  </h3>
                  <p className="text-2xl font-bold dark:text-green-400">
                    {formatNicaraguanCurrency(
                      statement.summary.availableCredit
                    )}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Credits Section */}
          {statement.credits && statement.credits.length > 0 && (
            <Card padding="lg">
              <button
                type="button"
                className="flex w-full items-center justify-between"
                onClick={() => setCreditsExpanded(prev => !prev)}
              >
                <div className="flex items-center gap-2">
                  <FaCreditCard className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t("statement.credits.activeCredits")} (
                    {statement.credits.length})
                  </h2>
                </div>
                {creditsExpanded ? (
                  <ChevronUpIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                )}
              </button>
              {creditsExpanded && (
                <div className="mt-6 space-y-4">
                  {statement.credits.map((credit: AccountStatementCredit) => {
                    // Get color codes for credit status
                    const getCreditStatusClassName = (status: string) => {
                      switch (status) {
                        case "PENDING":
                          return "px-2 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
                        case "APPROVED":
                          return "px-2 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
                        case "REJECTED":
                          return "px-2 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
                        case "ACTIVE":
                          return "px-2 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
                        case "PAID":
                          return "px-2 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
                        case "OVERDUE":
                          return "px-2 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
                        default:
                          return "px-2 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
                      }
                    };

                    return (
                      <div
                        key={credit.id}
                        className="rounded-xl border border-gray-200 bg-white/50 p-5 transition-colors hover:bg-white/70 dark:border-gray-700 dark:bg-gray-800/30 dark:hover:bg-gray-800/50"
                      >
                        <div className="mb-3 flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="mb-2 font-medium text-gray-900 dark:text-white">
                              {credit.durationDays
                                ? t("statement.credits.orderWithDetails", {
                                    orderNumber: credit.orderNumber,
                                    duration: `${credit.durationDays} ${credit.durationDays === 1 ? t("statement.credits.day") : t("statement.credits.days")}`,
                                    installments: credit.installmentCount,
                                  })
                                : t("statement.credits.order", {
                                    orderNumber: credit.orderNumber,
                                  })}
                            </h3>
                            <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 dark:text-gray-400 sm:grid-cols-2">
                              <div>
                                <span className="font-medium">
                                  {t("statement.credits.principal")}:
                                </span>{" "}
                                {formatNicaraguanCurrency(
                                  credit.principalAmount
                                )}
                              </div>
                              <div>
                                <span className="font-medium">
                                  {t("statement.credits.outstanding")}:
                                </span>{" "}
                                {formatNicaraguanCurrency(
                                  credit.outstandingAmount
                                )}
                              </div>
                              <div>
                                <span className="font-medium">
                                  {t("statement.credits.createdAt")}:
                                </span>{" "}
                                {formatShortDateInUserTimeZone(
                                  credit.createdAt
                                )}
                              </div>
                            </div>
                          </div>
                          <span
                            className={getCreditStatusClassName(credit.status)}
                          >
                            {t(`statement.status.${credit.status}` as any) ||
                              credit.status}
                          </span>
                        </div>
                        <div className="mt-3 space-y-2">
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t("statement.credits.installments")}:
                          </h4>
                          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                            {credit.installments.map(inst => {
                              const getStatusClassName = (status: string) => {
                                if (
                                  status === "OVERDUE" ||
                                  status === "ANNULLED"
                                ) {
                                  return "px-2 py-1 rounded text-sm bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
                                }
                                if (status === "PAID") {
                                  return "px-2 py-1 rounded text-sm bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
                                }
                                return "px-2 py-1 rounded text-sm bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
                              };

                              return (
                                <div
                                  key={inst.id}
                                  className="rounded bg-gray-50 p-2 text-sm dark:bg-gray-700"
                                >
                                  <div className="flex items-center justify-between">
                                    <span>
                                      {t("statement.credits.installmentDue", {
                                        installmentNo: inst.installmentNo,
                                      })}
                                      :{" "}
                                      {formatShortDateInUserTimeZone(
                                        inst.dueDate
                                      )}
                                    </span>
                                    <span
                                      className={getStatusClassName(
                                        inst.status
                                      )}
                                    >
                                      {t(
                                        `statement.status.${inst.status}` as any
                                      ) || inst.status}
                                    </span>
                                  </div>
                                  <div className="mt-1 text-gray-600 dark:text-gray-400">
                                    {t("statement.credits.amount")}:{" "}
                                    {formatNicaraguanCurrency(inst.amount)} •{" "}
                                    {t("statement.credits.paid")}:{" "}
                                    {formatNicaraguanCurrency(inst.paidAmount)}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* Transactions Table */}
          <Card padding="lg">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <FileTextIcon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t("statement.transactions")}
                </h2>
              </div>
              <div className="w-full sm:w-56">
                <SearchableSelect
                  options={transactionTypeOptions}
                  value={transactionTypeFilter}
                  onValueChange={handleTransactionTypeChange}
                  placeholder={
                    t("statement.filters.allTypes") || "Todos los tipos"
                  }
                  allowSearch={false}
                  showClearButton={!!transactionTypeFilter}
                />
              </div>
            </div>
            <DataTable
              data={statement.transactions}
              columns={transactionColumns}
              loading={isLoading}
              empty={
                <div className="py-12 text-center">
                  <p className="text-gray-500 dark:text-gray-400">
                    {t("statement.table.noTransactions")}
                  </p>
                </div>
              }
              pagination={{
                currentPage: statement.pagination?.page || 1,
                totalPages: statement.pagination?.totalPages || 1,
                totalItems: statement.pagination?.total || 0,
                pageSize,
                onPageChange: handlePageChange,
                onPageSizeChange: handlePageSizeChange,
                pageSizeOptions,
              }}
              paginationLabels={{
                showing: t("pagination.showing"),
                of: t("pagination.of"),
                results: t("pagination.results"),
                previous: t("pagination.previous"),
                next: t("pagination.next"),
                page: t("pagination.page"),
                rowsPerPage: t("pagination.rowsPerPage"),
              }}
              showTitle={false}
              className="border-0 shadow-none [&_table]:table-auto [&_td]:whitespace-normal [&_td]:break-words [&_td]:align-top [&_th]:whitespace-normal [&_th]:align-top"
            />
          </Card>
        </>
      )}

      <ReversePaymentModal
        isOpen={reverseModalOpen}
        onClose={() => {
          if (
            reversePaymentMutation.isPending ||
            manualReversePaymentMutation.isPending
          ) {
            return;
          }
          setReverseModalOpen(false);
          setReverseContext(null);
        }}
        onConfirm={handleReversePaymentConfirm}
        isLoading={
          reversePaymentMutation.isPending ||
          manualReversePaymentMutation.isPending
        }
        title={t("statement.reversePayment.title") || "Revertir pago"}
        description={
          t("statement.reversePayment.description") ||
          "Indique el motivo de la reversión."
        }
        reasonLabel={t("statement.reversePayment.reasonLabel") || "Motivo"}
        confirmLabel={t("statement.reversePayment.confirm") || "Revertir pago"}
        cancelLabel={t("payment.cancel") || "Cancelar"}
        {...(() => {
          const ph = t("statement.reversePayment.reasonPlaceholder");
          const key = "statement.reversePayment.reasonPlaceholder";
          return ph && ph !== key ? { reasonPlaceholder: ph } : {};
        })()}
        {...(reverseContext
          ? {
              amountSummary: `${t("statement.reversePayment.amountLabel") || "Monto"}: ${formatNicaraguanCurrency(reverseContext.amount)}`,
            }
          : {})}
      />

      {/* Customer Payment Modal */}
      <CustomerPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handleCustomerPayment}
        amountDue={totalPayable}
        openingBalance={openingBalance}
        outstandingAmount={outstandingAmount}
        closingBalance={closingBalance}
        isLoading={createCustomerPaymentMutation.isPending}
      />

      <CustomerRefundModal
        isOpen={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        onConfirm={handleCustomerRefund}
        closingBalance={closingBalance}
        isLoading={createCustomerRefundMutation.isPending}
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  Button,
  Input,
  Label,
  Badge,
} from "@esli-cosmetics/ui";
import { NumberInput } from "@/components/ui/number-input";
import {
  useCloseCashSession,
  useCashSessionById,
} from "@/hooks/use-cash-register";
import { CashSession } from "@esli-cosmetics/types";
import { useToast } from "@/hooks/toast/use-toast";
import {
  formatDateTimeWithTimezone,
  formatCurrency,
  LOCALE_SETTINGS,
} from "@esli-cosmetics/utils";
import { exportCashSessionPdf } from "@/actions/cash-register";
import { getReportExportMeta } from "@/lib/report-export-meta";
import { useCurrentUser } from "@/hooks/use-auth";

const createCloseSessionSchema = (t: (key: string) => string) =>
  z.object({
    closingBalance: z.number().min(0, t("validation.closingBalanceMin")),
    notes: z.string().optional(),
  });

type CloseSessionFormData = z.infer<
  ReturnType<typeof createCloseSessionSchema>
>;

interface CloseCashSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  session: CashSession;
}

export function CloseCashSessionModal({
  isOpen,
  onClose,
  onSuccess,
  session,
}: CloseCashSessionModalProps) {
  const { t } = useTranslation("cash-register");
  const { toast } = useToast();
  const closeSessionMutation = useCloseCashSession();
  const [isPrinting, setIsPrinting] = useState(false);
  // Fetch full session data with orders and movements
  const { data: fullSession, refetch: refetchSession } = useCashSessionById(
    session.id
  );

  // Use full session data if available, otherwise fall back to prop
  const sessionData = fullSession || session;

  // Calculate system total: opening balance + cash IN movements - cash OUT movements + order totals
  // Note: For open sessions, we calculate this on the frontend since systemTotal is null
  // For closed sessions, we use the stored systemTotal
  // For credit orders, only count initial payment (sum of payments), not totalAmount
  const systemTotal = useMemo(() => {
    if (
      sessionData.systemTotal !== null &&
      sessionData.systemTotal !== undefined
    ) {
      return sessionData.systemTotal;
    }

    let total = sessionData.openingBalance;

    // Add cash IN movements
    const cashInMovements = (sessionData.movements || []).filter(
      m => m.type === "IN"
    );
    total += cashInMovements.reduce((sum, m) => sum + m.amount, 0);

    // Subtract cash OUT movements
    const cashOutMovements = (sessionData.movements || []).filter(
      m => m.type === "OUT"
    );
    total -= cashOutMovements.reduce((sum, m) => sum + m.amount, 0);

    // Add order amounts
    // For credit orders, use initial payment (sum of payments)
    // For cash orders, use totalAmount
    const orders = sessionData.orders || [];
    total += orders.reduce((sum, order) => {
      if (order.paymentMethod === "CREDIT") {
        // For credit orders, sum the initial payments
        const initialPayment = (order.payments || []).reduce(
          (paymentSum, payment) => paymentSum + (payment.amount || 0),
          0
        );
        return sum + initialPayment;
      } else {
        // For cash orders, use totalAmount
        return sum + (order.totalAmount || 0);
      }
    }, 0);

    // Add credit installment payments
    const creditInstallmentPayments =
      sessionData.creditInstallmentPayments || [];
    total += creditInstallmentPayments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );

    return total;
  }, [sessionData]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    control,
  } = useForm<CloseSessionFormData>({
    resolver: zodResolver(createCloseSessionSchema(t)),
    defaultValues: {
      closingBalance: Number(systemTotal.toFixed(2)),
      notes: "",
    },
  });

  const closingBalance = watch("closingBalance");
  const difference = closingBalance ? closingBalance - systemTotal : 0;

  useEffect(() => {
    if (isOpen) {
      reset({
        closingBalance: Number(systemTotal.toFixed(2)),
        notes: "",
      });
      // Refetch session data to get latest orders and movements
      refetchSession();
    }
  }, [isOpen, systemTotal, reset, refetchSession]);

  const { data: userData } = useCurrentUser();
  const isAdmin = userData?.roles?.includes("admin");
  const isCashier = userData?.roles?.includes("cashier");
  const isSessionOwner = session.employeeId === userData?.employee?.id;
  const canCloseSession = isAdmin || isSessionOwner || isCashier;

  const onSubmit = async (data: CloseSessionFormData) => {
    if (!canCloseSession) {
      toast({
        title: t("messages.error"),
        description:
          t("messages.cannotCloseSession") ||
          "You don't have permission to close this session. Only the session owner or an administrator can close it.",
        type: "error",
      });
      console.warn("Cannot close session:", {
        isAdmin,
        isSessionOwner,
        sessionEmployeeId: session.employeeId,
        userEmployeeId: userData?.employee?.id,
        userId: userData?.id,
      });
      return;
    }

    try {
      // Close the session
      const closedSession = await closeSessionMutation.mutateAsync({
        sessionId: sessionData.id,
        data: {
          closingBalance: data.closingBalance,
          ...(data.notes && { notes: data.notes }),
          closedAt: formatDateTimeWithTimezone(),
        },
      });

      // Automatically download the report after closing
      // The PDF will include closingBalance, difference, and notes from the closed session
      try {
        setIsPrinting(true);
        // Use the closed session ID to generate PDF with all closing information
        const { timeZone } = getReportExportMeta();
        const { fileName, base64, mimeType } = await exportCashSessionPdf(
          closedSession.id,
          { timeZone }
        );

        // Download the PDF
        const byteChars = atob(base64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) {
          byteNumbers[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([new Uint8Array(byteNumbers)], {
          type: mimeType,
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: t("messages.sessionClosed"),
          description: t("close.printReport") + " " + fileName,
          type: "success",
        });
      } catch (printError: any) {
        // If PDF generation fails, still show success for closing but warn about report
        console.error("Error generating report:", printError);
        toast({
          title: t("messages.sessionClosed"),
          description:
            t("messages.error") +
            ": " +
            (printError?.message || "Failed to generate report"),
          type: "warning",
        });
      } finally {
        setIsPrinting(false);
      }

      reset();
      onSuccess();
    } catch (error: any) {
      // Extract error message from various possible error structures
      const errorMessage =
        error?.response?.message || error?.message || error?.errorText || "";

      // Check if it's a permission error from the backend
      // The backend returns: "Only the employee who opened the session, an admin, or a cashier can close it"
      const isPermissionError =
        errorMessage.includes("Only the employee who opened") ||
        errorMessage.includes("onlyOwnerOrAdminCanClose") ||
        errorMessage.includes("can close it") ||
        (error?.status === 400 &&
          (errorMessage.includes("close") ||
            errorMessage.includes("permission") ||
            errorMessage.includes("Only")));

      if (isPermissionError) {
        toast({
          title: t("messages.error"),
          description:
            t("messages.onlyOwnerOrAdminCanClose") ||
            "Only the employee who opened the session, an admin, or a cashier can close it.",
          type: "error",
        });
      } else {
        // Extract clean error message (remove "API Error: 400 - " prefix if present)
        const cleanMessage =
          errorMessage.replace(/^API Error: \d+ - /, "") ||
          t("messages.closeFailed");
        toast({
          title: t("messages.error"),
          description: cleanMessage,
          type: "error",
        });
      }
    }
  };

  const handleClose = () => {
    if (!closeSessionMutation.isPending) {
      reset();
      onClose();
    }
  };

  const handlePrintReport = async () => {
    try {
      setIsPrinting(true);
      const { timeZone } = getReportExportMeta();
      const { fileName, base64, mimeType } = await exportCashSessionPdf(
        sessionData.id,
        { timeZone }
      );

      // Download the PDF
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: t("messages.reportPrinted"),
        description: t("close.printReport") + " " + fileName,
        type: "success",
      });
    } catch (error: any) {
      toast({
        title: t("messages.error"),
        description: error?.message || "Failed to export report",
        type: "error",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const orders = sessionData.orders || [];
  const movements = sessionData.movements || [];

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{t("close.title")}</ModalTitle>
        </ModalHeader>

        {!canCloseSession && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
              {t("messages.cannotCloseSession") ||
                "You don't have permission to close this session."}
            </p>
            <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
              {t("messages.onlyOwnerOrAdminCanClose") ||
                "Only the session owner or an administrator can close this session."}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Session Info Section */}
          <div className="space-y-4 border-b border-gray-200 py-4">
            {/* Opened At */}
            <div>
              <Label>{t("session.openedAt") || "Opened At"}</Label>
              <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
                {new Date(sessionData.openedAt).toLocaleString(
                  LOCALE_SETTINGS.locale,
                  {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  }
                )}
              </div>
            </div>

            {/* Closed At */}
            {sessionData.closedAt && (
              <div>
                <Label>{t("session.closedAt") || "Closed At"}</Label>
                <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
                  {new Date(sessionData.closedAt).toLocaleString(
                    LOCALE_SETTINGS.locale,
                    {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    }
                  )}
                </div>
              </div>
            )}

            {/* Opening Balance */}
            <div>
              <Label>{t("session.openingBalance") || "Opening Balance"}</Label>
              <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
                {formatCurrency(sessionData.openingBalance)}
              </div>
            </div>

            {/* System Total */}
            <div>
              <Label htmlFor="systemTotal">{t("close.systemTotal")}</Label>
              <Input
                id="systemTotal"
                type="number"
                value={systemTotal.toFixed(2)}
                disabled
                className="bg-gray-100 dark:bg-gray-700"
              />
            </div>

            <div>
              <Label htmlFor="closingBalance">
                {t("close.closingBalance")}
              </Label>
              <Controller
                name="closingBalance"
                control={control}
                rules={{ required: true, min: 0 }}
                render={({ field }) => (
                  <NumberInput
                    id="closingBalance"
                    value={
                      field.value !== undefined && field.value !== null
                        ? field.value
                        : systemTotal
                    }
                    onChange={value => field.onChange(value)}
                    onBlur={field.onBlur}
                    {...(errors.closingBalance?.message && {
                      error: errors.closingBalance.message,
                    })}
                  />
                )}
              />
            </div>

            <div>
              <Label htmlFor="difference">{t("close.difference")}</Label>
              <Input
                id="difference"
                type="number"
                value={difference.toFixed(2)}
                disabled
                className={`bg-gray-100 dark:bg-gray-700 ${
                  difference > 0
                    ? "text-green-600 dark:text-green-400"
                    : difference < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400"
                }`}
              />
              {difference !== 0 && (
                <p className="mt-1 text-sm text-gray-600">
                  {difference > 0 ? t("close.overage") : t("close.shortage")}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="notes">{t("close.notes")}</Label>
              <textarea
                id="notes"
                {...register("notes")}
                rows={3}
                className="mt-1 w-full rounded-md border border-neutral-200 px-3 py-2 focus:outline-none focus:ring-2 focus-visible:border-primary-500 focus-visible:ring-primary-200"
                placeholder={t("close.notesPlaceholder")}
              />
            </div>
          </div>

          {/* Orders Table */}
          <div className="border-b border-gray-200 py-4">
            <h3 className="mb-3 text-lg font-semibold">{t("close.orders")}</h3>
            {orders.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium">
                        {t("close.orderNumber")}
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        {t("close.orderType")}
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        {t("close.date")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("close.amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map(order => {
                      // For credit orders, use initial payment; for cash orders, use totalAmount
                      const orderAmount =
                        order.paymentMethod === "CREDIT"
                          ? (order.payments || []).reduce(
                              (sum, payment) => sum + (payment.amount || 0),
                              0
                            )
                          : order.totalAmount || 0;

                      return (
                        <tr key={order.id} className="border-b border-gray-100">
                          <td className="px-3 py-2">
                            {order.orderNumber || "-"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                order.paymentMethod === "CREDIT"
                                  ? "secondary"
                                  : "success"
                              }
                              className={
                                order.paymentMethod === "CREDIT"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                  : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              }
                            >
                              {order.paymentMethod === "CREDIT"
                                ? t("close.credit")
                                : t("close.cash")}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            {order.createdAt
                              ? new Date(order.createdAt).toLocaleDateString()
                              : "N/A"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(orderAmount)}
                            {order.paymentMethod === "CREDIT" && (
                              <div className="mt-1 text-xs text-gray-500">
                                {t("close.initialPayment")}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td colSpan={3} className="px-3 py-2 text-right">
                        {t("close.total")}:
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(
                          orders.reduce((sum, order) => {
                            if (order.paymentMethod === "CREDIT") {
                              return (
                                sum +
                                (order.payments || []).reduce(
                                  (paymentSum, payment) =>
                                    paymentSum + (payment.amount || 0),
                                  0
                                )
                              );
                            } else {
                              return sum + (order.totalAmount || 0);
                            }
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t("close.noOrders")}</p>
            )}
          </div>

          {/* Credit Installment Payments Table */}
          {sessionData.creditInstallmentPayments &&
            sessionData.creditInstallmentPayments.length > 0 && (
              <div className="border-b border-gray-200 py-4">
                <h3 className="mb-3 text-lg font-semibold">
                  {t("close.creditInstallmentPayments")}
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-medium">
                          {t("close.orderNumber")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("close.installmentNo")}
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          {t("close.date")}
                        </th>
                        <th className="px-3 py-2 text-right font-medium">
                          {t("close.amount")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionData.creditInstallmentPayments.map(payment => (
                        <tr
                          key={payment.id}
                          className="border-b border-gray-100"
                        >
                          <td className="px-3 py-2">
                            {payment.orderNumber || "-"}
                          </td>
                          <td className="px-3 py-2">
                            {payment.installmentNo !== null &&
                            payment.installmentNo !== undefined
                              ? `#${payment.installmentNo}`
                              : "-"}
                          </td>
                          <td className="px-3 py-2">
                            {new Date(payment.paidAt).toLocaleDateString()}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {formatCurrency(payment.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 font-semibold">
                        <td colSpan={3} className="px-3 py-2 text-right">
                          {t("close.total")}:
                        </td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(
                            sessionData.creditInstallmentPayments.reduce(
                              (sum, payment) => sum + (payment.amount || 0),
                              0
                            )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

          {/* Movements Table */}
          <div className="py-4">
            <h3 className="mb-3 text-lg font-semibold">
              {t("close.movements")}
            </h3>
            {movements.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 py-2 text-left font-medium">
                        {t("close.type")}
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        {t("close.date")}
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        {t("close.reason")}
                      </th>
                      <th className="px-3 py-2 text-right font-medium">
                        {t("close.amount")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map(movement => (
                      <tr
                        key={movement.id}
                        className="border-b border-gray-100"
                      >
                        <td className="px-3 py-2">
                          <span
                            className={`rounded px-2 py-1 text-xs font-medium ${
                              movement.type === "IN"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {movement.type === "IN"
                              ? t("close.cashIn")
                              : t("close.cashOut")}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          {new Date(movement.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">{movement.reason || "-"}</td>
                        <td className="px-3 py-2 text-right">
                          {formatCurrency(movement.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td colSpan={3} className="px-3 py-2 text-right">
                        {t("close.total")}:
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(
                          movements.reduce((sum, movement) => {
                            return (
                              sum +
                              (movement.type === "IN"
                                ? movement.amount
                                : -movement.amount)
                            );
                          }, 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">{t("close.noMovements")}</p>
            )}
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handlePrintReport}
              disabled={isPrinting || closeSessionMutation.isPending}
            >
              {isPrinting ? t("common.loading") : t("close.printReport")}
            </Button>
            <Button
              type="submit"
              disabled={
                closeSessionMutation.isPending || isPrinting || !canCloseSession
              }
            >
              {(() => {
                if (closeSessionMutation.isPending || isPrinting) {
                  return t("common.loading");
                }
                if (!canCloseSession) {
                  return t("messages.noPermission") || "No Permission";
                }
                return t("close.submit");
              })()}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={closeSessionMutation.isPending}
            >
              {t("common.cancel")}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

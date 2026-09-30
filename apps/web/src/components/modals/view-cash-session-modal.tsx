"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@esli-cosmetics/ui";
import { Button, Badge } from "@esli-cosmetics/ui";
import { formatCurrency, LOCALE_SETTINGS } from "@esli-cosmetics/utils";
import { useCashSessionById } from "@/hooks/use-cash-register";

interface ViewCashSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

export function ViewCashSessionModal({
  isOpen,
  onClose,
  sessionId,
}: ViewCashSessionModalProps) {
  const { t } = useTranslation("cash-register");

  // Fetch session details when modal is open
  const {
    data: session,
    isLoading,
    error,
  } = useCashSessionById(sessionId, {
    enabled: isOpen && !!sessionId,
  });

  // Calculate system total: opening balance + cash IN movements - cash OUT movements + order totals
  // Note: For open sessions, we calculate this on the frontend since systemTotal is null
  // For closed sessions, we use the stored systemTotal
  // For credit orders, only count initial payment (sum of payments), not totalAmount
  const systemTotal = useMemo(() => {
    if (!session) return 0;

    if (session.systemTotal !== null && session.systemTotal !== undefined) {
      return session.systemTotal;
    }

    let total = session.openingBalance;

    // Add cash IN movements
    const cashInMovements = (session.movements || []).filter(
      m => m.type === "IN"
    );
    total += cashInMovements.reduce((sum, m) => sum + m.amount, 0);

    // Subtract cash OUT movements
    const cashOutMovements = (session.movements || []).filter(
      m => m.type === "OUT"
    );
    total -= cashOutMovements.reduce((sum, m) => sum + m.amount, 0);

    // Add order amounts
    // For credit orders, use initial payment (sum of payments)
    // For cash orders, use totalAmount
    const orders = session.orders || [];
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
    const creditInstallmentPayments = session.creditInstallmentPayments || [];
    total += creditInstallmentPayments.reduce(
      (sum, payment) => sum + (payment.amount || 0),
      0
    );

    return total;
  }, [session]);

  const orders = session?.orders || [];
  const movements = session?.movements || [];

  // Show loading state
  if (isLoading) {
    return (
      <Modal open={isOpen} onClose={onClose}>
        <ModalContent size="lg" className="max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>{t("session.details")}</ModalTitle>
          </ModalHeader>
          <div className="px-6 py-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              {t("common.loading") || "Loading..."}
            </p>
          </div>
        </ModalContent>
      </Modal>
    );
  }

  // Show error state
  if (error || !session) {
    return (
      <Modal open={isOpen} onClose={onClose}>
        <ModalContent size="lg" className="max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>{t("session.details")}</ModalTitle>
          </ModalHeader>
          <div className="px-6 py-8 text-center">
            <p className="text-red-600 dark:text-red-400">
              {error instanceof Error
                ? error.message
                : t("common.error") || "Error loading session"}
            </p>
          </div>
          <ModalFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.close") || "Close"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    );
  }

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent size="lg" className="max-h-[90vh] overflow-y-auto">
        <ModalHeader>
          <ModalTitle>{t("session.details")}</ModalTitle>
        </ModalHeader>

        {/* Session Info Section */}
        <div className="space-y-4 border-b border-gray-200 py-4">
          {/* Opened At */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("session.openedAt") || "Opened At"}
            </label>
            <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
              {new Date(session.openedAt).toLocaleString(
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
          {session.closedAt && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("session.closedAt") || "Closed At"}
              </label>
              <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
                {new Date(session.closedAt).toLocaleString(
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
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("session.openingBalance") || "Opening Balance"}
            </label>
            <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
              {formatCurrency(session.openingBalance)}
            </div>
          </div>

          {/* System Total */}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("close.systemTotal")}
            </label>
            <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
              {formatCurrency(systemTotal)}
            </div>
          </div>

          {session?.closingBalance !== null &&
            session?.closingBalance !== undefined && (
              <>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("close.closingBalance")}
                  </label>
                  <div className="mt-1 rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
                    {formatCurrency(session.closingBalance)}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t("close.difference")}
                  </label>
                  <div
                    className={`mt-1 rounded-md bg-gray-100 px-3 py-2 dark:bg-gray-700 ${
                      session.difference && session.difference > 0
                        ? "text-green-600 dark:text-green-400"
                        : session.difference && session.difference < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {session.difference
                      ? formatCurrency(session.difference)
                      : formatCurrency(0)}
                  </div>
                  {session.difference !== 0 &&
                    session.difference !== null &&
                    session.difference !== undefined && (
                      <p className="mt-1 text-sm text-gray-600">
                        {session.difference > 0
                          ? t("close.overage")
                          : t("close.shortage")}
                      </p>
                    )}
                </div>
              </>
            )}

          {session?.notes && (
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("close.notes")}
              </label>
              <div className="mt-1 whitespace-pre-wrap rounded-md bg-gray-100 px-3 py-2 text-gray-900 dark:bg-gray-800 dark:text-white">
                {session.notes}
              </div>
            </div>
          )}
        </div>

        {/* Orders Table */}
        <div className="border-b border-gray-200 px-6 py-4">
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
                            : "-"}
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
        {session.creditInstallmentPayments &&
          session.creditInstallmentPayments.length > 0 && (
            <div className="border-b border-gray-200 px-6 py-4">
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
                    {session.creditInstallmentPayments.map(payment => (
                      <tr key={payment.id} className="border-b border-gray-100">
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
                          session.creditInstallmentPayments.reduce(
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
        <div className="px-6 py-4">
          <h3 className="mb-3 text-lg font-semibold">{t("close.movements")}</h3>
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
                    <tr key={movement.id} className="border-b border-gray-100">
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
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

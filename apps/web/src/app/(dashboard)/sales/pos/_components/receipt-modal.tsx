"use client";

import { BiPrinter, BiShoppingBag, BiCheckCircle } from "react-icons/bi";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@esli-cosmetics/ui";
import { Button } from "@esli-cosmetics/ui";
import { Separator } from "@/components/ui/separator";
import { useExportReceiptPdf } from "@/hooks/use-orders";
import { CURRENCY_SIGN } from "@esli-cosmetics/utils";

/**
 Download PDF file (avoids popup blockers)
 */
const downloadBase64Pdf = (fileName: string, base64String: string) => {
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
};

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onPrint: () => void;
  onNewSale: () => void;
}

export function ReceiptModal({
  isOpen,
  onClose,
  order,
  onNewSale,
}: ReceiptModalProps) {
  const { t } = useTranslation("pos");
  const { mutate: exportPdf, isPending } = useExportReceiptPdf();

  const handlePrint = () => {
    if (!order?.id) return;

    exportPdf(order.id, {
      onSuccess: result => {
        downloadBase64Pdf(result.fileName, result.base64);
      },
      onError: err => {
        console.error(err);
      },
    });
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent
        size="lg"
        className="h-[100vh] w-full overflow-y-auto md:!h-[80vh] md:w-auto"
      >
        <ModalHeader>
          <div className="mb-4 flex items-center justify-center">
            <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
              <BiCheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <ModalTitle className="text-center text-2xl font-bold text-green-600">
            {t("receipt.saleCompleted")}
          </ModalTitle>
        </ModalHeader>

        <div className="space-y-6 py-4" id="receipt">
          {/* Store Info */}
          <div className="space-y-2 text-center">
            <h1 className="font-['Prettywise'] text-2xl font-bold text-[#ff48b0]">
              Esli Cosmetics
            </h1>
            <p className="text-sm text-muted-foreground">
              {order.branch?.name || t("receipt.store")}
            </p>
            <p className="text-sm text-muted-foreground">
              {order.location?.name || ""}
            </p>
          </div>

          <Separator />

          {/* Order Info */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("receipt.orderNumber")}
              </span>
              <span className="font-mono font-semibold">
                {order.orderNumber}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("receipt.date")}</span>
              <span>{new Date(order.createdAt).toLocaleString()}</span>
            </div>
            {order.cashier && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("receipt.cashier")}
                </span>
                <span>{order.cashier.name}</span>
              </div>
            )}
            {order.seller && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("receipt.seller")}
                </span>
                <span>{order.seller.name}</span>
              </div>
            )}
            {order.customer && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {t("receipt.customer")}
                </span>
                <span>{order.customer.name}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-3">
            <h3 className="font-semibold">{t("receipt.items")}</h3>
            {order.items?.map((item: any, index: number) => {
              const product = item.productVariant?.product;
              const isKit = product?.type === "KIT";
              const kitItems = product?.kitItems || [];

              return (
                <div key={index} className="space-y-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {item.productVariant?.name ||
                          product?.name ||
                          "Product"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {product?.brand?.name}
                      </p>
                      {/* show kit components if kit*/}
                      {isKit && kitItems.length > 0 && (
                        <div className="mt-1 border-l-2 border-gray-200 pl-2 dark:border-gray-700">
                          <p className="mb-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                            {t("receipt.includes") || "Incluye:"}
                          </p>
                          <ul className="space-y-0.5 text-xs text-muted-foreground">
                            {kitItems.map((component: any, idx: number) => (
                              <li key={idx}>
                                {Number(component.quantity) *
                                  Number(item.quantity)}
                                x{" "}
                                {component.productVariant?.name || "Componente"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                    <p className="font-semibold">
                      {CURRENCY_SIGN}
                      {Number(item.lineTotal).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {item.quantity} × {CURRENCY_SIGN}
                      {Number(item.unitPrice).toFixed(2)}
                    </span>
                    {item.discountAmount > 0 && (
                      <span className="text-green-600">
                        {t("receipt.discount")}: -{CURRENCY_SIGN}
                        {Number(item.discountAmount).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Totals */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {t("receipt.subtotal")}
              </span>
              <span>
                {CURRENCY_SIGN}
                {Number(order.subtotal).toFixed(2)}
              </span>
            </div>

            {/* Discount Breakdown */}
            {Number(order.discountAmount || 0) > 0 && (
              <div>
                {Number(order.itemsDiscountTotal || 0) > 0 ||
                Number(order.discountCodeValue || 0) > 0 ||
                Number(order.manualDiscount || 0) > 0 ? (
                  <div className="space-y-1 border-l-2 border-green-200 pl-2 dark:border-green-800">
                    {Number(order.itemsDiscountTotal || 0) > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="text-muted-foreground">
                          {t("receipt.itemDiscounts")}
                        </span>
                        <span>
                          -{CURRENCY_SIGN}
                          {Number(order.itemsDiscountTotal).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {Number(order.discountCodeValue || 0) > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="text-muted-foreground">
                          {t("receipt.discountCode")}
                        </span>
                        <span>
                          -{CURRENCY_SIGN}
                          {Number(order.discountCodeValue).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {Number(order.manualDiscount || 0) > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span className="text-muted-foreground">
                          {t("receipt.manualDiscount")}
                        </span>
                        <span>
                          -{CURRENCY_SIGN}
                          {Number(order.manualDiscount).toFixed(2)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between border-t border-green-200 pt-1 text-sm font-semibold text-green-600 dark:border-green-800">
                      <span>{t("receipt.totalDiscount")}</span>
                      <span>
                        -{CURRENCY_SIGN}
                        {Number(order.discountAmount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{t("receipt.discount")}</span>
                    <span>
                      -{CURRENCY_SIGN}
                      {Number(order.discountAmount).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {order.taxes > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("receipt.tax")}
                </span>
                <span>
                  {CURRENCY_SIGN}
                  {Number(order.taxes).toFixed(2)}
                </span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-xl font-bold">
              <span>{t("receipt.total")}</span>
              <span className="text-[#ff48b0]">
                {CURRENCY_SIGN}
                {Number(order.totalAmount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Methods */}
          {order.payments && order.payments.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">
                  {t("receipt.paymentMethods")}
                </h3>
                {order.payments.map((payment: any, index: number) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {String(payment.paymentType).trim().toUpperCase() ===
                      "DOWN_PAYMENT"
                        ? t("receipt.initialPayment")
                        : payment.paymentType}
                      {payment.provider && ` (${payment.provider})`}
                    </span>
                    <span>
                      {CURRENCY_SIGN}
                      {Number(payment.amount).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <Separator />

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground">
            <p>{t("receipt.thankYou")}</p>
            <p className="mt-2">{t("receipt.forInquiries")}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full space-y-2">
          <Button
            className="h-12 w-full bg-gradient-to-r from-[#ff48b0] to-[#f5b1cc] text-lg font-semibold hover:opacity-90"
            onClick={onNewSale}
          >
            <BiShoppingBag className="h-4 w-4" />
            {t("receipt.newSale")}
          </Button>
          <Button
            variant="outline"
            className="w-full flex-1 gap-2"
            onClick={handlePrint}
            disabled={isPending}
          >
            <BiPrinter className="h-4 w-4" />
            {t("receipt.printReceipt")} / PDF
          </Button>
        </div>
      </ModalContent>
    </Modal>
  );
}

"use client";

import {
  Button,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Textarea,
  SearchableSelect,
} from "@esli-cosmetics/ui";
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AnnulOrderItemRequest } from "@/actions/orders";
import { formatCurrency } from "@esli-cosmetics/utils";
import { BiInfoCircle, BiPackage } from "react-icons/bi";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";

interface AnnulItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: AnnulOrderItemRequest) => void;
  item: {
    id: string;
    quantity: number;
    annulledQuantity?: number;
    unitPrice: number;
    lineTotal: number;
    discountAmount: number; // Required for net calculation
    taxAmount: number; // Required for net calculation
    productVariant?: {
      name: string;
      product?: {
        name: string;
        type?: string; // "KIT" o "STANDARD"
        brand?: { name: string };
        kitItems?: Array<{
          quantity: number;
          productVariant?: { name: string };
        }>;
      };
    };
  };
  isLoading?: boolean;
  isCreditOrder?: boolean; // If true, refund method selection is not applicable
}

export function AnnulItemModal({
  isOpen,
  onClose,
  onConfirm,
  item,
  isLoading = false,
  isCreditOrder = false,
}: AnnulItemModalProps) {
  const { t } = useTranslation("orders");
  const remainingQuantity = item.quantity - (item.annulledQuantity || 0);

  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"CASH" | "NONE">("NONE");

  // Determine if the item is a Kit
  const product = item.productVariant?.product;
  const kitItems = Array.isArray(product?.kitItems) ? product.kitItems : [];
  const isKit =
    product?.type === "KIT" || (kitItems.length > 0 && Array.isArray(kitItems));
  // calculate net annulled amount
  const netAnnulledAmount = useMemo(() => {
    if (!quantity || quantity <= 0) return 0;
    const proportion = quantity / item.quantity;
    const gross = item.unitPrice * quantity;
    const proportionalDiscount = (item.discountAmount || 0) * proportion;
    const proportionalTax = (item.taxAmount || 0) * proportion;
    return Number((gross - proportionalDiscount + proportionalTax).toFixed(2));
  }, [quantity, item]);

  // kits inventory return summary
  const kitReturnSummary = useMemo(() => {
    if (!isKit || kitItems.length === 0) return [];
    return kitItems.map(ki => ({
      name: ki.productVariant?.name,
      totalToReturn: ki.quantity * quantity,
    }));
  }, [isKit, kitItems, quantity]);

  // Reset form state when modal opens or item changes
  useEffect(() => {
    if (isOpen) {
      const remaining = item.quantity - (item.annulledQuantity || 0);
      // Set quantity to 1 if remaining > 0, otherwise set to remaining (which could be 0)
      setQuantity(remaining > 0 ? 1 : remaining);
      setReason("");
      setRefundMethod("NONE");
    }
  }, [isOpen, item.id, item.quantity, item.annulledQuantity]);

  // Refund method options for SearchableSelect
  const refundMethodOptions = useMemo(
    () => [
      {
        value: "NONE",
        label: t("annulItem.noRefund", "Sin reembolso"),
      },
      {
        value: "CASH",
        label: t("annulItem.cashRefund", "Reembolso en efectivo"),
      },
    ],
    [t]
  );

  const handleConfirm = () => {
    if (quantity <= 0 || quantity > remainingQuantity) {
      return;
    }

    // Existing logic and validations
    onConfirm({
      quantity,
      ...(reason && { reason }),
      refundMethod,
    });
  };

  const handleClose = () => {
    setQuantity(1);
    setReason("");
    setRefundMethod("NONE");
    onClose();
  };

  // Calculate approximate annulled amount for display (legacy, do not remove)
  const annulledAmount = (item.unitPrice * quantity).toFixed(2);

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent size="md" className="sm:max-w-[500px]">
        <ModalHeader>
          <ModalTitle>
            {t("annulItem.title", "Anular Item de Orden")}
          </ModalTitle>
          <ModalDescription>
            {t(
              "annulItem.description",
              "Selecciona la cantidad de items a anular. Esta acción revertirá el inventario y ajustará los totales de la orden."
            )}
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-4">
          {/* Product Info */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900/50">
            <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
              {item.productVariant?.name ||
                item.productVariant?.product?.name ||
                "Producto"}
              {isKit && (
                <Popover>
                  <PopoverTrigger asChild>
                    <span
                      className="ml-2 inline-flex cursor-pointer items-center rounded bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-700 transition hover:bg-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:hover:bg-pink-800"
                      tabIndex={0}
                      role="button"
                      aria-label={t("bulkAnnul.kitLabel", "KIT")}
                    >
                      <BiPackage className="mr-1 inline-block" />
                      {t("bulkAnnul.kitLabel", "KIT")}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-xs border border-pink-200 bg-white p-3 text-slate-800 shadow-xl dark:border-pink-800 dark:bg-gray-800 dark:text-gray-200">
                    <div
                      className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: "#ff48b0" }}
                    >
                      <BiInfoCircle className="h-3 w-3" />
                      {t(
                        "annulItem.inventoryReturn",
                        "Inventory Return Breakdown"
                      )}
                      :
                    </div>
                    <ul className="space-y-1">
                      {kitReturnSummary.map((comp, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between text-xs text-gray-700 dark:text-gray-300"
                        >
                          <span className="truncate pr-4">• {comp.name}</span>
                          <span className="font-mono font-bold text-slate-500">
                            x{comp.totalToReturn}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            {item.productVariant?.product?.brand && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {item.productVariant.product.brand.name}
              </div>
            )}
            <div className="mt-1 text-sm font-medium text-gray-700 dark:text-gray-300">
              {t("annulItem.remaining", "Disponible para anular")}:{" "}
              {remainingQuantity}
            </div>
          </div>

          {/* Quantity Input */}
          <div className="space-y-2">
            <Label htmlFor="quantity">
              {t("annulItem.quantity", "Cantidad a anular")} *
            </Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              max={remainingQuantity}
              value={quantity === 0 ? "" : quantity}
              onChange={e => {
                const val = e.target.value;
                if (val === "") {
                  setQuantity(0);
                  return;
                }
                const num = parseInt(val, 10);
                if (!isNaN(num)) {
                  setQuantity(Math.min(num, remainingQuantity));
                }
              }}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("annulItem.maxQuantity", "Máximo")}: {remainingQuantity}
            </p>
          </div>

          {/* Refund Method - Only shown for non-credit orders */}
          {!isCreditOrder && (
            <div className="space-y-2">
              <Label htmlFor="refundMethod">
                {t("annulItem.refundMethod", "Método de reembolso")}
              </Label>
              <SearchableSelect
                options={refundMethodOptions}
                value={refundMethod}
                onValueChange={value =>
                  setRefundMethod(value as "CASH" | "NONE")
                }
                placeholder={
                  t("annulItem.selectRefundMethod") ||
                  "Seleccionar método de reembolso"
                }
                allowSearch={false}
                showClearButton={false}
              />
            </div>
          )}
          {isCreditOrder && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {t(
                  "annulItem.creditOrderNote",
                  "Nota: Para órdenes a crédito, se cancelará el saldo pendiente correspondiente y, si la parte anulada ya estaba pagada, se revertirán esos pagos (devolución). El estado de cuenta nunca quedará en negativo."
                )}
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              {t("annulItem.reason", "Razón (opcional)")}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t(
                "annulItem.reasonPlaceholder",
                "Ej: Cliente devolvió el producto"
              )}
              rows={3}
            />
          </div>

          {/* FINAL SUMMARY BOX */}
          <div className="rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 dark:border-orange-800 dark:from-orange-900/20 dark:to-amber-900/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {t("annulItem.netAdjustment", "Monto neto a ajustar")}:
              </span>
              <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {formatCurrency(netAnnulledAmount)}
              </span>
            </div>
            <p className="mt-1 text-[10px] italic text-gray-500 dark:text-gray-400">
              *{" "}
              {t(
                "annulItem.calculationNote",
                "Cálculo proporcional considerando descuentos e impuestos."
              )}
            </p>
          </div>
        </div>

        <ModalFooter>
          <Button
            onClick={handleConfirm}
            disabled={
              isLoading || quantity <= 0 || quantity > remainingQuantity
            }
          >
            {isLoading
              ? t("common.processing", "Procesando...")
              : t("annulItem.confirm", "Confirmar Anulación")}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t("common.cancel", "Cancelar")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

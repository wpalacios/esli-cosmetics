"use client";

import {
  Button,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BulkAnnulOrderItemsRequest } from "@/actions/orders";
import { formatCurrency } from "@esli-cosmetics/utils";
import { BiInfoCircle, BiTrash, BiPackage } from "react-icons/bi";
import { NumberInput } from "@/components/ui/number-input";

interface OrderItemForAnnulment {
  id: string;
  quantity: number;
  annulledQuantity?: number;
  unitPrice: number;
  lineTotal: number;
  discountAmount?: number;
  taxAmount?: number;
  productVariant?: {
    name: string;
    product?: {
      name: string;
      type?: string; // "KIT" o "STANDARD"
      brand?: { name: string };
      kitItems?: Array<{
        productVariantId: string;
        quantity: number;
        productVariant?: { id: string; name: string; sku?: string };
      }>;
    };
  };
}

interface BulkAnnulItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: BulkAnnulOrderItemsRequest) => void;
  items: OrderItemForAnnulment[];
  isLoading?: boolean;
  isCreditOrder?: boolean;
  orderDiscountCodeValue?: number;
  orderManualDiscount?: number;
  orderSubtotal?: number;
}

interface SelectedItem {
  id: string;
  orderItemId: string;
  quantity: number;
  maxQuantity: number;
  name: string;
  unitPrice: number;
  effectiveUnitPrice: number; // Price after all discounts and taxes (item + order level)
  lineTotal: number; // Original line total (before order-level discounts)
  isKit?: boolean;
  kitItems?:
    | Array<{
        productVariantId: string;
        quantity: number;
        productVariant?: { id: string; name: string; sku?: string };
      }>
    | undefined;
}

export function BulkAnnulItemsModal({
  isOpen,
  onClose,
  onConfirm,
  items,
  isLoading = false,
  isCreditOrder = false,
  orderDiscountCodeValue = 0,
  orderManualDiscount = 0,
  orderSubtotal = 0,
}: BulkAnnulItemsModalProps) {
  const { t } = useTranslation("orders");

  // Calculate order-level discount proportion
  const orderLevelDiscount = orderDiscountCodeValue + orderManualDiscount;
  const hasOrderLevelDiscount = orderLevelDiscount > 0;

  // Helper: Detect if item is a kit and get kit summary
  const getKitReturnSummary = (item: SelectedItem) => {
    if (!item.isKit || !item.kitItems) return [];
    return item.kitItems.map(ki => ({
      name:
        ki.productVariant?.name ??
        t("common.unknownProduct", "Unknown component"),
      totalToReturn: ki.quantity * item.quantity,
    }));
  };

  // Filter items that can be annulled (have remaining quantity)
  const annullableItems = useMemo(
    () =>
      items
        .filter(item => {
          const remaining = item.quantity - (item.annulledQuantity || 0);
          return remaining > 0;
        })
        .map(item => {
          const product = item.productVariant?.product;
          const kitItems = Array.isArray(product?.kitItems)
            ? product.kitItems
            : [];
          const isKit =
            product?.type === "KIT" ||
            (kitItems.length > 0 && Array.isArray(kitItems));

          // Calculate effective unit price considering both item-level and order-level discounts
          const itemQuantity = item.quantity || 1;
          let effectiveLineTotal = item.lineTotal;
          if (hasOrderLevelDiscount && orderSubtotal > 0) {
            const itemProportion = item.lineTotal / orderSubtotal;
            const proportionalOrderDiscount =
              orderLevelDiscount * itemProportion;
            effectiveLineTotal = item.lineTotal - proportionalOrderDiscount;
          }
          const effectiveUnitPrice = effectiveLineTotal / itemQuantity;

          return {
            id: item.id,
            name:
              item.productVariant?.name ||
              item.productVariant?.product?.name ||
              "Unknown Product",
            brand: item.productVariant?.product?.brand?.name,
            unitPrice: item.unitPrice,
            effectiveUnitPrice: effectiveUnitPrice,
            lineTotal: item.lineTotal,
            quantity: item.quantity,
            annulledQuantity: item.annulledQuantity || 0,
            remainingQuantity: item.quantity - (item.annulledQuantity || 0),
            isKit,
            kitItems,
          };
        }),
    [items, hasOrderLevelDiscount, orderLevelDiscount, orderSubtotal]
  );

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"CASH" | "NONE">("NONE");
  const [kitError, setKitError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedItems([]);
      setReason("");
      setRefundMethod("NONE");
      setKitError(null);
    }
  }, [isOpen]);

  // Refund method options
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

  // Calculate totals
  const totals = useMemo(() => {
    const totalQuantity = selectedItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const totalAmount = selectedItems.reduce(
      (sum, item) => sum + item.quantity * item.effectiveUnitPrice,
      0
    );
    return { totalQuantity, totalAmount };
  }, [selectedItems]);

  const handleAddItem = (itemId: string) => {
    const item = annullableItems.find(i => i.id === itemId);
    if (!item) return;

    if (selectedItems.some(si => si.orderItemId === itemId)) return;

    // Kit Integrity Guard during selection
    if (item.isKit) {
      const hasComponents =
        Array.isArray(item.kitItems) && item.kitItems.length > 0;
      const isDataComplete = item.kitItems?.every(ki => ki.productVariant);

      if (!hasComponents || !isDataComplete) {
        setKitError(
          t(
            "bulkAnnul.kitIncompleteError",
            "Error: Kit configuration is missing components or data."
          )
        );
        setTimeout(() => setKitError(null), 5000);
        return;
      }
    }

    setKitError(null);
    setSelectedItems(prev => [
      ...prev,
      {
        id: item.id,
        orderItemId: item.id,
        quantity: 1,
        maxQuantity: item.remainingQuantity,
        name: item.name,
        unitPrice: item.unitPrice,
        effectiveUnitPrice: item.effectiveUnitPrice,
        lineTotal: item.lineTotal,
        isKit: item.isKit,
        kitItems: item.kitItems,
      },
    ]);
  };

  const handleRemoveItem = (orderItemId: string) => {
    setSelectedItems(prev =>
      prev.filter(item => item.orderItemId !== orderItemId)
    );
  };

  const handleQuantityChange = (orderItemId: string, newQuantity: number) => {
    setSelectedItems(prev =>
      prev.map(item =>
        item.orderItemId === orderItemId
          ? {
              ...item,
              quantity: Math.max(1, Math.min(newQuantity, item.maxQuantity)),
            }
          : item
      )
    );
  };

  const handleConfirm = () => {
    // Kit validations
    for (const item of selectedItems) {
      if (item.isKit) {
        if (!item.kitItems || item.kitItems.length === 0) {
          setKitError(
            t(
              "annulItem.kitEmptyError",
              "Critical: Este kit no tiene componentes definidos en la base de datos. No se puede revertir stock."
            )
          );
          return;
        }
        if (!item.kitItems.every((ki: any) => ki.productVariant)) {
          setKitError(
            t(
              "annulItem.kitIncompleteError",
              "Error: Algún componente del kit no tiene variante de producto definida."
            )
          );
          return;
        }
      }
    }
    setKitError(null);

    if (selectedItems.length === 0) {
      return;
    }

    onConfirm({
      items: selectedItems.map(item => ({
        orderItemId: item.orderItemId,
        quantity: item.quantity,
      })),
      ...(reason && { reason }),
      refundMethod,
    });
  };

  const handleClose = () => {
    setSelectedItems([]);
    setReason("");
    setRefundMethod("NONE");
    setKitError(null);
    onClose();
  };

  // Get available items for dropdown (not yet selected)
  const availableItems = useMemo(
    () =>
      annullableItems
        .filter(item => !selectedItems.some(si => si.orderItemId === item.id))
        .map(item => ({
          value: item.id,
          label: `${item.name} (${item.remainingQuantity} ${t("view.available", "disponibles")})`,
        })),
    [annullableItems, selectedItems, t]
  );

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent
        size="2xl"
        className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
      >
        <ModalHeader>
          <ModalTitle>
            {t("bulkAnnul.title", "Anular Múltiples Items")}
          </ModalTitle>
          <ModalDescription>
            {t(
              "bulkAnnul.description",
              "Selecciona los items y cantidades a anular. Esta acción revertirá el inventario y ajustará los totales de la orden."
            )}
          </ModalDescription>
        </ModalHeader>

        <div className="space-y-6 py-4">
          {/* Info Banner */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="flex items-start gap-2">
              <BiInfoCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                {isCreditOrder
                  ? t(
                      "bulkAnnul.creditOrderInfo",
                      "Esta es una orden a crédito. Se cancelará el saldo pendiente correspondiente y, si la parte anulada ya estaba pagada, se revertirán esos pagos (devolución). El estado de cuenta nunca quedará en negativo."
                    )
                  : t(
                      "bulkAnnul.cashOrderInfo",
                      "Selecciona el método de reembolso para la orden en efectivo."
                    )}
                {hasOrderLevelDiscount && (
                  <div className="mt-2 border-t border-blue-300 pt-2 dark:border-blue-700">
                    {t(
                      "bulkAnnul.orderDiscountInfo",
                      `Esta orden tiene descuentos a nivel de orden (${formatCurrency(orderLevelDiscount)}) que se aplicarán proporcionalmente.`
                    )}
                  </div>
                )}
                {kitError && (
                  <div className="mt-2 border-t border-red-300 pt-2 font-semibold text-red-600 dark:border-red-700 dark:text-red-400">
                    {kitError}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Add Item Section */}
          <div className="space-y-2">
            <Label htmlFor="addItem">
              {t("bulkAnnul.selectItems", "Seleccionar Items")}
            </Label>
            <SearchableSelect
              options={availableItems}
              value=""
              onValueChange={handleAddItem}
              placeholder={
                availableItems.length > 0
                  ? t(
                      "bulkAnnul.selectItemPlaceholder",
                      "Buscar y seleccionar item..."
                    )
                  : t(
                      "bulkAnnul.noItemsAvailable",
                      "No hay items disponibles para anular"
                    )
              }
              allowSearch={true}
              showClearButton={false}
              disabled={availableItems.length === 0}
            />
          </div>

          {/* Selected Items List */}
          {selectedItems.length > 0 && (
            <div className="space-y-3">
              <Label>
                {t("bulkAnnul.selectedItems", "Items Seleccionados")} (
                {selectedItems.length})
              </Label>
              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-2">
                {selectedItems.map(item => (
                  <div
                    key={item.orderItemId}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {item.name}
                        {item.isKit && (
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
                                {getKitReturnSummary(item).map((comp, idx) => (
                                  <li
                                    key={idx}
                                    className="flex justify-between text-xs text-gray-700 dark:text-gray-300"
                                  >
                                    <span className="truncate pr-4">
                                      • {comp.name}
                                    </span>
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
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {formatCurrency(item.effectiveUnitPrice)} ×{" "}
                        {item.quantity} ={" "}
                        {formatCurrency(
                          item.effectiveUnitPrice * item.quantity
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <NumberInput
                        min={1}
                        max={item.maxQuantity}
                        step="1"
                        value={item.quantity}
                        onChange={value => {
                          handleQuantityChange(
                            item.orderItemId,
                            Math.round(value)
                          );
                        }}
                        className="min-w-32"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveItem(item.orderItemId)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                      >
                        <BiTrash className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">
              {t("bulkAnnul.reason", "Razón (opcional)")}
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={t(
                "bulkAnnul.reasonPlaceholder",
                "Ej: Cliente devolvió múltiples productos"
              )}
              rows={3}
            />
          </div>

          {/* Refund Method - Only for cash orders */}
          {!isCreditOrder && (
            <div className="space-y-2">
              <Label htmlFor="refundMethod">
                {t("bulkAnnul.refundMethod", "Método de reembolso")}
              </Label>
              <SearchableSelect
                options={refundMethodOptions}
                value={refundMethod}
                onValueChange={value =>
                  setRefundMethod(value as "CASH" | "NONE")
                }
                placeholder={
                  t("bulkAnnul.selectRefundMethod") ||
                  "Seleccionar método de reembolso"
                }
                allowSearch={false}
                showClearButton={false}
              />
            </div>
          )}

          {/* Summary */}
          {selectedItems.length > 0 && (
            <div className="rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 dark:border-orange-800 dark:from-orange-900/20 dark:to-amber-900/20">
              <div className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                {t("bulkAnnul.summary", "Resumen de Anulación")}:
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <div className="flex justify-between">
                  <span>{t("bulkAnnul.totalItems", "Total de items")}:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedItems.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>{t("bulkAnnul.totalQuantity", "Cantidad total")}:</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {totals.totalQuantity}
                  </span>
                </div>
                <div className="flex justify-between border-t border-orange-200 pt-2 dark:border-orange-700">
                  <span className="font-semibold">
                    {t("bulkAnnul.totalAmount", "Monto aproximado")}:
                  </span>
                  <span className="font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(totals.totalAmount)}
                  </span>
                </div>
                <p className="pt-1 text-xs text-gray-500 dark:text-gray-400">
                  {hasOrderLevelDiscount
                    ? t(
                        "bulkAnnul.amountNoteWithOrderDiscount",
                        "El monto incluye descuentos de items y orden distribuidos proporcionalmente. El monto final puede variar levemente por redondeos."
                      )
                    : t(
                        "bulkAnnul.amountNote",
                        "El monto incluye descuentos y impuestos. El monto final puede variar levemente por redondeos."
                      )}
                </p>
              </div>
            </div>
          )}
        </div>

        <ModalFooter>
          <Button
            onClick={handleConfirm}
            disabled={isLoading || selectedItems.length === 0}
            className="min-w-[140px]"
          >
            {isLoading
              ? t("common.processing", "Procesando...")
              : t("bulkAnnul.confirm", "Anular Items") +
                (selectedItems.length > 0 ? ` (${selectedItems.length})` : "")}
          </Button>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {t("common.cancel", "Cancelar")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

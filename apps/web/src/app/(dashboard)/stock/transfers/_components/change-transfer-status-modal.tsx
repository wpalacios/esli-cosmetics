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
import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { StockTransfer } from "@/actions/stock-transfers";
import { BiInfoCircle, BiErrorCircle } from "react-icons/bi";
import { NumberInput } from "@/components/ui/number-input";
import { getStockLevelsByProductVariantsAndLocation } from "@/actions/stock-levels";
import { useQuery } from "@tanstack/react-query";
import { useClipboard } from "@esli-cosmetics/utils";
import { CopyIcon } from "@radix-ui/react-icons";
import { useToast } from "@/hooks/toast/use-toast";

type ActionType = "ACCEPT" | "DISPATCH" | "RECEIVE";

interface ChangeTransferStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: {
    items: Array<{
      itemId: string;
      quantitySent?: number;
      quantityReceived?: number;
      discrepancyType?: "DAMAGE" | "NOT_RECEIVED";
    }>;
    note?: string;
  }) => void;
  transfer: StockTransfer;
  action: ActionType;
  isLoading?: boolean;
}

interface SelectedItem {
  id: string;
  itemId: string;
  name: string;
  quantityRequested: number;
  quantitySent?: number;
  maxQuantity: number;
  quantityReceived?: number;
  discrepancyType?: "DAMAGE" | "NOT_RECEIVED";
  productVariantId?: string | null;
  productId?: string;
  availableStock?: number;
  stockError?: boolean;
  sku?: string;
}

export function ChangeTransferStatusModal({
  isOpen,
  onClose,
  onConfirm,
  transfer,
  action,
  isLoading = false,
}: ChangeTransferStatusModalProps) {
  const { t } = useTranslation("stock");
  const { toast } = useToast();
  const { copy, hasCopied } = useClipboard();

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset submitting state when modal closes so double-submit is prevented on next open
  useEffect(() => {
    if (!isOpen) setIsSubmitting(false);
  }, [isOpen]);

  // Prepare product variant IDs for batch stock level fetch (only for DISPATCH action)
  const productVariantIds = useMemo(() => {
    if (action !== "DISPATCH" || !transfer.items) return [];
    return transfer.items
      .map(item => item.productVariantId)
      .filter((id): id is string => !!id);
  }, [action, transfer.items]);

  // Batch fetch stock levels for all items (only for DISPATCH action)
  const { data: stockLevels = [], isLoading: isLoadingStock } = useQuery({
    queryKey: [
      "stock-levels",
      "batch-by-location",
      transfer.fromLocationId,
      productVariantIds,
    ],
    queryFn: () =>
      getStockLevelsByProductVariantsAndLocation(
        productVariantIds,
        transfer.fromLocationId
      ),
    enabled:
      action === "DISPATCH" &&
      productVariantIds.length > 0 &&
      !!transfer.fromLocationId &&
      isOpen,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  // Create stock level map for quick lookup
  const stockLevelMap = useMemo(() => {
    const map = new Map<string, { quantity: number; reserved: number }>();
    stockLevels.forEach(sl => {
      if (sl.productVariantId) {
        map.set(sl.productVariantId, {
          quantity: Number(sl.quantity || 0),
          reserved: Number(sl.reserved || 0),
        });
      }
    });
    return map;
  }, [stockLevels]);

  // Initialize selected items from transfer items (only when modal opens)
  useEffect(() => {
    if (!isOpen || !transfer.items) return;

    const items: SelectedItem[] = transfer.items.map(item => {
      const maxQty =
        action === "DISPATCH"
          ? item.quantityRequested
          : action === "RECEIVE"
            ? item.quantitySent || item.quantityRequested
            : item.quantityRequested;

      const selectedItem: SelectedItem = {
        id: item.id,
        itemId: item.id,
        name:
          item.productVariant?.name ||
          item.product?.name ||
          t("transfers.modal.unknownProduct"),
        quantityRequested: item.quantityRequested,
        maxQuantity: maxQty,
        productVariantId: item.productVariantId || null,
        productId: item.productId,
        sku:
          (item.productVariant as any)?.sku ||
          (item.product as any)?.sku ||
          undefined,
      };

      if (item.quantitySent !== undefined) {
        selectedItem.quantitySent = item.quantitySent;
      }
      // if (item.quantityReceived !== undefined) {
      selectedItem.quantityReceived = item.quantityReceived || 0;
      // }
      selectedItem.stockError = false;

      return selectedItem;
    });
    setSelectedItems(items);
    setNote("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, action]);

  // Update available stock when stock levels are loaded (only for DISPATCH)
  useEffect(() => {
    if (!isOpen || action !== "DISPATCH" || stockLevels.length === 0) return;

    setSelectedItems(prev =>
      prev.map(item => {
        if (!item.productVariantId) return item;

        const stockLevel = stockLevelMap.get(item.productVariantId);
        const availableStock = stockLevel
          ? Math.max(0, stockLevel.quantity - stockLevel.reserved)
          : 0;

        return {
          ...item,
          availableStock,
        };
      })
    );
  }, [isOpen, action, stockLevels, stockLevelMap]);

  const handleQuantityChange = (
    itemId: string,
    field: "quantitySent" | "quantityReceived",
    value: number
  ) => {
    setSelectedItems(prev =>
      prev.map(item => {
        if (item.itemId !== itemId) return item;

        let newValue = value;
        if (field === "quantitySent") {
          // For dispatch, limit by available stock and requested quantity
          const maxAllowed = item.availableStock
            ? Math.min(item.maxQuantity, item.availableStock)
            : item.maxQuantity;
          newValue = Math.max(0, Math.min(value, maxAllowed));
        } else {
          // For receive, limit by max quantity
          newValue = Math.max(0, Math.min(value, item.maxQuantity));
        }

        // Update stock error status
        const stockError =
          field === "quantitySent" &&
          item.availableStock !== undefined &&
          newValue > item.availableStock;

        const updatedItem: SelectedItem = { ...item };
        if (field === "quantitySent") {
          updatedItem.quantitySent = newValue;
        } else {
          updatedItem.quantityReceived = newValue;
        }
        updatedItem.stockError = stockError;
        return updatedItem;
      })
    );
  };

  const handleDiscrepancyTypeChange = (
    itemId: string,
    type: "DAMAGE" | "NOT_RECEIVED" | undefined
  ) => {
    setSelectedItems(prev =>
      prev.map(item => {
        if (item.itemId !== itemId) return item;
        const updatedItem: SelectedItem = { ...item };
        if (type !== undefined) {
          updatedItem.discrepancyType = type;
        } else {
          delete updatedItem.discrepancyType;
        }
        return updatedItem;
      })
    );
  };

  const handleConfirm = async () => {
    setError(null);
    setIsSubmitting(true);

    // For DISPATCH action, re-validate stock levels before submission
    if (action === "DISPATCH") {
      try {
        // Re-fetch stock levels to get the latest data
        const freshStockLevels =
          await getStockLevelsByProductVariantsAndLocation(
            productVariantIds,
            transfer.fromLocationId
          );

        // Create fresh stock level map
        const freshStockLevelMap = new Map<
          string,
          { quantity: number; reserved: number }
        >();
        freshStockLevels.forEach(sl => {
          if (sl.productVariantId) {
            freshStockLevelMap.set(sl.productVariantId, {
              quantity: Number(sl.quantity || 0),
              reserved: Number(sl.reserved || 0),
            });
          }
        });

        // Aggregate quantities by unique product/variant to validate total available stock
        const quantityAggregator = new Map<
          string,
          {
            productVariantId: string;
            totalQuantity: number;
            itemIds: string[];
          }
        >();

        for (const item of selectedItems) {
          if (!item.productVariantId) continue;

          const key = item.productVariantId;
          const existing = quantityAggregator.get(key);
          if (existing) {
            existing.totalQuantity += item.quantitySent || 0;
            existing.itemIds.push(item.itemId);
          } else {
            quantityAggregator.set(key, {
              productVariantId: item.productVariantId,
              totalQuantity: item.quantitySent || 0,
              itemIds: [item.itemId],
            });
          }
        }

        // Update items with fresh stock data and check for errors
        let hasStockErrors = false;
        const updatedItems = selectedItems.map(item => {
          if (!item.productVariantId) return item;

          const stockLevel = freshStockLevelMap.get(item.productVariantId);
          const freshAvailableStock = stockLevel
            ? Math.max(0, stockLevel.quantity - stockLevel.reserved)
            : 0;

          // Check if aggregated quantity for this variant exceeds available stock
          const aggregated = quantityAggregator.get(item.productVariantId);
          const aggregatedExceedsStock = aggregated
            ? aggregated.totalQuantity > freshAvailableStock
            : false;

          const itemStockError =
            (item.quantitySent || 0) > freshAvailableStock ||
            aggregatedExceedsStock;

          if (itemStockError) {
            hasStockErrors = true;
          }

          return {
            ...item,
            availableStock: freshAvailableStock,
            stockError: itemStockError,
          };
        });

        // Update state with fresh stock data
        setSelectedItems(updatedItems);

        // If there are stock errors, prevent submission and show error
        if (hasStockErrors) {
          setError(t("transfers.modal.stockValidationFailed"));
          setIsSubmitting(false);
          return;
        }
      } catch (error) {
        console.error("Error validating stock:", error);
        setError(
          t("transfers.modal.stockValidationError") ||
            "Error validating stock levels"
        );
        setIsSubmitting(false);
        return;
      }
    }

    // Validate based on action
    if (action === "DISPATCH") {
      for (const item of selectedItems) {
        if (!item.quantitySent || item.quantitySent <= 0) {
          setError(t("transfers.modal.errorAllItemsQuantitySent"));
          setIsSubmitting(false);
          return;
        }
        if (item.quantitySent > item.quantityRequested) {
          setError(
            t("transfers.modal.errorQuantitySentExceeds", { name: item.name })
          );
          setIsSubmitting(false);
          return;
        }
        // Validate available stock (using fresh data from state)
        if (
          item.availableStock !== undefined &&
          item.quantitySent > item.availableStock
        ) {
          setError(
            t("transfers.modal.errorInsufficientStock", {
              name: item.name,
              available: item.availableStock,
            })
          );
          setIsSubmitting(false);
          return;
        }
      }
    } else if (action === "RECEIVE") {
      for (const item of selectedItems) {
        if (item.quantityReceived === undefined || item.quantityReceived < 0) {
          setError(t("transfers.modal.errorAllItemsQuantityReceived"));
          setIsSubmitting(false);
          return;
        }

        const quantitySent = item.quantitySent || item.quantityRequested;

        // Check for discrepancies
        if (item.quantityReceived < quantitySent) {
          // Missing items - require DAMAGE or NOT_RECEIVED
          if (
            !item.discrepancyType ||
            (item.discrepancyType !== "DAMAGE" &&
              item.discrepancyType !== "NOT_RECEIVED")
          ) {
            setError(
              t("transfers.modal.errorQuantityReceivedLess", {
                name: item.name,
              })
            );
            setIsSubmitting(false);
            return;
          }
          if (!note) {
            setError(t("transfers.modal.errorNoteRequired"));
            setIsSubmitting(false);
            return;
          }
        } else if (item.quantityReceived > quantitySent) {
          // Extra items are not allowed - received cannot exceed sent
          setError(
            t("transfers.modal.errorQuantityReceivedMore", { name: item.name })
          );
          setIsSubmitting(false);
          return;
        }
      }
    }

    onConfirm({
      items: selectedItems.map(item => ({
        itemId: item.itemId,
        ...(action === "DISPATCH" && { quantitySent: item.quantitySent }),
        ...(action === "RECEIVE" && {
          quantityReceived: item.quantityReceived,
          discrepancyType: item.discrepancyType,
        }),
      })),
      ...(note && { note }),
    });
  };

  const handleClose = () => {
    setSelectedItems([]);
    setNote("");
    setError(null);
    onClose();
  };

  const getActionTitle = () => {
    switch (action) {
      case "ACCEPT":
        return t("transfers.modal.acceptTitle");
      case "DISPATCH":
        return t("transfers.modal.dispatchTitle");
      case "RECEIVE":
        return t("transfers.modal.receiveTitle");
      default:
        return t("transfers.modal.acceptTitle");
    }
  };

  const getActionDescription = () => {
    switch (action) {
      case "ACCEPT":
        return t("transfers.modal.acceptDescription");
      case "DISPATCH":
        return t("transfers.modal.dispatchDescription");
      case "RECEIVE":
        return t("transfers.modal.receiveDescription");
      default:
        return "";
    }
  };

  const hasDiscrepancies = useMemo(() => {
    if (action !== "RECEIVE") return false;
    return selectedItems.some(item => {
      const quantitySent = item.quantitySent || item.quantityRequested;
      return (
        item.quantityReceived !== undefined &&
        item.quantityReceived !== quantitySent
      );
    });
  }, [selectedItems, action]);

  // Check if receive form is valid (all quantities filled and discrepancy types selected if needed)
  const isReceiveFormValid = useMemo(() => {
    if (action !== "RECEIVE") return true;

    // Check if all items have quantityReceived > 0
    const allQuantitiesFilled = selectedItems.every(
      item => item.quantityReceived !== undefined
    );

    if (!allQuantitiesFilled) return false;

    // Check if all discrepancies have a type selected
    const allDiscrepanciesHaveType = selectedItems.every(item => {
      const quantitySent = item.quantitySent || item.quantityRequested;
      const quantityReceived = item.quantityReceived || 0;

      // If there's a discrepancy (received < sent), must have discrepancyType
      if (quantityReceived < quantitySent) {
        return (
          item.discrepancyType === "DAMAGE" ||
          item.discrepancyType === "NOT_RECEIVED"
        );
      }

      return true; // No discrepancy, no type needed
    });

    return allDiscrepanciesHaveType;
  }, [selectedItems, action]);

  // Check if any item has stock errors (for DISPATCH action)
  const hasStockErrors = useMemo(() => {
    if (action !== "DISPATCH") return false;
    return selectedItems.some(
      item =>
        item.stockError === true ||
        (item.availableStock !== undefined &&
          (item.quantitySent || 0) > item.availableStock)
    );
  }, [selectedItems, action]);

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent
        size="2xl"
        className="mx-2 max-h-[95vh] w-full max-w-[95vw] overflow-y-auto sm:mx-auto sm:max-h-[90vh] sm:max-w-[700px]"
      >
        <ModalHeader>
          <ModalTitle>{getActionTitle()}</ModalTitle>
          <ModalDescription>{getActionDescription()}</ModalDescription>
        </ModalHeader>

        <div className="space-y-4 py-2 sm:space-y-6 sm:py-4">
          {/* Info Banner */}
          {action === "RECEIVE" ||
            (action === "DISPATCH" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5 dark:border-blue-800 dark:bg-blue-900/20 sm:p-3">
                <div className="flex items-start gap-2">
                  <BiInfoCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400 sm:h-5 sm:w-5" />
                  <div className="text-xs leading-relaxed text-blue-800 dark:text-blue-200 sm:text-sm">
                    {action === "DISPATCH"
                      ? t("transfers.modal.infoDispatch")
                      : t("transfers.modal.infoReceive")}
                  </div>
                </div>
              </div>
            ))}

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 dark:border-red-800 dark:bg-red-900/20 sm:p-3">
              <div className="flex items-start gap-2">
                <BiInfoCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400 sm:h-5 sm:w-5" />
                <div className="border-red-300 text-red-600 dark:border-red-700 dark:text-red-400">
                  {error}
                </div>
              </div>
            </div>
          )}

          {/* Items List */}
          {selectedItems.length > 0 && (
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base">
                {t("transfers.modal.itemsCount", {
                  count: selectedItems.length,
                })}
              </Label>
              <div className="max-h-[40vh] space-y-2 overflow-y-auto pr-1 sm:max-h-[300px] sm:space-y-3 sm:pr-2">
                {selectedItems.map(item => {
                  const hasStockError =
                    action === "DISPATCH" &&
                    (item.stockError ||
                      (item.availableStock !== undefined &&
                        (item.quantitySent || 0) > item.availableStock));

                  return (
                    <div
                      key={item.itemId}
                      className={`relative flex flex-col gap-2 rounded-lg border p-2.5 transition-all sm:flex-row sm:items-center sm:gap-3 sm:p-3 ${
                        hasStockError
                          ? "border-2 border-red-500 bg-red-50/50 shadow-red-500/10 dark:bg-red-950/30"
                          : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
                      }`}
                    >
                      {/* Stock Error Badge */}
                      {hasStockError && (
                        <div className="absolute -right-2 -top-2 z-10 sm:-right-2.5 sm:-top-2.5">
                          <div className="flex max-w-[calc(100vw-2rem)] items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[10px] font-semibold text-white shadow-lg sm:max-w-none sm:gap-1.5 sm:px-3 sm:py-1.5 sm:text-xs">
                            <BiErrorCircle className="h-3 w-3 flex-shrink-0 sm:h-3.5 sm:w-3.5" />
                            <span className="whitespace-nowrap">
                              {t("transfers.modal.insufficientStock")} -{" "}
                              {t("transfers.modal.available")}:{" "}
                              {item.availableStock ?? 0}
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="min-w-0 flex-1 pr-8 sm:pr-0">
                        <div className="mb-1 break-words text-xs font-medium text-gray-900 dark:text-white sm:text-sm">
                          {item.name}
                        </div>
                        {item.sku && String(item.sku).trim() && (
                          <div className="mb-1.5">
                            <span className="inline-flex items-center rounded border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-[10px] text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 sm:text-xs">
                              <span>SKU: {item.sku}</span>
                              <button
                                type="button"
                                onClick={e => {
                                  e.stopPropagation();
                                  copy(item.sku!);
                                  toast({
                                    title: t("transfers.toast.success"),
                                    description: t("table.copied", "¡Copiado!"),
                                    type: "success",
                                  });
                                }}
                                className="ml-1.5 rounded p-0.5 transition-colors hover:bg-gray-200 dark:hover:bg-gray-700"
                                title={
                                  hasCopied
                                    ? t("table.copied", "¡Copiado!")
                                    : t("table.copySku", "Copiar SKU")
                                }
                              >
                                <CopyIcon
                                  className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${
                                    hasCopied
                                      ? "text-green-600 dark:text-green-400"
                                      : "text-gray-500 dark:text-gray-400"
                                  }`}
                                />
                                <span className="sr-only">
                                  {t("table.copySku", "Copiar SKU")}
                                </span>
                              </button>
                            </span>
                          </div>
                        )}
                        <div className="mt-0.5 flex flex-wrap gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:mt-1.5 sm:text-sm">
                          <span>
                            {t("transfers.modal.requested", {
                              quantity: item.quantityRequested,
                            })}
                          </span>
                        </div>
                        {item.quantitySent !== undefined && (
                          <div className="mt-0.5 flex flex-wrap gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 sm:mt-1.5 sm:text-sm">
                            <span>
                              {t("transfers.modal.sent", {
                                quantity: item.quantitySent,
                              })}
                            </span>
                          </div>
                        )}
                        {action === "DISPATCH" &&
                          item.availableStock !== undefined && (
                            <div
                              className={`mt-1 text-xs font-semibold sm:mt-1.5 sm:text-sm ${
                                hasStockError
                                  ? "text-red-700 dark:text-red-400"
                                  : item.availableStock > 0
                                    ? "text-green-700 dark:text-green-400"
                                    : "text-gray-700 dark:text-gray-400"
                              }`}
                            >
                              <span>{t("transfers.modal.available")}:</span>{" "}
                              <span
                                className={`${
                                  hasStockError
                                    ? "text-red-700 dark:text-red-300"
                                    : item.availableStock > 0
                                      ? "text-green-700 dark:text-green-300"
                                      : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {item.availableStock}
                              </span>
                            </div>
                          )}
                      </div>
                      <div className="flex w-full flex-shrink-0 items-center gap-2 sm:w-auto">
                        {action === "DISPATCH" && (
                          <div className="flex w-full flex-col gap-2 sm:w-auto">
                            <NumberInput
                              min={0}
                              max={
                                item.availableStock !== undefined
                                  ? Math.min(
                                      item.maxQuantity,
                                      item.availableStock
                                    )
                                  : item.maxQuantity
                              }
                              step="1"
                              value={item.quantitySent || 0}
                              onChange={value => {
                                handleQuantityChange(
                                  item.itemId,
                                  "quantitySent",
                                  Math.round(value)
                                );
                              }}
                              className="w-full sm:min-w-32"
                              disabled={isLoadingStock}
                            />
                          </div>
                        )}
                        {action === "RECEIVE" && (
                          <div className="flex w-full flex-col gap-2 sm:w-auto">
                            <NumberInput
                              min={0}
                              max={item.maxQuantity} // Cannot exceed sent quantity
                              step="1"
                              value={item.quantityReceived || 0}
                              onChange={value => {
                                handleQuantityChange(
                                  item.itemId,
                                  "quantityReceived",
                                  Math.round(value)
                                );
                              }}
                              className="w-full sm:min-w-32"
                            />
                            {(item.quantityReceived || 0) !==
                              (item.quantitySent || item.quantityRequested) && (
                              <SearchableSelect
                                options={[
                                  {
                                    value: "DAMAGE",
                                    label: t(
                                      "transfers.modal.discrepancyDamage"
                                    ),
                                  },
                                  {
                                    value: "NOT_RECEIVED",
                                    label: t(
                                      "transfers.modal.discrepancyNotReceived"
                                    ),
                                  },
                                ]}
                                value={item.discrepancyType || ""}
                                onValueChange={value =>
                                  handleDiscrepancyTypeChange(
                                    item.itemId,
                                    value as
                                      | "DAMAGE"
                                      | "NOT_RECEIVED"
                                      | undefined
                                  )
                                }
                                placeholder={t(
                                  "transfers.modal.discrepancyType"
                                )}
                                allowSearch={false}
                                showClearButton={false}
                                className="w-full sm:min-w-32"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="note" className="text-sm sm:text-base">
              {hasDiscrepancies
                ? t("transfers.modal.noteRequired")
                : t("transfers.modal.note")}
              {hasDiscrepancies && " *"}
            </Label>
            <Textarea
              id="note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={
                action === "DISPATCH"
                  ? t("transfers.modal.notePlaceholderDispatch")
                  : t("transfers.modal.notePlaceholderReceive")
              }
              rows={3}
              className={`resize-none text-sm sm:text-base ${error && hasDiscrepancies && !note.trim() && error === t("transfers.modal.errorNoteRequired") ? "border-red-500" : ""}`}
            />
            {error &&
              hasDiscrepancies &&
              !note.trim() &&
              error === t("transfers.modal.errorNoteRequired") && (
                <p className="text-xs text-red-600 dark:text-red-400 sm:text-sm">
                  {t("transfers.modal.errorNoteRequired")}
                </p>
              )}
          </div>

          {/* Summary */}
          {selectedItems.length > 0 && action === "DISPATCH" && (
            <div className="rounded-lg border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-3 dark:border-orange-800 dark:from-orange-900/20 dark:to-amber-900/20 sm:p-4">
              <div className="mb-2 text-xs font-semibold text-gray-900 dark:text-white sm:mb-3 sm:text-sm">
                {t("transfers.modal.summary")}
              </div>
              <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 sm:space-y-2 sm:text-sm">
                <div className="flex items-center justify-between">
                  <span>{t("transfers.modal.totalItems")}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {selectedItems.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="break-words pr-2">
                    {t("transfers.modal.totalQuantityToSend")}
                  </span>
                  <span className="whitespace-nowrap font-semibold text-gray-900 dark:text-white">
                    {selectedItems.reduce(
                      (sum, item) => sum + (item.quantitySent || 0),
                      0
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <ModalFooter className="flex-col gap-2">
          <Button
            onClick={handleConfirm}
            disabled={
              isLoading ||
              isSubmitting ||
              selectedItems.length === 0 ||
              hasStockErrors ||
              isLoadingStock ||
              !isReceiveFormValid
            }
            className="w-full sm:min-w-[140px]"
          >
            {isLoading || isSubmitting
              ? t("transfers.modal.processing")
              : getActionTitle()}
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading || isSubmitting}
            className="w-full sm:w-auto"
          >
            {t("transfers.modal.cancel")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

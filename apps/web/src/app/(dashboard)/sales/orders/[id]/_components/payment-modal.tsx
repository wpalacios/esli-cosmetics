"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  Button,
  Input,
  Label,
} from "@esli-cosmetics/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BiCreditCard, BiMoney, BiTransfer } from "react-icons/bi";
import { NumberInput } from "@/components/ui/number-input";
import { formatCurrency } from "@esli-cosmetics/utils";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payments: PaymentItem[]) => void;
  amount: number;
  title?: string;
  description?: string;
  isLoading?: boolean;
}

export interface PaymentItem {
  paymentType: "CASH" | "CARD" | "TRANSFER";
  amount: number;
  provider?: string;
  transactionReference?: string;
}

export function PaymentModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  title,
  description,
  isLoading = false,
}: PaymentModalProps) {
  const { t } = useTranslation("orders");
  const PAYMENT_TYPES = [
    { value: "CASH", label: t("payment.cash") || "Cash", icon: BiMoney },
    { value: "CARD", label: t("payment.card") || "Card", icon: BiCreditCard },
    {
      value: "TRANSFER",
      label: t("payment.transfer") || "Transfer",
      icon: BiTransfer,
    },
  ];

  const [payments, setPayments] = useState<PaymentItem[]>([
    { paymentType: "CASH", amount },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset payments when modal opens or amount changes
  useEffect(() => {
    if (isOpen) {
      setPayments([{ paymentType: "CASH", amount }]);
    } else {
      setIsSubmitting(false);
    }
  }, [isOpen, amount]);

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = amount - totalPaid;

  const addPayment = () => {
    setPayments([
      ...payments,
      { paymentType: "CASH", amount: Math.max(0, remaining) },
    ]);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (
    index: number,
    field: keyof PaymentItem,
    value: string | number
  ) => {
    const updated = [...payments];
    updated[index] = { ...updated[index], [field]: value } as PaymentItem;
    setPayments(updated);
  };

  const handleConfirm = () => {
    if (totalPaid <= 0 || totalPaid > amount || isSubmitting || isLoading)
      return;
    setIsSubmitting(true);
    onConfirm(payments);
  };

  const getPaymentIcon = (type: string) => {
    const paymentType = PAYMENT_TYPES.find(pt => pt.value === type);
    return paymentType ? paymentType.icon : BiMoney;
  };

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalContent size="md" className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>{title || t("payment.title") || "Payment"}</ModalTitle>
          {description && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {description}
            </p>
          )}
        </ModalHeader>

        <div className="space-y-6">
          {/* Amount Summary */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("payment.totalAmount") || "Total Amount"}:
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("payment.totalPaid") || "Total Paid"}:
              </span>
              <span className="text-lg font-bold text-[#ff48b0]">
                {formatCurrency(totalPaid)}
              </span>
            </div>
            {remaining > 0 && (
              <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {t("payment.remaining") || "Remaining"}:
                </span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(remaining)}
                </span>
              </div>
            )}
            {remaining < 0 && (
              <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  {t("payment.change") || "Change"}:
                </span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(Math.abs(remaining))}
                </span>
              </div>
            )}
          </div>

          {/* Payment Items */}
          <div className="space-y-4">
            {payments.map((payment, index) => {
              const Icon = getPaymentIcon(payment.paymentType);
              return (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {t("payment.payment") || "Payment"} {index + 1}
                      </span>
                    </div>
                    {payments.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePayment(index)}
                        className="text-red-600 hover:text-red-700"
                      >
                        {t("payment.remove") || "Remove"}
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label>
                        {t("payment.paymentType") || "Payment Type"}
                      </Label>
                      <Select
                        value={payment.paymentType}
                        onValueChange={(value: "CASH" | "CARD" | "TRANSFER") =>
                          updatePayment(index, "paymentType", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              t("payment.selectPaymentType") ||
                              "Select payment type"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="z-[10000] bg-white dark:bg-gray-800">
                          {PAYMENT_TYPES.map(type => {
                            const TypeIcon = type.icon;
                            return (
                              <SelectItem
                                key={type.value}
                                value={type.value}
                                textValue={type.label}
                              >
                                <div className="flex items-center gap-2">
                                  <TypeIcon className="h-4 w-4" />
                                  <span>{type.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>{t("payment.amount") || "Amount"}</Label>
                      <NumberInput
                        value={payment.amount}
                        onChange={value =>
                          updatePayment(index, "amount", value || 0)
                        }
                        min={0}
                        max={amount}
                        step={0.01}
                      />
                    </div>
                  </div>

                  {payment.paymentType === "CARD" && (
                    <div>
                      <Label>
                        {t("payment.provider") || "Provider"} (optional)
                      </Label>
                      <Input
                        value={payment.provider || ""}
                        onChange={e =>
                          updatePayment(index, "provider", e.target.value)
                        }
                        placeholder={
                          t("payment.providerPlaceholder") ||
                          "e.g., Visa, Mastercard"
                        }
                      />
                    </div>
                  )}

                  <div>
                    <Label>
                      {t("payment.transactionReference") ||
                        "Transaction Reference"}{" "}
                      (optional)
                    </Label>
                    <Input
                      value={payment.transactionReference || ""}
                      onChange={e =>
                        updatePayment(
                          index,
                          "transactionReference",
                          e.target.value
                        )
                      }
                      placeholder={
                        t("payment.transactionPlaceholder") ||
                        "Transaction reference"
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {remaining > 0 && (
            <Button variant="outline" onClick={addPayment} className="w-full">
              {t("payment.addPayment") || "+ Add Payment"}
            </Button>
          )}
        </div>

        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={
              isLoading || isSubmitting || totalPaid <= 0 || totalPaid > amount
            }
          >
            {isLoading || isSubmitting
              ? t("common.loading") || "Loading..."
              : t("payment.confirm") || "Confirm Payment"}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading || isSubmitting}
          >
            {t("common.cancel") || "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

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
import { CreateCustomerPaymentRequest } from "@/actions/customers";

interface CustomerRefundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CreateCustomerPaymentRequest) => void | Promise<void>;
  /** Closing balance (negative = credit in favor). Max refund = |closingBalance|. */
  closingBalance: number;
  isLoading?: boolean;
}

export function CustomerRefundModal({
  isOpen,
  onClose,
  onConfirm,
  closingBalance,
  isLoading = false,
}: CustomerRefundModalProps) {
  const { t } = useTranslation("customers");
  const PAYMENT_TYPES = [
    { value: "CASH", label: t("payment.cash") || "Cash", icon: BiMoney },
    { value: "CARD", label: t("payment.card") || "Card", icon: BiCreditCard },
    {
      value: "TRANSFER",
      label: t("payment.transfer") || "Transfer",
      icon: BiTransfer,
    },
  ];

  const [paymentType, setPaymentType] = useState<"CASH" | "CARD" | "TRANSFER">(
    "CASH"
  );
  const maxRefund = Math.abs(closingBalance);
  const [amount, setAmount] = useState<number>(maxRefund);
  const [provider, setProvider] = useState<string>("");
  const [transactionReference, setTransactionReference] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount(maxRefund);
      setPaymentType("CASH");
      setProvider("");
      setTransactionReference("");
    } else {
      setIsSubmitting(false);
    }
  }, [isOpen, maxRefund]);

  const handleConfirm = async () => {
    if (amount <= 0 || amount > maxRefund || isSubmitting || isLoading) return;
    setIsSubmitting(true);
    try {
      await onConfirm({
        amount,
        paymentType,
        ...(provider && { provider }),
        ...(transactionReference && { transactionReference }),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting || isLoading) return;
    onClose();
  };

  const getPaymentIcon = (type: string) => {
    const pt = PAYMENT_TYPES.find(p => p.value === type);
    return pt ? pt.icon : BiMoney;
  };

  const Icon = getPaymentIcon(paymentType);

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent size="md" className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>
            {t("payment.refundTitle") || "Refund to Customer"}
          </ModalTitle>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t("payment.refundDesc") ||
              "Record the refund to the customer (cash, transfer, etc.). The credit balance will be reduced."}
          </p>
        </ModalHeader>

        <div className="space-y-6">
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("statement.closingBalance") || "Saldo Final"}:
              </span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                {formatCurrency(closingBalance)}
              </span>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("payment.totalToRefund") || "Amount to refund"}:
              </span>
              <span className="text-lg font-bold text-gray-900 dark:text-white">
                {formatCurrency(maxRefund)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("payment.amount") || "Amount"}:
              </span>
              <span className="text-lg font-bold text-[#ff48b0]">
                {formatCurrency(amount)}
              </span>
            </div>
            {amount > maxRefund && (
              <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {t("payment.exceedsTotal") || "Exceeds max refund"}:
                </span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(amount - maxRefund)}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label>{t("payment.paymentType") || "Payment Type"}</Label>
              <Select
                value={paymentType}
                onValueChange={(value: "CASH" | "CARD" | "TRANSFER") =>
                  setPaymentType(value)
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      t("payment.selectPaymentType") || "Select payment type"
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
                value={amount}
                onChange={value => setAmount(value || 0)}
                min={0}
                max={maxRefund}
                step={0.01}
              />
            </div>

            {paymentType === "CARD" && (
              <div>
                <Label>{t("payment.provider") || "Provider"} (optional)</Label>
                <Input
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  placeholder={
                    t("payment.providerPlaceholder") || "e.g., Visa, Mastercard"
                  }
                />
              </div>
            )}

            <div>
              <Label>
                {t("payment.transactionReference") || "Transaction Reference"}{" "}
                (optional)
              </Label>
              <Input
                value={transactionReference}
                onChange={e => setTransactionReference(e.target.value)}
                placeholder={
                  t("payment.transactionPlaceholder") || "Transaction reference"
                }
              />
            </div>
          </div>
        </div>

        <ModalFooter>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={
              isLoading || isSubmitting || amount <= 0 || amount > maxRefund
            }
          >
            {isLoading || isSubmitting
              ? t("form.loading") || "Loading..."
              : t("payment.confirmRefund") || "Confirm Refund"}
          </Button>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading || isSubmitting}
          >
            {t("payment.cancel") || "Cancel"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

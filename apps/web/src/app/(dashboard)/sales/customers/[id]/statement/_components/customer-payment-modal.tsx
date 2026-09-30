"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@esli-cosmetics/ui";
import { Button, Input, Label } from "@esli-cosmetics/ui";
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

interface CustomerPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CreateCustomerPaymentRequest) => void | Promise<void>;
  /** Amount due = Saldo Final from ledger (opening + charges - payments). This is the max payment. */
  amountDue: number;
  openingBalance: number;
  /** Sum of active credit outstanding amounts (for context). */
  outstandingAmount: number;
  /** Closing balance from statement (Saldo Final). May be negative if customer has credit. */
  closingBalance: number;
  isLoading?: boolean;
}

export function CustomerPaymentModal({
  isOpen,
  onClose,
  onConfirm,
  amountDue,
  openingBalance,
  outstandingAmount,
  closingBalance,
  isLoading = false,
}: CustomerPaymentModalProps) {
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
  // Total payable = Saldo Final (amount due from ledger). Includes initial balance and all payments.
  const totalPayable = amountDue;

  const [amount, setAmount] = useState<number>(totalPayable);
  const [provider, setProvider] = useState<string>("");
  const [transactionReference, setTransactionReference] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens or amounts change
  useEffect(() => {
    if (isOpen) {
      setAmount(totalPayable);
      setPaymentType("CASH");
      setProvider("");
      setTransactionReference("");
    } else {
      setIsSubmitting(false);
    }
  }, [isOpen, totalPayable]);

  const handleConfirm = async () => {
    if (amount <= 0 || amount > totalPayable || isSubmitting || isLoading)
      return;
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
    const paymentType = PAYMENT_TYPES.find(pt => pt.value === type);
    return paymentType ? paymentType.icon : BiMoney;
  };

  const Icon = getPaymentIcon(paymentType);

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent size="md" className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>
            {t("payment.customerAccountPayment") || "Customer Account Payment"}
          </ModalTitle>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t("payment.customerAccountPaymentDesc") ||
              "Enter payment details to apply to all outstanding credits"}
          </p>
        </ModalHeader>

        <div className="space-y-6">
          {/* Amount Summary - matches statement Saldo Final and transactions */}
          <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
            {openingBalance !== 0 && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("statement.openingBalance") || "Opening Balance"}:
                </span>
                <span
                  className={`text-lg font-bold ${openingBalance < 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-white"}`}
                >
                  {formatCurrency(openingBalance)}
                </span>
              </div>
            )}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("statement.closingBalance") || "Saldo Final"}:
              </span>
              <span
                className={`text-lg font-bold ${closingBalance < 0 ? "text-green-600 dark:text-green-400" : "text-gray-900 dark:text-white"}`}
              >
                {formatCurrency(closingBalance)}
              </span>
            </div>
            {totalPayable > 0 && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t("payment.totalPayable") || "Total to pay"}:
                </span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {formatCurrency(totalPayable)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("payment.paymentAmount") || "Payment Amount"}:
              </span>
              <span className="text-lg font-bold text-[#ff48b0]">
                {formatCurrency(amount)}
              </span>
            </div>
            {amount > totalPayable && (
              <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
                <span className="text-sm font-medium text-red-600 dark:text-red-400">
                  {t("payment.exceedsTotal") || "Exceeds total payable amount"}:
                </span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(amount - totalPayable)}
                </span>
              </div>
            )}
          </div>

          {/* Payment Form */}
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
                max={totalPayable}
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
              isLoading || isSubmitting || amount <= 0 || amount > totalPayable
            }
          >
            {isLoading || isSubmitting
              ? t("form.loading") || "Loading..."
              : t("payment.confirm") || "Confirm Payment"}
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

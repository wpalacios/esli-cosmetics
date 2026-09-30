"use client";

import { useState, useEffect, useMemo } from "react";
import {
  BiCreditCard,
  BiMoney,
  BiTransfer,
  BiPlus,
  BiTrash,
} from "react-icons/bi";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@esli-cosmetics/ui";
import {
  Button,
  Input,
  Label,
  Badge,
  SearchableSelect,
} from "@esli-cosmetics/ui";
import type { SearchableSelectOption } from "@esli-cosmetics/ui";
import { Separator } from "@/components/ui/separator";
import type { Payment, SelectedCustomer } from "../pos-page-client";
import { NumberInput } from "@/components/ui/number-input";
import { formatCurrencyValue, CURRENCY_SIGN } from "@esli-cosmetics/utils";
import { getCustomerOutstandingCredits } from "@/actions/customers";
import { addDays, format } from "date-fns";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  totals: {
    subtotal: number;
    discountAmount: number;
    taxes: number;
    totalAmount: number;
  };
  onConfirm: (
    payments: Payment[],
    creditData?: CreditOrderData
  ) => void | Promise<void>;
  selectedCustomer?: SelectedCustomer | null;
  isSubmitting?: boolean;
}

interface CreditOrderData {
  creditType: "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL";
  paymentFrequency: "WEEKLY" | "BI_WEEKLY" | "MONTHLY";
  durationDays: number;
  firstDueDate: string;
  initialPayment: number;
}

export function CheckoutModal({
  isOpen,
  onClose,
  totals,
  onConfirm,
  selectedCustomer,
  isSubmitting = false,
}: CheckoutModalProps) {
  const { t } = useTranslation("pos");
  const PAYMENT_TYPES = [
    { value: "CASH", label: t("checkout.cash"), icon: BiMoney },
    { value: "CARD", label: t("checkout.card"), icon: BiCreditCard },
    { value: "TRANSFER", label: t("checkout.transfer"), icon: BiTransfer },
  ];

  // Options for SearchableSelect components
  const orderTypeOptions: SearchableSelectOption[] = [
    { value: "CASH", label: t("checkout.cash") },
    { value: "CREDIT", label: t("checkout.credit") },
  ];

  const creditTypeOptions: SearchableSelectOption[] = [
    { value: "SHORT_TERM", label: t("checkout.shortTerm") },
    { value: "EMPLOYEE_CREDIT", label: t("checkout.employeeCredit") },
    { value: "PROMOTIONAL", label: t("checkout.promotional") },
  ];

  const paymentFrequencyOptions: SearchableSelectOption[] = [
    { value: "WEEKLY", label: t("checkout.weekly") },
    { value: "BI_WEEKLY", label: t("checkout.biWeekly") },
    { value: "MONTHLY", label: t("checkout.monthly") },
  ];

  const durationOptions: SearchableSelectOption[] = [
    { value: "30", label: `30 ${t("checkout.days")}` },
    { value: "60", label: `60 ${t("checkout.days")}` },
    { value: "90", label: `90 ${t("checkout.days")}` },
  ];

  const paymentTypeOptions: SearchableSelectOption<{ icon: typeof BiMoney }>[] =
    [
      { value: "CASH", label: t("checkout.cash"), data: { icon: BiMoney } },
      {
        value: "CARD",
        label: t("checkout.card"),
        data: { icon: BiCreditCard },
      },
      {
        value: "TRANSFER",
        label: t("checkout.transfer"),
        data: { icon: BiTransfer },
      },
    ];
  const [payments, setPayments] = useState<Payment[]>([
    { paymentType: "CASH", amount: totals.totalAmount },
  ]);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CREDIT">("CASH");
  const [creditType, setCreditType] = useState<
    "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL"
  >("SHORT_TERM");
  const [paymentFrequency, setPaymentFrequency] = useState<
    "WEEKLY" | "BI_WEEKLY" | "MONTHLY"
  >("WEEKLY");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [firstDueDate, setFirstDueDate] = useState<string>("");
  const [lastDueDate, setLastDueDate] = useState<string>("");
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [creditLimitError, setCreditLimitError] = useState<string | null>(null);
  const [installmentCount, setInstallmentCount] = useState<number>(0);
  const [localIsSubmitting, setLocalIsSubmitting] = useState(false);

  // Reset payments when modal opens
  useEffect(() => {
    if (isOpen) {
      setPayments([{ paymentType: "CASH", amount: totals.totalAmount }]);
      setPaymentMethod("CASH");
      setCreditType("SHORT_TERM");
      setPaymentFrequency("WEEKLY");
      setDurationDays(30);
      setInitialPayment(0);
      setCreditLimitError(null);
      setLocalIsSubmitting(false);

      // First due date will be calculated by the useEffect based on frequency
    }
  }, [isOpen, totals.totalAmount]);

  // Reset local submitting state when parent's isSubmitting becomes false
  useEffect(() => {
    if (!isSubmitting) {
      setLocalIsSubmitting(false);
    }
  }, [isSubmitting]);

  // Calculate installment count and first due date when frequency or duration changes
  useEffect(() => {
    if (paymentMethod === "CREDIT" && durationDays > 0) {
      const frequencyDaysMap = {
        WEEKLY: 7,
        BI_WEEKLY: 15,
        MONTHLY: 30,
      };
      const frequencyDays = frequencyDaysMap[paymentFrequency];

      let count = 0;
      const today = new Date();
      // Normalize to start of day to avoid timezone issues
      today.setHours(0, 0, 0, 0);

      const firstDue = addDays(today, frequencyDays);
      // Normalize first due date to start of day
      firstDue.setHours(0, 0, 0, 0);

      switch (paymentFrequency) {
        case "WEEKLY":
          count = Math.floor(durationDays / frequencyDays);
          break;
        case "BI_WEEKLY":
          count = Math.floor(durationDays / frequencyDays);
          break;
        case "MONTHLY":
          count = Math.floor(durationDays / frequencyDays);
          break;
      }
      setInstallmentCount(count);

      // Calculate last due date based on first due date + (installmentCount - 1) * frequencyDays
      // This ensures it matches the last installment's due date
      if (count > 0) {
        const lastDue = addDays(firstDue, (count - 1) * frequencyDays);
        lastDue.setHours(0, 0, 0, 0);
        setLastDueDate(lastDue.toISOString().split("T")[0] || "");
      } else {
        setLastDueDate("");
      }

      firstDue && setFirstDueDate(firstDue.toISOString().split("T")[0] || "");
    }
  }, [paymentMethod, paymentFrequency, durationDays]);

  // Validate credit limit when customer or totals change
  useEffect(() => {
    if (
      paymentMethod === "CREDIT" &&
      selectedCustomer?.id &&
      selectedCustomer.creditAllowed
    ) {
      validateCreditLimit();
    } else {
      setCreditLimitError(null);
    }
  }, [
    paymentMethod,
    selectedCustomer?.id,
    selectedCustomer?.creditAllowed,
    selectedCustomer?.creditLimit,
    totals.totalAmount,
  ]);

  const validateCreditLimit = async () => {
    if (!selectedCustomer?.id || !selectedCustomer.creditAllowed) {
      return;
    }

    try {
      const { outstandingAmount, creditLimit } =
        await getCustomerOutstandingCredits(selectedCustomer.id);

      if (!creditLimit) {
        setCreditLimitError(null);
        return;
      }

      const totalWithOrder = outstandingAmount + totals.totalAmount;

      if (totalWithOrder > creditLimit) {
        setCreditLimitError(
          t("checkout.creditLimitExceeded", {
            limit: formatCurrencyValue(creditLimit),
            total: formatCurrencyValue(totalWithOrder),
          }) ||
            `Credit limit exceeded. Limit: ${formatCurrencyValue(creditLimit)}, Total with order: ${formatCurrencyValue(totalWithOrder)}. Order will be created as PENDING.`
        );
      } else {
        setCreditLimitError(null);
      }
    } catch (error) {
      console.error("Error validating credit limit:", error);
      // Don't block the user if validation fails, but log the error
      setCreditLimitError(null);
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totals.totalAmount - totalPaid;
  const change =
    totalPaid > totals.totalAmount ? totalPaid - totals.totalAmount : 0;

  const handleAddPayment = () => {
    setPayments([
      ...payments,
      { paymentType: "CASH", amount: Math.max(0, remaining) },
    ]);
  };

  const handleRemovePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const handleUpdatePayment = (
    index: number,
    field: keyof Payment,
    value: any
  ) => {
    setPayments(
      payments.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleConfirm = async () => {
    // Prevent submission if already submitting (check both local and parent state)
    if (isSubmitting || localIsSubmitting) {
      return;
    }

    // Set local submitting state immediately to prevent duplicate clicks
    setLocalIsSubmitting(true);

    try {
      if (paymentMethod === "CASH") {
        if (remaining > 0.01) {
          setLocalIsSubmitting(false);
          alert(t("checkout.insufficientPayment"));
          return;
        }

        // Normalize payments to match order total exactly
        // If there's change (overpayment), adjust the first payment to cap at order total
        const normalizedPayments: Payment[] = [...payments];
        const totalPaid = normalizedPayments.reduce(
          (sum, p) => sum + p.amount,
          0
        );

        if (
          totalPaid > totals.totalAmount &&
          normalizedPayments.length > 0 &&
          normalizedPayments[0]
        ) {
          // Adjust the first payment to make total equal to order total
          const difference = totalPaid - totals.totalAmount;
          const firstPayment = normalizedPayments[0];
          normalizedPayments[0] = {
            paymentType: firstPayment.paymentType,
            ...(firstPayment.provider && { provider: firstPayment.provider }),
            amount: Number((firstPayment.amount - difference).toFixed(2)),
            ...(firstPayment.transactionReference && {
              transactionReference: firstPayment.transactionReference,
            }),
          };
        }

        await onConfirm(normalizedPayments);
      } else {
        // CREDIT payment method
        if (!firstDueDate) {
          setLocalIsSubmitting(false);
          alert(
            t("checkout.firstDueDateRequired") || "First due date is required"
          );
          return;
        }

        if (initialPayment < 0 || initialPayment >= totals.totalAmount) {
          setLocalIsSubmitting(false);
          alert(
            t("checkout.invalidInitialPayment") ||
              "Initial payment must be between 0 and order total"
          );
          return;
        }

        const creditData: CreditOrderData = {
          creditType,
          paymentFrequency,
          durationDays,
          firstDueDate: new Date(firstDueDate).toISOString(),
          initialPayment,
        };

        // For credit orders, create a single payment for initial payment (if any)
        const creditPayments: Payment[] = [];
        if (initialPayment > 0) {
          creditPayments.push({
            paymentType: "DOWN_PAYMENT",
            amount: initialPayment,
          });
        }

        await onConfirm(creditPayments, creditData);
      }
    } catch (error) {
      // Error handling is done in the parent component (handleConfirmSale)
      // We just need to reset the local submitting state
      setLocalIsSubmitting(false);
    }
  };

  const getPaymentIcon = (type: string) => {
    const paymentType = PAYMENT_TYPES.find(pt => pt.value === type);
    return paymentType ? paymentType.icon : BiMoney;
  };

  // Calculate installment schedule - recalculates when dependencies change
  const installmentSchedule = useMemo(() => {
    if (paymentMethod !== "CREDIT" || !firstDueDate || installmentCount === 0) {
      return [];
    }

    const frequencyDaysMap = {
      WEEKLY: 7,
      BI_WEEKLY: 15,
      MONTHLY: 30,
    };
    const frequencyDays = frequencyDaysMap[paymentFrequency];
    const principalAmount = totals.totalAmount - initialPayment;

    // Calculate base installment amount and remainder properly for decimals
    // Round to 2 decimals for base amount
    const baseInstallmentAmount = Number(
      (principalAmount / installmentCount).toFixed(2)
    );
    // Calculate what the first (installmentCount - 1) installments will total
    const firstInstallmentsTotal =
      baseInstallmentAmount * (installmentCount - 1);
    // Last installment gets the remainder to ensure exact total
    const lastInstallmentAmount = Number(
      (principalAmount - firstInstallmentsTotal).toFixed(2)
    );

    const schedule = [];
    // Parse the date string properly to avoid timezone issues
    // firstDueDate is in format "dd/MM/yyyy", parse it as local date
    const dateParts = firstDueDate.split("-");
    if (dateParts.length !== 3) {
      return [];
    }
    const year = parseInt(dateParts[0]!, 10);
    const month = parseInt(dateParts[1]!, 10);
    const day = parseInt(dateParts[2]!, 10);

    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      return [];
    }

    const firstDue = new Date(year, month - 1, day);
    // Normalize to start of day to avoid timezone issues
    firstDue.setHours(0, 0, 0, 0);

    for (let i = 0; i < installmentCount; i++) {
      const dueDate = addDays(firstDue, i * frequencyDays);
      // Last installment gets the remainder to ensure exact total
      const amount =
        i === installmentCount - 1
          ? lastInstallmentAmount
          : baseInstallmentAmount;

      schedule.push({
        installmentNo: i + 1,
        dueDate: format(dueDate, "dd/MM/yyyy"),
        dueDateFormatted: format(dueDate, "dd/MM/yyyy"),
        amount: amount,
      });
    }

    return schedule;
  }, [
    paymentMethod,
    paymentFrequency,
    durationDays,
    initialPayment,
    installmentCount,
    firstDueDate,
    totals.totalAmount,
  ]);

  const handleClose = () => {
    // Prevent closing while submitting
    if (isSubmitting || localIsSubmitting) {
      return;
    }
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent
        size="2xl"
        className="flex max-h-[100vh] w-full flex-col md:max-h-[90vh] md:w-auto"
      >
        <ModalHeader className="flex-shrink-0">
          <ModalTitle className="text-2xl font-bold text-[#ff48b0]">
            {t("checkout.title")}
          </ModalTitle>
        </ModalHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-2 py-4">
          {/* Order Type Selection */}
          {selectedCustomer?.creditAllowed && (
            <div className="space-y-2">
              <Label className="text-lg font-semibold">
                {t("checkout.orderType")}
              </Label>
              <SearchableSelect
                showClearButton={false}
                options={orderTypeOptions}
                value={paymentMethod}
                onValueChange={(value: string) => {
                  const typedValue = value as "CASH" | "CREDIT";
                  setPaymentMethod(typedValue);
                  if (typedValue === "CASH") {
                    setPayments([
                      { paymentType: "CASH", amount: totals.totalAmount },
                    ]);
                  }
                }}
                placeholder={t("checkout.selectOrderType")}
                allowSearch={false}
              />
            </div>
          )}

          {/* Credit Limit Warning */}
          {paymentMethod === "CREDIT" && creditLimitError && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {creditLimitError}
              </p>
            </div>
          )}

          {/* Credit Configuration */}
          {paymentMethod === "CREDIT" && (
            <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("checkout.creditInformation")}
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Credit Type */}
                <div className="space-y-2">
                  <Label>{t("checkout.creditType")}</Label>
                  <SearchableSelect
                    showClearButton={false}
                    options={creditTypeOptions}
                    value={creditType}
                    onValueChange={(value: string) => {
                      setCreditType(
                        value as
                          | "SHORT_TERM"
                          | "EMPLOYEE_CREDIT"
                          | "PROMOTIONAL"
                      );
                    }}
                    allowSearch={false}
                  />
                </div>

                {/* Payment Frequency */}
                <div className="space-y-2">
                  <Label>{t("checkout.paymentFrequency")}</Label>
                  <SearchableSelect
                    showClearButton={false}
                    options={paymentFrequencyOptions}
                    value={paymentFrequency}
                    onValueChange={(value: string) => {
                      if (!value) return;
                      setPaymentFrequency(
                        value as "WEEKLY" | "BI_WEEKLY" | "MONTHLY"
                      );
                      // First due date will be recalculated by useEffect
                    }}
                    allowSearch={false}
                  />
                </div>

                {/* Duration */}
                <div className="space-y-2">
                  <Label>{t("checkout.duration")}</Label>
                  <SearchableSelect
                    showClearButton={false}
                    options={durationOptions}
                    value={durationDays.toString()}
                    onValueChange={value => setDurationDays(parseInt(value))}
                    allowSearch={false}
                  />
                </div>

                {/* First Due Date - Auto-calculated, read-only */}
                <div className="space-y-2">
                  <Label>{t("checkout.firstDueDate")}</Label>
                  <Input
                    type="date"
                    value={firstDueDate}
                    readOnly
                    disabled
                    className="cursor-not-allowed bg-gray-50 dark:bg-gray-800"
                  />
                </div>

                {/* Initial Payment */}
                <div className="space-y-2">
                  <Label>{t("checkout.initialPayment")}</Label>
                  <NumberInput
                    value={initialPayment}
                    onChange={value => setInitialPayment(value || 0)}
                    max={totals.totalAmount}
                    min={0}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("checkout.initialPaymentDescription")}
                  </p>
                </div>

                {/* Installment Count Display */}
                {installmentCount > 0 && (
                  <div className="space-y-2">
                    <Label>{t("checkout.installmentCount")}</Label>
                    <div className="flex h-10 items-center rounded-md border border-gray-200 bg-gray-50 px-3 dark:border-gray-700 dark:bg-gray-800">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {installmentCount} {t("checkout.installments")}
                      </span>
                    </div>
                    {initialPayment > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {t("checkout.principalAmount")}:{" "}
                        {formatCurrencyValue(
                          totals.totalAmount - initialPayment
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Payment Schedule */}
          {paymentMethod === "CREDIT" && installmentSchedule.length > 0 && (
            <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t("checkout.paymentSchedule")}
              </h3>
              <div className="space-y-2">
                {installmentSchedule.map(installment => (
                  <div
                    key={installment.installmentNo}
                    className="flex items-center justify-between rounded-md border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ff48b0]/10 text-sm font-semibold text-[#ff48b0]">
                        {installment.installmentNo}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {t("checkout.installment")}{" "}
                          {installment.installmentNo}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {installment.dueDateFormatted}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatCurrencyValue(installment.amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {installmentSchedule.length > 0 &&
                installmentSchedule[installmentSchedule.length - 1] && (
                  <div className="border-t border-gray-200 pt-2 dark:border-gray-700">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t("checkout.lastDueDate")}:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {
                          installmentSchedule[installmentSchedule.length - 1]
                            ?.dueDateFormatted
                        }
                      </span>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Order Summary */}
          <div className="space-y-2 rounded-lg bg-gradient-to-r from-pink-50 to-purple-50 p-4 dark:from-pink-900/20 dark:to-purple-900/20">
            <div className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
              <span className="text-muted-foreground">
                {t("checkout.subtotal")}
              </span>
              <span>
                {CURRENCY_SIGN}
                {totals.subtotal.toFixed(2)}
              </span>
            </div>

            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>{t("checkout.discount")}</span>
                <span>
                  -{CURRENCY_SIGN}
                  {totals.discountAmount.toFixed(2)}
                </span>
              </div>
            )}

            {totals.taxes > 0 && (
              <div className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                <span className="text-muted-foreground">
                  {t("checkout.tax")}
                </span>
                <span>
                  {CURRENCY_SIGN}
                  {totals.taxes.toFixed(2)}
                </span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-xl font-bold text-gray-900 dark:text-gray-100">
              <span>{t("checkout.total")}</span>
              <span className="text-[#ff48b0]">
                {CURRENCY_SIGN}
                {totals.totalAmount.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payments - Only show for CASH orders */}
          {paymentMethod === "CASH" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-lg font-semibold">
                  {t("checkout.paymentMethods")}
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddPayment}
                  className="gap-2"
                >
                  <BiPlus className="h-4 w-4" />
                  {t("checkout.addPayment")}
                </Button>
              </div>

              {payments.map((payment, index) => {
                const Icon = getPaymentIcon(payment.paymentType);

                return (
                  <div
                    key={index}
                    className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-[#ff48b0]" />
                        <span className="font-medium text-gray-900 dark:text-white">
                          {t("checkout.payment", { number: index + 1 })}
                        </span>
                      </div>
                      {payments.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemovePayment(index)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <BiTrash className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{t("checkout.paymentType")}</Label>
                        <SearchableSelect
                          showClearButton={false}
                          options={paymentTypeOptions}
                          value={payment.paymentType}
                          onValueChange={value =>
                            handleUpdatePayment(index, "paymentType", value)
                          }
                          placeholder={t("checkout.selectPaymentType")}
                          allowSearch={false}
                          renderOption={option => {
                            const Icon = option.data?.icon || BiMoney;
                            return (
                              <div className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
                                <Icon className="h-4 w-4" />
                                <span>{option.label}</span>
                              </div>
                            );
                          }}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{t("checkout.amount")}</Label>
                        <NumberInput
                          value={payment.amount}
                          onChange={value =>
                            handleUpdatePayment(index, "amount", value || 0)
                          }
                        />
                      </div>
                    </div>

                    {payment.paymentType === "CARD" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>{t("checkout.provider")}</Label>
                          <Input
                            placeholder={t("checkout.providerPlaceholder")}
                            value={payment.provider || ""}
                            onChange={e =>
                              handleUpdatePayment(
                                index,
                                "provider",
                                e.target.value
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{t("checkout.reference")}</Label>
                          <Input
                            placeholder={t("checkout.referencePlaceholder")}
                            value={payment.transactionReference || ""}
                            onChange={e =>
                              handleUpdatePayment(
                                index,
                                "transactionReference",
                                e.target.value
                              )
                            }
                          />
                        </div>
                      </div>
                    )}

                    {payment.paymentType === "TRANSFER" && (
                      <div className="space-y-2">
                        <Label>{t("checkout.reference")}</Label>
                        <Input
                          placeholder={t(
                            "checkout.transferReferencePlaceholder"
                          )}
                          value={payment.transactionReference || ""}
                          onChange={e =>
                            handleUpdatePayment(
                              index,
                              "transactionReference",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Payment Summary - Only show for CASH orders */}
          {paymentMethod === "CASH" && (
            <div className="space-y-2 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
              <div className="flex justify-between text-sm text-gray-900 dark:text-gray-100">
                <span>{t("checkout.totalPaid")}</span>
                <span className="font-medium">
                  {CURRENCY_SIGN}
                  {totalPaid.toFixed(2)}
                </span>
              </div>

              {remaining > 0.01 ? (
                <div className="flex justify-between text-sm text-red-600 dark:text-red-400">
                  <span>{t("checkout.remaining")}</span>
                  <span className="font-medium">
                    {CURRENCY_SIGN}
                    {remaining.toFixed(2)}
                  </span>
                </div>
              ) : change > 0 ? (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>{t("checkout.change")}</span>
                  <span className="font-medium">
                    {CURRENCY_SIGN}
                    {change.toFixed(2)}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                  <span>{t("checkout.status")}</span>
                  <Badge
                    variant="secondary"
                    className="bg-green-500 text-white"
                  >
                    {t("checkout.exactAmount")}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Credit Payment Summary */}
          {paymentMethod === "CREDIT" && (
            <div className="space-y-2 rounded-lg bg-gray-50 p-4 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
              <div className="flex justify-between text-sm">
                <span>{t("checkout.orderTotal")}</span>
                <span className="font-medium">
                  {CURRENCY_SIGN}
                  {totals.totalAmount.toFixed(2)}
                </span>
              </div>
              {initialPayment > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span>{t("checkout.initialPayment")}</span>
                    <span className="font-medium">
                      -{CURRENCY_SIGN}
                      {initialPayment.toFixed(2)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-sm font-semibold">
                    <span>{t("checkout.principalAmount")}</span>
                    <span className="font-medium">
                      {CURRENCY_SIGN}
                      {(totals.totalAmount - initialPayment).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm">
                <span>{t("checkout.installmentCount")}</span>
                <span className="font-medium">{installmentCount}</span>
              </div>
              {installmentCount > 0 && initialPayment < totals.totalAmount && (
                <div className="flex justify-between text-sm">
                  <span>{t("checkout.installmentAmount")}</span>
                  <span className="font-medium">
                    {CURRENCY_SIGN}
                    {(
                      (totals.totalAmount - initialPayment) /
                      installmentCount
                    ).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <ModalFooter className="w-full flex-shrink-0 gap-2 pb-6">
          <Button
            className="h-12 w-full bg-gradient-to-r from-[#ff48b0] to-[#f5b1cc] text-lg font-semibold hover:opacity-90"
            onClick={handleConfirm}
            disabled={
              isSubmitting ||
              localIsSubmitting ||
              (paymentMethod === "CASH" ? remaining > 0.01 : false)
            }
          >
            {isSubmitting || localIsSubmitting
              ? t("checkout.processing") || "Processing..."
              : t("checkout.confirmSale")}
          </Button>
          <div className="w-full space-y-2">
            <Button
              className="h-12 w-full border-red-500 text-lg font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting || localIsSubmitting}
            >
              {t("checkout.cancel")}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

export type CreditType = "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL";

export type PaymentFrequency = "WEEKLY" | "BI_WEEKLY" | "MONTHLY";

export type CreditStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "ACTIVE"
  | "PAID"
  | "OVERDUE"
  | "ANNULLED";

export type CreditInstallmentStatus =
  | "PENDING"
  | "PARTIAL"
  | "PAID"
  | "OVERDUE"
  | "ANNULLED";

export interface Credit {
  id: string;
  orderId: string;
  customerId: string;
  principalAmount: number;
  outstandingAmount: number;
  creditType: CreditType;
  installmentCount: number;
  paymentFrequency: PaymentFrequency;
  durationDays?: number;
  firstDueDate: string;
  status: CreditStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreditInstallment {
  id: string;
  creditId: string;
  installmentNo: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  status: CreditInstallmentStatus;
}

export interface CreateCreditRequest {
  orderId: string;
  customerId: string;
  principalAmount: number;
  creditType: CreditType;
  installmentCount: number;
  paymentFrequency: PaymentFrequency;
  durationDays?: number;
  firstDueDate: string;
  initialPayment?: number;
}

export interface CreditNote {
  id: string;
  orderId?: string | null;
  paymentId?: string | null;
  customerId: string;
  creditInstallmentId?: string | null;
  amount: number;
  description?: string | null;
  createdAt: string;
  createdBy?: string | null;
  // Relations (optional, populated when included)
  order?: {
    orderNumber: string | null;
    status: string | null;
  };
  creditInstallment?: {
    id: string;
    installmentNo: number;
  };
}

export interface CreateCreditNoteRequest {
  orderId?: string;
  paymentId?: string;
  customerId: string;
  creditInstallmentId?: string;
  amount: number;
  description?: string;
  createdBy?: string;
}

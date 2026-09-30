export interface CashSessionPdfData {
  companyName: string;
  /** IANA time zone from the client for all date/time fields in the PDF. */
  timeZone?: string;
  branchName?: string;
  cashRegisterName: string;
  cashRegisterCode?: string;
  employeeName: string;
  closedByName?: string;
  sessionId: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  closingBalance?: number;
  systemTotal?: number;
  difference?: number;
  notes?: string;
  orders: Array<{
    orderNumber?: string;
    date: string;
    totalAmount: number;
    paymentMethod?: "CASH" | "CREDIT";
  }>;
  creditInstallmentPayments?: Array<{
    orderNumber?: string;
    installmentNo?: number;
    date: string;
    amount: number;
  }>;
  movements: Array<{
    type: "IN" | "OUT";
    date: string;
    reason?: string;
    amount: number;
  }>;
}

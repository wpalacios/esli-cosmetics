export interface ReceiptPdfDataItem {
  id?: number;
  name: string;
  parentName?: string;
  parentSku?: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  totalPrice: number;
  isKit?: boolean;
  kitItems?: {
    name: string;
    sku?: string;
    quantity: number;
    totalQuantity: number;
  }[];
  metadata?: any;
}

export type ReceiptType = "CREDIT" | "CASH";

export interface ReceiptPdfPayment {
  paymentType: string;
  amount: number;
  provider?: string;
  transactionReference?: string;
  paidAt?: Date | string;
}

export interface ReceiptPdfData {
  /** IANA time zone from the client for date/time on the PDF. */
  timeZone?: string;
  companyName: string;
  companyTaxId?: string;
  companyAddress?: string;
  companyCity?: string;
  branchName?: string;
  branchTaxId?: string;
  branchAddress?: string;
  branchCity?: string;
  customer?: string;
  customerTaxId?: string;
  customerAddress?: string;
  customerCity?: string;
  orderNumber: string;
  date: string;
  cashier: string;
  seller: string;
  locationName?: string;
  items: ReceiptPdfDataItem[];
  receiptType?: ReceiptType;
  subtotal: number;
  itemsDiscountTotal?: number;
  discountCodeValue?: number;
  manualDiscount?: number;
  totalDiscount?: number;
  taxes?: number;
  irpf?: number;
  iva?: number;
  totalAmount: number;
  payments?: ReceiptPdfPayment[];
  paymentMessage?: string;
  email?: string;
  reference?: string;
  thankYouMessage?: string;
  contactMessage?: string;
  initialPayment?: number;
  metadata?: any;
}

export interface QuotePdfDataItem {
  id?: string;
  name: string;
  parentName?: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  taxAmount?: number;
  lineTotal: number;
  metadata?: any;
}

export type QuotePdfType = "DRAFT" | "APPROVED" | "EXPIRED" | "CONVERTED";

export interface QuotePdfPayment {
  paymentType: string;
  amount: number;
  provider?: string;
  transactionReference?: string;
  paidAt?: Date | string;
}

export interface QuotePdfData {
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
  quoteNumber?: string;
  orderId?: string;
  date: string;
  cashier: string;
  seller: string;
  locationName?: string;
  items: QuotePdfDataItem[];
  quoteType: QuotePdfType;
  subtotal?: number;
  itemsDiscountTotal?: number;
  discountCodeValue?: number;
  manualDiscount?: number;
  totalDiscount?: number;
  taxes?: number;
  irpf?: number;
  iva?: number;
  totalAmount?: number;
  payments?: QuotePdfPayment[];
  paymentMessage?: string;
  email?: string;
  reference?: string;
  thankYouMessage?: string;
  contactMessage?: string;
  initialPayment?: number;
  validUntil?: string | Date;
  status: QuotePdfType;
  metadata?: any;
}

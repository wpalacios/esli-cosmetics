export interface SalesReportPdfRow {
  customer: string;
  orderNumber: string;
  branch: string;
  sellerName: string;
  orderDiscount: number;
  status: string;
  orderSubtotal: number;
  orderTaxes: number;
  orderTotal: number;
}

export interface SalesReportPdfTotals {
  orderDiscount: number;
  orderSubtotal: number;
  orderTaxes: number;
  orderTotal: number;
}

export interface SalesReportPdfData {
  companyName?: string;
  /** ISO date string - when the report was generated (fallback if generatedAtFormatted not set) */
  generatedAt?: string;
  /** Pre-formatted date string from user's browser (e.g. "14/03/2025, 10:30:00 a.m.") for PDF footer */
  generatedAtFormatted?: string;
  /**
   * IANA time zone from the client; used to format `generatedAt` on the server when
   * `generatedAtFormatted` is not provided.
   */
  timeZone?: string;
  /** Date range filter - from (YYYY-MM-DD) for display */
  dateRangeFrom?: string;
  /** Date range filter - to (YYYY-MM-DD) for display */
  dateRangeTo?: string;
  items: SalesReportPdfRow[];
  totals: SalesReportPdfTotals;
}

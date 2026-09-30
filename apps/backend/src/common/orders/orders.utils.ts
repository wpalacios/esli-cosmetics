import type { DataSheetRequest } from "../../modules/reports/types/excel-reports.types";
import { ReceiptPdfData } from "../../modules/reports/types/receipt-types";

export interface Order {
  orderNumber?: string;
  id?: string;
  customerName?: string;
  customer?: unknown;
  branchName?: string;
  branch?: unknown;
  employeeName?: string;
  employee?: unknown;
  seller?: unknown;
  discountCode?: string;
  status?: string;
  subtotal?: number | string | { toNumber: () => number };
  subtotalAmount?: number | string | { toNumber: () => number };
  orderSubtotal?: number | string | { toNumber: () => number };
  taxes?: number | string | { toNumber: () => number };
  orderTaxes?: number | string | { toNumber: () => number };
  totalAmount?: number | string | { toNumber: () => number };
  orderTotal?: number | string | { toNumber: () => number };
  [key: string]: unknown;
}

// Heuristic to determine if a given sheet contains order-like data
export function isOrderLikeSheet(sheet: DataSheetRequest): boolean {
  const rows = Array.from(sheet.rows ?? []);
  if (!rows.length) return false;
  const first = rows[0] ?? {};
  return (
    !!first.orderNumber ||
    !!first["order_number"] ||
    !!first.id ||
    Object.keys(first).some(k =>
      /order.*number|orderNumber|order_number/i.test(k)
    )
  );
}

export function calculateReceiptItemTotal(
  item: ReceiptPdfData["items"][number]
): number {
  if (typeof item.totalPrice === "number") {
    return item.totalPrice;
  }
  return item.unitPrice * item.quantity - (item.discountAmount ?? 0);
}

export function getReceiptProductLine(item: {
  parentName?: string;
  variantName?: string;
  name: string;
  sku?: string;
}): string {
  const parts: string[] = [];
  if (item.parentName) parts.push(item.parentName);
  if (item.variantName) parts.push(item.variantName);
  else if (item.name) parts.push(item.name);
  if (item.sku) parts.push(item.sku);
  return parts.join(" - ");
}

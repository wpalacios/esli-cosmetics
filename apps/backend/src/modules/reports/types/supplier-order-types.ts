export interface SupplierOrderPdfItem {
  productName: string;
  variantName?: string;
  sku?: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export interface SupplierOrderPdfData {
  companyName: string;
  companyAddress?: string;
  companyEmail?: string;
  orderNumber: string;
  date: string;
  expectedDate?: string;
  status: string;
  supplierName: string;
  supplierContact?: string;
  supplierPhone?: string;
  supplierEmail?: string;
  supplierAddress?: string;
  items: SupplierOrderPdfItem[];
  totalAmount: number;
}

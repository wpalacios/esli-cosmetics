export interface TransferPdfDataItem {
  id?: string;
  name: string;
  parentName?: string;
  variantName?: string;
  sku?: string;
  quantityRequested: number;
  quantitySent?: number;
  quantityReceived?: number;
}

export interface TransferPdfData {
  companyName: string;
  companyAddress?: string;
  companyEmail?: string;
  trackingNumber: string;
  createdAt: string;
  createdBy: string;
  fromLocation: string;
  toLocation: string;
  sender?: string;
  receiver?: string;
  items: TransferPdfDataItem[];
}

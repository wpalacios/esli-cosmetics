import type { Alignment, Font, Fill, Borders } from "exceljs";

export type CellNumFormat = string;
export type ReportCellValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined;

export interface ReportColumnSpec {
  key: string;
  header: string;
  width?: number;
  numFmt?: CellNumFormat;
  alignment?: Partial<Alignment>;
}

export interface ReportHeaderStyle {
  font?: Partial<Font>;
  fill?: Fill;
  alignment?: Partial<Alignment>;
  borders?: Partial<Borders>;
}

export type ReportRowObject = Record<string, ReportCellValue>;
export type ReportRowArray = ReportCellValue[];

export interface ReportSheetSpec {
  name: string;
  columns: ReadonlyArray<ReportColumnSpec>;
  rows: ReadonlyArray<ReportRowObject | ReportRowArray>;
  freezeHeader?: boolean;
  autoFilter?: boolean;
  headerStyle?: ReportHeaderStyle;
  defaultColumnWidth?: number;
}

export interface ReportWorkbookSpec {
  fileName: string;
  sheets: ReadonlyArray<ReportSheetSpec>;
  creator?: string;
  createdAt?: Date;
}

// Data-first requests for modules providing plain rows
export interface DataSheetRequest {
  name: string;
  rows: ReadonlyArray<ReportRowObject>;
  fields?: ReadonlyArray<string>;
  headerMap?: Readonly<Record<string, string>>;
  freezeHeader?: boolean;
  autoFilter?: boolean;
  defaultColumnWidth?: number;
  columnHints?: Readonly<Record<string, Partial<ReportColumnSpec>>>;
  pdfStyle?: string;
}

export interface DataWorkbookRequest {
  fileName: string;
  sheets: ReadonlyArray<DataSheetRequest>;
  creator?: string;
  createdAt?: Date;
  /**
   * IANA time zone from the client (e.g. America/Managua) so PDF date cells use
   * the user locale instead of the server process timezone.
   */
  pdfTimeZone?: string;
}

export interface ExportSalesByProductFilters {
  from?: string;
  to?: string;

  branchId?: string;
  productId?: string;
  productVariantId?: string;
  employeeId?: string;

  productName?: string;
  productVariantName?: string;
  productVariantSku?: string;

  brandId?: string;
  orderNumber?: string;

  /**
   * Maximum number of detail rows to materialize. Used by the preview endpoint
   * so it does not load the entire order-item history into memory just to show
   * a truncated sample. When set, the totals row is omitted (partial data).
   */
  maxRows?: number;
}

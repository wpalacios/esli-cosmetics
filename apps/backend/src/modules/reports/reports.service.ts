import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Workbook } from "exceljs";
import {
  ReportWorkbookSpec,
  ReportSheetSpec,
  ReportRowObject,
  ReportCellValue,
  DataWorkbookRequest,
  DataSheetRequest,
} from "./types/excel-reports.types";
import type { TDocumentDefinitions } from "pdfmake/interfaces";
import PdfPrinter from "pdfmake";
import * as fs from "fs";
import { pdfFonts } from "../../common/reports/pdf/pdf.columns.js";
import { PDF_LOGO_PATH } from "../../common/reports/pdf/pdf.utils";
import { formatMoney } from "../../common/money-format/money.utils.js";
import { getReceiptPdfDocDefinition } from "src/common/reports/pdf/receipt-pdf.utils";
import { getTransferPdfDocDefinition } from "src/common/reports/pdf/transfer-pdf.utils";
import type { ReceiptPdfData } from "./types/receipt-types";
import type { TransferPdfData } from "src/modules/stock-transfers/types/transfer-pdf-types";
import { getCashSessionPdfDocDefinition } from "src/common/reports/pdf/cash-session-pdf.utils";
import type { CashSessionPdfData } from "./types/cash-session-types";
import { SupplierOrderPdfData } from "./types/supplier-order-types";
import { SupplierOrderPdfService } from "src/common/reports/pdf/supplier-order-pdf.utils";
import { getQuotePdfDocDefinition } from "src/common/reports/pdf/quotes-pdf.utils";
import type { QuotePdfData } from "./types/quote-types";
import { StockMovementReportData } from "./types/stock-movements-types";
import { getStockMovementsPdfDocDefinition } from "src/common/reports/pdf/stock-movements-pdf.utils";
import type { SalesReportPdfData } from "./types/sales-report-pdf-types";
import { PrismaService } from "src/common/prisma/prisma.service";
import {
  getSalesReportPdfDocDefinition,
  getCustomersReportPdfDocDefinition,
} from "src/common/reports/pdf/sales-report-pdf.utils";
import { ProductsService } from "../products/products.service";
import { ProductsDto } from "../products/dto/products.dto";
import {
  getProductCatalogPdfDocDefinition,
  type ProductCatalogPdfItem,
} from "../../common/reports/pdf/product-catalog-pdf.utils";
import { formatDateLocal } from "src/common/date-range/date-range.util";

let _printer: PdfPrinter | null = null;

export function getPdfPrinter(): PdfPrinter {
  if (!_printer) {
    _printer = new PdfPrinter(pdfFonts);
  }
  return _printer;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supplierOrderPdfService: SupplierOrderPdfService,
    private readonly productsService: ProductsService
  ) {}

  private pdfPrinter: PdfPrinter = getPdfPrinter();

  private toNodeBuffer(out: unknown): Buffer {
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(out)) return out;
    if (out instanceof Uint8Array) return Buffer.from(out);
    if (out instanceof ArrayBuffer) return Buffer.from(new Uint8Array(out));
    throw new Error("Unsupported buffer type returned by ExcelJS");
  }

  private getLogoBase64(): string | null {
    try {
      if (fs.existsSync(PDF_LOGO_PATH)) {
        const bitmap = fs.readFileSync(PDF_LOGO_PATH);
        return `data:image/png;base64,${bitmap.toString("base64")}`;
      }
      return null;
    } catch (e) {
      return e;
    }
  }

  // Build a ReportWorkbookSpec from plain data (rows), inferring columns/widths/styles
  async generateReportFromData(
    req: DataWorkbookRequest
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const spec: ReportWorkbookSpec = {
      fileName: req.fileName,
      creator: req.creator,
      createdAt: req.createdAt,
      sheets: req.sheets.map(s => this.toSheetSpec(s)),
    };

    const spanishMap: Record<string, string> = {
      fullName: "Cliente",
      email: "Email",
      phone: "Teléfono",
      doc: "Documento",
      priceTypes: "Tipos de precio",
      createdAt: "Creado",
      date: "Fecha",
      orderNumber: "# Orden",
      customer: "Cliente",
      branch: "Ubicación",
      productName: "Producto",
      variantName: "Variante",
      variantSku: "SKU",
      quantity: "Cantidad",
      unitPrice: "Precio unitario",
      orderDiscount: "Descuento Total",
      orderSubtotal: "Subtotal",
      orderTaxes: "Impuestos",
      orderTotal: "Total",
      paymentType: "Tipo de pago",
      product: "Producto",
      totalSales: "Ventas brutas",
      totalDiscount: "Descuentos",
      totalTaxes: "Impuestos",
      netSales: "Venta neta",
    };

    for (const sheet of spec.sheets) {
      if (!Array.isArray(sheet.columns)) continue;
      for (const col of sheet.columns) {
        const key = col.key;
        if (key && spanishMap[key]) {
          col.header = spanishMap[key];
        }
      }
    }
    return this.generateExcelReport(spec);
  }

  // Preview-only: returns inferred columns (with widths) and a subset of rows
  previewFromData(
    req: DataWorkbookRequest,
    options?: { maxRows?: number }
  ): {
    fileName: string;
    sheets: Array<{
      name: string;
      columns: Array<{ key: string; header: string; width?: number }>;
      rows: ReportRowObject[];
    }>;
  } {
    const maxRows = options?.maxRows ?? 100;

    const currencyLocale = "es-NI";
    const currencyCode = "NIO";
    const moneyKey =
      /totalSales|totalDiscount|totalTaxes|netSales|total|price|amount|tax|discount|unitPrice|lineTotal|itemDiscount|itemTax/i;

    const currencyFormatter = new Intl.NumberFormat(currencyLocale, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const sheets = req.sheets.map(s => {
      const spec = this.toSheetSpec(s);
      const started = Date.now();

      // columns metadata
      const columns = spec.columns.map(c => ({
        key: c.key,
        header: c.header,
        width: c.width,
      }));

      // detect money keys from columns
      const moneyKeys = columns
        .map(c => c.key)
        .filter(k => moneyKey.test(String(k)));

      const rawRows = (spec.rows as ReportRowObject[]).slice(0, maxRows);

      const rows = rawRows.map(r => {
        const copy: ReportRowObject = { ...r };
        for (const mk of moneyKeys) {
          const val = copy[mk];
          if (val === null || val === undefined || val === "") {
            // leave as-is (null/undefined/empty)
          } else if (typeof val === "number") {
            copy[mk] = currencyFormatter.format(val);
          } else {
            // try convert numeric string to number (e.g. "123.45")
            const n = Number(
              String(val)
                .replace(/[^0-9\.\-\,]/g, "")
                .replace(",", ".")
            );
            if (!Number.isNaN(n)) {
              copy[mk] = currencyFormatter.format(n);
            } else {
              // keep original non-numeric string
              copy[mk] = String(val);
            }
          }
        }
        return copy;
      });

      return { name: spec.name, columns, rows };
    });

    return { fileName: req.fileName, sheets };
  }

  // Excel generation to export
  async generateExcelReport(
    spec: ReportWorkbookSpec
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const workbook = new Workbook();
    workbook.creator = spec.creator ?? "Esli Cosmetics";
    workbook.created = spec.createdAt ?? new Date();

    for (const sheetSpec of spec.sheets) this.buildSheet(workbook, sheetSpec);

    const out = await workbook.xlsx.writeBuffer();
    return { fileName: spec.fileName, buffer: this.toNodeBuffer(out) };
  }

  private toSheetSpec(s: DataSheetRequest): ReportSheetSpec {
    const rows = Array.from(s.rows ?? []);
    const first = rows[0] ?? {};
    const fields =
      s.fields && s.fields.length > 0
        ? Array.from(s.fields)
        : Object.keys(first);

    const defaultWidth = s.defaultColumnWidth ?? 18;

    const columns = fields.map(key => {
      const header = s.headerMap?.[key] ?? this.humanize(key);
      const valuesForKey = rows.map(r => r?.[key]);
      const width = this.guessWidth(valuesForKey, header, defaultWidth);

      const hint = s.columnHints?.[key] ?? {};

      const numFmtAuto = (() => {
        if (valuesForKey.some(v => v instanceof Date))
          return "dd/mm/yyyy hh:mm:ss AM/PM";
        const looksMoney =
          /total|price|amount|tax|discount|subtotal/i.test(key) ||
          /total|price|amount|tax|discount|subtotal/i.test(header);
        if (looksMoney && valuesForKey.some(v => typeof v === "number")) {
          return '"$"#,##0.00';
        }
        return undefined;
      })();

      return {
        key,
        header,
        width: hint.width ?? width,
        numFmt: hint.numFmt ?? numFmtAuto,
        alignment: hint.alignment,
      };
    });

    return {
      name: s.name,
      columns,
      rows,
      freezeHeader: s.freezeHeader ?? true,
      autoFilter: s.autoFilter ?? true,
      defaultColumnWidth: defaultWidth,
      headerStyle: {
        font: { bold: true, color: { argb: "FF1F2937" } },
        fill: {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE5E7EB" },
        },
      },
    };
  }

  private humanize(key: string): string {
    return key
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^./, c => c.toUpperCase());
  }

  private guessWidth(
    values: ReportCellValue[],
    header: string,
    fallback: number
  ): number {
    const toLen = (v: ReportCellValue) => {
      if (v === null || v === undefined) return 0;
      if (v instanceof Date) return 21;
      return String(v).length;
    };
    const maxLen = Math.max(header.length, ...values.map(toLen));
    const padded = maxLen + 2;
    return Math.min(120, Math.max(padded, fallback));
  }
  private buildSheet(workbook: Workbook, sheetSpec: ReportSheetSpec) {
    const ws = workbook.addWorksheet(sheetSpec.name);

    const rawName = sheetSpec.name;
    const name =
      rawName !== null && rawName !== undefined
        ? String(rawName).toLowerCase()
        : "";
    if (/ventas.*producto/i.test(name)) {
      ws.pageSetup = { orientation: "landscape" };
    }

    ws.columns = sheetSpec.columns.map(c => ({
      header: c.header,
      key: c.key,
      width: c.width ?? sheetSpec.defaultColumnWidth ?? 20,
      style: {
        alignment: (c as any).alignment ?? {
          vertical: "middle",
          wrapText: true,
        },
        numFmt: (c as any).numFmt,
      },
    }));

    const freeze = sheetSpec.freezeHeader !== false;
    const useAutoFilter = sheetSpec.autoFilter !== false;
    if (freeze) ws.views = [{ state: "frozen", ySplit: 1 }];

    for (const item of sheetSpec.rows) {
      if (Array.isArray(item)) ws.addRow(item);
      else {
        const rowValues = (
          sheetSpec.columns as ReadonlyArray<{ key: string }>
        ).map(c => (item as ReportRowObject)[c.key]);
        ws.addRow(rowValues);
      }
    }

    const headerRow = ws.getRow(1);
    headerRow.eachCell(cell => {
      cell.font = sheetSpec.headerStyle?.font ?? { bold: true };
      cell.alignment = sheetSpec.headerStyle?.alignment ?? {
        vertical: "middle",
      };
      if (sheetSpec.headerStyle?.fill) cell.fill = sheetSpec.headerStyle.fill;
      if (sheetSpec.headerStyle?.borders)
        cell.border = sheetSpec.headerStyle.borders;
    });

    if (useAutoFilter) {
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: sheetSpec.columns.length },
      };
    }
  }

  // PDF generation to export
  async generatePdfFromData(
    req: DataWorkbookRequest
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const def = this.toPdfDocDefinition(req);

    const pdfDoc = this.pdfPrinter.createPdfKitDocument(def);
    const chunks: Buffer[] = [];
    const started = Date.now();
    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const fileName = req.fileName.replace(/\.xlsx$/i, ".pdf");
        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", reject);
      pdfDoc.end();
    });
  }

  private toPdfDocDefinition(req: DataWorkbookRequest): TDocumentDefinitions {
    const content: any[] = [];
    const pdfTimeZone = req.pdfTimeZone;

    for (const sheet of req.sheets) {
      content.push({ text: sheet.name, style: "h2", margin: [0, 10, 0, 6] });
      const { headers, body, widths } = this.sheetToPdfTable(
        sheet,
        pdfTimeZone
      );
      content.push({
        table: {
          headerRows: 1,
          widths,
          body: [
            headers.map(h => ({ text: h, style: "tableHeader" })),
            ...body,
          ],
        },
        layout: "lightHorizontalLines",
        fontSize: 9,
      });
      content.push({ text: "", pageBreak: "after" });
    }
    if (content.length && content[content.length - 1]?.pageBreak) content.pop();

    const maxCols = req.sheets.reduce((max, s) => {
      const { headers } = this.sheetToPdfTable(s, pdfTimeZone);
      return Math.max(max, headers.length);
    }, 0);

    // original heuristic
    let pageOrientation: "landscape" | "portrait" =
      maxCols > 6 ? "landscape" : "portrait";

    const hasSalesByProduct = req.sheets.some(s =>
      /ventas.*producto/i.test(String(s.name ?? ""))
    );
    const hasSalesReport = req.sheets.some(
      x => x.name?.toLowerCase() === "reporte de ventas"
    );

    if (hasSalesByProduct || hasSalesReport) {
      pageOrientation = "landscape";
    }

    return {
      pageOrientation,
      defaultStyle: { font: "GothamRoundedBook" },
      styles: {
        h2: { fontSize: 16, bold: true, font: "GothamRoundedBold" },
      },
      content,
    };
  }

  private sheetToPdfTable(
    sheet: DataSheetRequest,
    pdfTimeZone?: string
  ): {
    headers: any[];
    body: any[][];
    widths: Array<number | "*" | "auto">;
  } {
    const rows = Array.from(sheet.rows ?? []);

    // money detection (keys) and helper to format using shared util
    const moneyKey =
      /total|price|amount|tax|discount|subtotal|unitPrice|lineTotal/i;

    const parsePossibleNumber = (raw: any): number | null => {
      if (raw == null || raw === "") return null;
      if (typeof raw === "number") return raw;
      const cleaned = String(raw)
        .replace(/[^0-9\.\-\,]/g, "")
        .replace(",", ".");
      const v = Number(cleaned);
      return Number.isFinite(v) ? v : null;
    };

    const formatCell = (key: string | undefined, raw: any) => {
      const isLikelyDateInstant = (r: unknown): r is string | Date => {
        if (r instanceof Date) return !Number.isNaN(r.getTime());
        if (typeof r === "string" && r.trim() !== "") {
          return /^\d{4}-\d{2}-\d{2}T/.test(r.trim());
        }
        return false;
      };
      if (isLikelyDateInstant(raw)) {
        return formatDateLocal(raw, pdfTimeZone);
      }
      if (raw === null || raw === undefined) return "";
      if (key && moneyKey.test(String(key))) {
        try {
          return formatMoney(raw);
        } catch {
          const n = parsePossibleNumber(raw);
          return n === null ? String(raw) : `$${n.toFixed(2)}`;
        }
      }
      return String(raw);
    };

    const pdfStyle: string =
      (sheet as any).pdfStyle ??
      (typeof sheet.name === "string" &&
      /ventas.*producto/i.test(String(sheet.name))
        ? "sales-by-product"
        : typeof sheet.name === "string" &&
            sheet.name?.toLowerCase() === "reporte de ventas"
          ? "sales-by-customer"
          : "default");

    if (pdfStyle === "sales-by-customer") {
      const fields = [
        "customer",
        "orderNumber",
        "branch",
        "sellerName",
        "orderDiscount",
        "status",
        "orderSubtotal",
        "orderTaxes",
        "orderTotal",
      ];

      const headers = [
        "Cliente",
        "# Orden",
        "Ubicación",
        "Empleado",
        "Descuento Total",
        "Estado",
        "Subtotal",
        "Impuestos",
        "Total",
      ];

      // Filter out any existing total rows (rows where any field value is "Total")
      // Check ALL fields in the row object, not just the PDF fields
      // (the service may use different field names like "date" for the total label)
      const dataRows = rows.filter(row => {
        // Check all keys in the row object
        for (const key in row) {
          const value = (row as any)?.[key];
          if (value != null && String(value).trim().toLowerCase() === "total") {
            return false; // This is a total row, exclude it
          }
        }
        return true; // Not a total row, include it
      });

      const body = dataRows.map(row =>
        fields.map(key => formatCell(key, (row as any)?.[key]))
      );

      // Add total row - sum all numeric columns (orderDiscount, orderSubtotal, orderTaxes, orderTotal)
      const numericFieldIndices = fields
        .map((f, idx) => ({ field: f, idx }))
        .filter(({ field }) =>
          /orderDiscount|orderSubtotal|orderTaxes|orderTotal/i.test(field)
        );

      if (numericFieldIndices.length > 0) {
        const sums: Record<number, number> = {};
        for (const { idx } of numericFieldIndices) {
          sums[idx] = 0;
        }

        for (const r of dataRows) {
          for (const { field, idx } of numericFieldIndices) {
            const raw = (r as any)?.[field];
            const n = parsePossibleNumber(raw);
            if (n !== null) sums[idx] += n;
          }
        }

        // Check if any sum is non-zero
        const hasNonZeroSum = Object.values(sums).some(
          s => !Number.isNaN(s) && s !== 0
        );

        if (hasNonZeroSum) {
          const labelIdx = 0; // Use first column for "Total" label
          const footer = fields.map((_, i) => {
            if (i === labelIdx) return "Total";
            if (sums[i] !== undefined) return formatMoney(sums[i]);
            return "";
          });
          body.push(footer);
        }
      }

      // Use optimized widths for better PDF layout
      // Some columns get fixed/auto widths, important ones get flexible width
      const widths: Array<number | "*" | "auto"> = [
        "*", // Cliente (flexible, can be long)
        70, // # Orden (fixed, standard length)
        "auto", // Sucursal (auto-fit)
        "auto", // Empleado (auto-fit)
        "auto", // Descuento Total (auto-fit for currency)
        50, // Estado (fixed, short values like "Completado")
        "auto", // Subtotal (auto-fit for currency)
        "auto", // Impuestos (auto-fit for currency)
        "auto", // Total (auto-fit for currency)
      ];

      return { headers, body, widths };
    }

    if (pdfStyle === "sales-by-product") {
      const fields = ["date", "orderNumber", "product", "quantity", "total"];
      const headers = fields.map(k => sheet.headerMap?.[k] ?? this.humanize(k));

      // Filter out any existing total rows (rows where any field value is "Total")
      // Check ALL fields in the row object, not just the PDF fields
      const dataRows = rows.filter(row => {
        // Check all keys in the row object
        for (const key in row) {
          const value = (row as any)?.[key];
          if (value != null && String(value).trim().toLowerCase() === "total") {
            return false; // This is a total row, exclude it
          }
        }
        return true; // Not a total row, include it
      });

      const body = dataRows.map(row =>
        fields.map(k => {
          return formatCell(k, (row as any)?.[k]);
        })
      );

      const widths: Array<number | "*" | "auto"> = fields.map(f =>
        f === "product" ? "*" : "auto"
      );

      // Always include totals for sales-by-product reports
      const numericFieldIndices = fields
        .map((f, idx) => ({ field: f, idx }))
        .filter(({ field }) => /quantity|total/i.test(field));

      if (numericFieldIndices.length > 0) {
        const sums: Record<number, number> = {};
        for (const { idx } of numericFieldIndices) {
          sums[idx] = 0;
        }

        for (const r of dataRows) {
          for (const { field, idx } of numericFieldIndices) {
            const raw = (r as any)?.[field];
            const n = parsePossibleNumber(raw);
            if (n !== null) sums[idx] += n;
          }
        }

        // Check if any sum is non-zero
        const hasNonZeroSum = Object.values(sums).some(
          s => !Number.isNaN(s) && s !== 0
        );

        if (hasNonZeroSum) {
          const labelIdx = Math.max(
            0,
            fields.findIndex(f =>
              ["product", "productName", "producto"].includes(f)
            )
          );
          const footer = fields.map((_, i) => {
            if (i === labelIdx) return "Total";
            if (sums[i] !== undefined) {
              // Format quantity as number, total as money
              if (fields[i] === "quantity") {
                return String(Math.round(sums[i]));
              }
              return formatMoney(sums[i]);
            }
            return "";
          });
          body.push(footer);
        }
      }

      return { headers, body, widths };
    }

    const first = rows[0] ?? {};
    const fields =
      sheet.fields && sheet.fields.length > 0
        ? Array.from(sheet.fields)
        : Object.keys(first);

    const headers = fields.map(
      key => sheet.headerMap?.[key] ?? this.humanize(key)
    );
    const body = rows.map(row =>
      fields.map(key => formatCell(key, (row as any)?.[key]))
    );
    const widths: Array<number | "*" | "auto"> = fields.map(f =>
      f === "product" || f === "customer" ? "*" : "auto"
    );

    return { headers, body, widths };
  }

  // PDF generation for Receipt
  async generateReceiptPdf(
    data: ReceiptPdfData
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const safeData: ReceiptPdfData = {
      ...data,
      items: Array.isArray(data.items) ? data.items : [],
      payments: Array.isArray(data.payments) ? data.payments : [],
    };
    const logo = this.getLogoBase64();
    const docDefinition = getReceiptPdfDocDefinition(safeData, logo);
    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const fileName = `recibo-${data.orderNumber}.pdf`;

        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", err => {
        reject(err);
      });
      pdfDoc.end();
    });
  }

  // PDF generation for Transfer
  async generateTransferPdf(
    data: TransferPdfData
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const safeData: TransferPdfData = {
      ...data,
      items: Array.isArray(data.items) ? data.items : [],
    };
    const logo = this.getLogoBase64();
    const docDefinition = getTransferPdfDocDefinition(safeData, logo);
    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const fileName = `transferencia-${data.trackingNumber}.pdf`;

        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", err => {
        reject(err);
      });
      pdfDoc.end();
    });
  }

  async generateCashSessionPdf(
    data: CashSessionPdfData
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const logo = this.getLogoBase64();
    const docDefinition = getCashSessionPdfDocDefinition(data, logo);

    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const fileName = `reporte-caja-${data.sessionId}.pdf`;
        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", reject);
      pdfDoc.end();
    });
  }

  async generateSupplierOrderPdf(
    data: SupplierOrderPdfData
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const logo = this.getLogoBase64();
    const docDefinition = this.supplierOrderPdfService.generatePdfDefinition(
      data,
      logo
    );

    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const fileName = `orden-compra-${data.orderNumber}.pdf`;
        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", err => {
        reject(err);
      });
      pdfDoc.end();
    });
  }

  async generateQuotePdf(
    data: QuotePdfData
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const logo = this.getLogoBase64();
    const docDefinition = getQuotePdfDocDefinition(data, logo);

    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const fileName = `cotizacion-${data.quoteNumber || "sin-numero"}.pdf`;
        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", err => {
        reject(err);
      });
      pdfDoc.end();
    });
  }

  async generateStockMovementsPdf(
    data: StockMovementReportData
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const logo = this.getLogoBase64();
    const docDefinition = getStockMovementsPdfDocDefinition(data, logo);

    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const parts = [
          "movimientos",
          "stock",
          data.originHeader,
          data.destinationHeader,
        ];

        const fileName = `${parts.filter(Boolean).join("-")}.pdf`;

        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", err => {
        reject(err);
      });
      pdfDoc.end();
    });
  }

  /**
   * Generate sales-by-customer report PDF using the same structure and styles
   * as receipts, stock movements, etc. Includes date range and generated-at (from client).
   */
  async generateSalesByCustomerPdf(
    workbookReq: DataWorkbookRequest,
    meta: {
      from?: string;
      to?: string;
      generatedAt?: string;
      generatedAtFormatted?: string;
      timeZone?: string;
    }
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const sheet = workbookReq.sheets?.[0];
    const rows = Array.from(sheet?.rows ?? []);

    const isTotalRow = (row: any): boolean => {
      for (const key in row) {
        const v = row?.[key];
        if (v != null && String(v).trim().toLowerCase() === "total")
          return true;
      }
      return false;
    };

    const dataRows = rows.filter(r => !isTotalRow(r));

    const items = dataRows.map((r: any) => ({
      customer: String(r.customer ?? ""),
      orderNumber: String(r.orderNumber ?? ""),
      branch: String(r.branch ?? ""),
      sellerName: String(r.sellerName ?? ""),
      orderDiscount: Number(r.orderDiscount ?? 0),
      status: String(r.status ?? ""),
      orderSubtotal: Number(r.orderSubtotal ?? 0),
      orderTaxes: Number(r.orderTaxes ?? 0),
      orderTotal: Number(r.orderTotal ?? 0),
    }));

    const totals = items.reduce(
      (acc, row) => ({
        orderDiscount: acc.orderDiscount + row.orderDiscount,
        orderSubtotal: acc.orderSubtotal + row.orderSubtotal,
        orderTaxes: acc.orderTaxes + row.orderTaxes,
        orderTotal: acc.orderTotal + row.orderTotal,
      }),
      { orderDiscount: 0, orderSubtotal: 0, orderTaxes: 0, orderTotal: 0 }
    );

    const pdfData: SalesReportPdfData = {
      companyName: "Esli Cosmetics",
      generatedAt: meta.generatedAt,
      generatedAtFormatted: meta.generatedAtFormatted,
      timeZone: meta.timeZone,
      dateRangeFrom: meta.from,
      dateRangeTo: meta.to,
      items,
      totals,
    };

    const logo = this.getLogoBase64();
    const docDefinition = getSalesReportPdfDocDefinition(pdfData, logo);
    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const fileName = "reporte-de-ventas.pdf";
        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", err => reject(err));
      pdfDoc.end();
    });
  }

  /**
   * Generate customers report PDF: same layout and table data as sales report
   * (Cliente, # Orden, Ubicación, etc.), but with info box "Fecha desde", "Fecha hasta", "Fecha emisión".
   * Uses sales-by-customer data so the table matches the sales report.
   */
  async generateCustomersReportPdf(
    workbookReq: DataWorkbookRequest,
    meta: {
      from?: string;
      to?: string;
      generatedAt?: string;
      generatedAtFormatted?: string;
      timeZone?: string;
    }
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const sheet = workbookReq.sheets?.[0];
    const rows = Array.from(sheet?.rows ?? []);

    const isTotalRow = (row: any): boolean => {
      for (const key in row) {
        const v = row?.[key];
        if (v != null && String(v).trim().toLowerCase() === "total")
          return true;
      }
      return false;
    };

    const dataRows = rows.filter(r => !isTotalRow(r));

    const items = dataRows.map((r: any) => ({
      customer: String(r.customer ?? ""),
      orderNumber: String(r.orderNumber ?? ""),
      branch: String(r.branch ?? ""),
      sellerName: String(r.sellerName ?? ""),
      orderDiscount: Number(r.orderDiscount ?? 0),
      status: String(r.status ?? ""),
      orderSubtotal: Number(r.orderSubtotal ?? 0),
      orderTaxes: Number(r.orderTaxes ?? 0),
      orderTotal: Number(r.orderTotal ?? 0),
    }));

    const totals = items.reduce(
      (acc, row) => ({
        orderDiscount: acc.orderDiscount + row.orderDiscount,
        orderSubtotal: acc.orderSubtotal + row.orderSubtotal,
        orderTaxes: acc.orderTaxes + row.orderTaxes,
        orderTotal: acc.orderTotal + row.orderTotal,
      }),
      { orderDiscount: 0, orderSubtotal: 0, orderTaxes: 0, orderTotal: 0 }
    );

    const pdfData: SalesReportPdfData = {
      companyName: "Esli Cosmetics",
      generatedAt: meta.generatedAt,
      generatedAtFormatted: meta.generatedAtFormatted,
      timeZone: meta.timeZone,
      dateRangeFrom: meta.from,
      dateRangeTo: meta.to,
      items,
      totals,
    };

    const logo = this.getLogoBase64();
    const docDefinition = getCustomersReportPdfDocDefinition(pdfData, logo);
    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const fileName = "customers.pdf";
        resolve({ fileName, buffer });
      });
      pdfDoc.on("error", err => reject(err));
      pdfDoc.end();
    });
  }

  private parseDashboardDateRange(
    fromStr: string,
    toStr: string
  ): { start: Date; endExclusive: Date } {
    const isoDay = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDay.test(fromStr) || !isoDay.test(toStr)) {
      throw new BadRequestException("from and to must be YYYY-MM-DD");
    }
    const start = new Date(`${fromStr}T00:00:00.000Z`);
    const endDay = new Date(`${toStr}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(endDay.getTime())) {
      throw new BadRequestException("Invalid from or to date");
    }
    if (start > endDay) {
      throw new BadRequestException("from must be on or before to");
    }
    const endExclusive = new Date(endDay);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    return { start, endExclusive };
  }

  private listUtcDaysInclusive(fromStr: string, toStr: string): string[] {
    const days: string[] = [];
    const [fy, fm, fd] = fromStr.split("-").map(Number);
    const [ty, tm, td] = toStr.split("-").map(Number);
    let cur = new Date(Date.UTC(fy, fm - 1, fd));
    const end = new Date(Date.UTC(ty, tm - 1, td));
    while (cur.getTime() <= end.getTime()) {
      days.push(cur.toISOString().slice(0, 10));
      cur = new Date(cur.getTime() + 86400000);
    }
    return days;
  }

  private dayKeyFromRow(day: Date | string): string {
    if (day instanceof Date) {
      return day.toISOString().slice(0, 10);
    }
    const s = String(day);
    return s.length >= 10 ? s.slice(0, 10) : s;
  }

  /**
   * Daily sales amount and order count (non-annulled orders), optional location.
   */
  async getDashboardSalesTrend(params: {
    from: string;
    to: string;
    locationId?: string;
  }): Promise<Array<{ date: string; sales: number; count: number }>> {
    const { start, endExclusive } = this.parseDashboardDateRange(
      params.from,
      params.to
    );
    const locationFilter = params.locationId
      ? Prisma.sql`AND o.location_id = ${params.locationId}::uuid`
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; sales: unknown; order_count: bigint }>
    >(Prisma.sql`
      SELECT (o.created_at AT TIME ZONE 'UTC')::date AS day,
             COALESCE(SUM(o.total_amount), 0)::numeric AS sales,
             COUNT(*)::bigint AS order_count
      FROM orders o
      WHERE o.created_at >= ${start}
        AND o.created_at < ${endExclusive}
        AND COALESCE(o.status, '') <> 'ANNULLED'
        ${locationFilter}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const byDay = new Map<string, { sales: number; count: number }>();
    for (const row of rows) {
      const key = this.dayKeyFromRow(row.day);
      byDay.set(key, {
        sales: Number(row.sales),
        count: Number(row.order_count),
      });
    }

    return this.listUtcDaysInclusive(params.from, params.to).map(iso => ({
      date: iso,
      sales: byDay.get(iso)?.sales ?? 0,
      count: byDay.get(iso)?.count ?? 0,
    }));
  }

  /**
   * Daily revenue (sum of total_amount) for date range, optional branch.
   */
  async getDashboardRevenue(params: {
    from: string;
    to: string;
    branchId?: string;
  }): Promise<Array<{ date: string; revenue: number }>> {
    const { start, endExclusive } = this.parseDashboardDateRange(
      params.from,
      params.to
    );
    const branchFilter = params.branchId
      ? Prisma.sql`AND o.branch_id = ${params.branchId}::uuid`
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; revenue: unknown }>
    >(Prisma.sql`
      SELECT (o.created_at AT TIME ZONE 'UTC')::date AS day,
             COALESCE(SUM(o.total_amount), 0)::numeric AS revenue
      FROM orders o
      WHERE o.created_at >= ${start}
        AND o.created_at < ${endExclusive}
        AND COALESCE(o.status, '') <> 'ANNULLED'
        ${branchFilter}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = this.dayKeyFromRow(row.day);
      byDay.set(key, Number(row.revenue));
    }

    return this.listUtcDaysInclusive(params.from, params.to).map(iso => ({
      date: iso,
      revenue: byDay.get(iso) ?? 0,
    }));
  }

  /**
   * Top 10 products by sold units in range (effective quantity after annulments).
   */
  async getDashboardTopProducts(params: {
    from: string;
    to: string;
    locationId?: string;
  }): Promise<Array<{ name: string; quantity: number; revenue: number }>> {
    const { start, endExclusive } = this.parseDashboardDateRange(
      params.from,
      params.to
    );
    const locationFilter = params.locationId
      ? Prisma.sql`AND o.location_id = ${params.locationId}::uuid`
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      Array<{ name: string; qty: unknown; rev: unknown }>
    >(Prisma.sql`
      SELECT COALESCE(MAX(p.name), '—') AS name,
             SUM(
               GREATEST(
                 COALESCE(oi.quantity, 0) - COALESCE(oi.annulled_quantity, 0),
                 0
               )
             )::numeric AS qty,
             SUM(
               GREATEST(
                 COALESCE(oi.line_total, 0) - COALESCE(oi.annulled_amount, 0),
                 0
               )
             )::numeric AS rev
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
      LEFT JOIN products p ON p.id = COALESCE(oi.product_id, pv.product_id)
      WHERE o.created_at >= ${start}
        AND o.created_at < ${endExclusive}
        AND COALESCE(o.status, '') <> 'ANNULLED'
        AND (COALESCE(oi.quantity, 0) - COALESCE(oi.annulled_quantity, 0)) > 0
        ${locationFilter}
      GROUP BY p.id
      HAVING p.id IS NOT NULL
      ORDER BY qty DESC
      LIMIT 10
    `);

    return rows.map(r => ({
      name: r.name,
      quantity: Math.round(Number(r.qty)),
      revenue: Number(r.rev),
    }));
  }

  /**
   * Daily cost of goods sold: effective sold quantity × variant cost price
   * from non-annulled orders in the date range.
   */
  async getDashboardStockInCost(params: {
    from: string;
    to: string;
    locationId?: string;
  }): Promise<Array<{ date: string; cost: number }>> {
    const { start, endExclusive } = this.parseDashboardDateRange(
      params.from,
      params.to
    );
    const locationFilter = params.locationId
      ? Prisma.sql`AND o.location_id = ${params.locationId}::uuid`
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; cost: unknown }>
    >(
      Prisma.sql`
      SELECT (o.created_at AT TIME ZONE 'UTC')::date AS day,
             COALESCE(SUM(
               GREATEST(
                 COALESCE(oi.quantity, 0) - COALESCE(oi.annulled_quantity, 0),
                 0
               ) * COALESCE(pv.cost_price, 0)
             ), 0)::numeric AS cost
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      LEFT JOIN product_variants pv ON pv.id = oi.product_variant_id
      WHERE o.created_at >= ${start}
        AND o.created_at < ${endExclusive}
        AND COALESCE(o.status, '') <> 'ANNULLED'
        AND GREATEST(
          COALESCE(oi.quantity, 0) - COALESCE(oi.annulled_quantity, 0),
          0
        ) > 0
        ${locationFilter}
      GROUP BY 1
      ORDER BY 1 ASC
    `
    );

    const byDay = new Map<string, number>();
    for (const row of rows) {
      const key = this.dayKeyFromRow(row.day);
      byDay.set(key, Number(row.cost));
    }

    return this.listUtcDaysInclusive(params.from, params.to).map(iso => ({
      date: iso,
      cost: byDay.get(iso) ?? 0,
    }));
  }

  async getDashboardStats(locationId?: string, timezone?: string) {
    // Compute "today" and "this month" boundaries in the business timezone.
    // Nicaragua (America/Managua) is UTC-6 with no DST. When the server runs
    // in UTC, midnight local = 06:00 UTC, so we offset by +6 hours.
    const tzOffset = timezone === "America/Managua" ? 6 : 6; // default to Nicaragua
    const now = new Date();

    const todayStartUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        tzOffset,
        0,
        0,
        0
      )
    );
    // If it's before midnight local (before 06:00 UTC), we're still in "yesterday"
    if (now < todayStartUtc) {
      todayStartUtc.setUTCDate(todayStartUtc.getUTCDate() - 1);
    }
    const todayEndUtc = new Date(todayStartUtc);
    todayEndUtc.setUTCDate(todayEndUtc.getUTCDate() + 1);

    // Month boundaries in local timezone
    const localDate = new Date(now.getTime() - tzOffset * 60 * 60 * 1000);
    const monthStartUtc = new Date(
      Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth(),
        1,
        tzOffset,
        0,
        0,
        0
      )
    );
    const nextMonthStartUtc = new Date(
      Date.UTC(
        localDate.getUTCFullYear(),
        localDate.getUTCMonth() + 1,
        1,
        tzOffset,
        0,
        0,
        0
      )
    );

    const orderWhereBase = {
      ...(locationId ? { locationId } : {}),
      status: { not: "ANNULLED" as const },
    };

    const [
      activeStores,
      todaySalesAmountAgg,
      monthSalesAmountAgg,
      todayUnitsAgg,
      monthUnitsAgg,
      inventoryItems,
      customersTotal,
      lowStockAndValueRows,
    ] = await Promise.all([
      this.prisma.branch.count({
        where: locationId
          ? {
              isActive: true,
              isDeleted: false,
              locations: { some: { id: locationId, isDeleted: false } },
            }
          : {
              isActive: true,
              isDeleted: false,
            },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          ...orderWhereBase,
          createdAt: { gte: todayStartUtc, lt: todayEndUtc },
        },
      }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: {
          ...orderWhereBase,
          createdAt: { gte: monthStartUtc, lt: nextMonthStartUtc },
        },
      }),
      this.prisma.orderItem.aggregate({
        _sum: { quantity: true },
        where: {
          order: {
            ...orderWhereBase,
            createdAt: { gte: todayStartUtc, lt: todayEndUtc },
          },
        },
      }),
      this.prisma.orderItem.aggregate({
        _sum: { quantity: true },
        where: {
          order: {
            ...orderWhereBase,
            createdAt: { gte: monthStartUtc, lt: nextMonthStartUtc },
          },
        },
      }),
      this.prisma.stockLevel.count({
        where: locationId ? { locationId } : {},
      }),
      this.prisma.customer.count({
        where: { isDeleted: false },
      }),
      // Aggregate inventory value and low-stock count in SQL instead of loading
      // every stock level row into memory (this runs on each dashboard load).
      this.prisma.$queryRaw<
        Array<{ inventory_value: number; low_stock_count: number }>
      >`
        SELECT
          COALESCE(SUM(sl.quantity * pv.cost_price), 0)::float AS inventory_value,
          COUNT(*) FILTER (
            WHERE pv.minimum_stock IS NOT NULL
              AND sl.quantity <= pv.minimum_stock
          )::int AS low_stock_count
        FROM stock_levels sl
        JOIN product_variants pv ON pv.id = sl.product_variant_id
        ${locationId ? Prisma.sql`WHERE sl.location_id = ${locationId}::uuid` : Prisma.empty}
      `,
    ]);

    const inventoryValue = Number(
      lowStockAndValueRows[0]?.inventory_value ?? 0
    );
    const lowStockCount = Number(lowStockAndValueRows[0]?.low_stock_count ?? 0);

    return {
      activeStores,
      salesUnits: {
        today: Number(todayUnitsAgg._sum.quantity ?? 0),
        month: Number(monthUnitsAgg._sum.quantity ?? 0),
      },
      salesAmount: {
        today: Number(todaySalesAmountAgg._sum.totalAmount ?? 0),
        month: Number(monthSalesAmountAgg._sum.totalAmount ?? 0),
      },
      inventory: {
        items: inventoryItems,
        value: inventoryValue,
        lowStock: lowStockCount,
      },
      customersTotal,
    };
  }

  async generateProductCatalogPdf(filters: {
    search?: string;
    brandId?: string;
    categoryId?: string;
  }): Promise<{ fileName: string; buffer: Buffer }> {
    const products =
      await this.productsService.findProductsForCatalogPdf(filters);
    const items: ProductCatalogPdfItem[] = products.map(p =>
      this.mapProductToCatalogPdfRow(p)
    );
    const generatedLabel = new Date().toLocaleString("es-NI", {
      dateStyle: "long",
      timeStyle: "short",
    });
    const logoRaw = this.getLogoBase64();
    const logo = typeof logoRaw === "string" ? logoRaw : null;
    const docDefinition = getProductCatalogPdfDocDefinition(
      items,
      logo,
      generatedLabel
    );
    const pdfDoc = this.pdfPrinter.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      pdfDoc.on("data", d => chunks.push(d));
      pdfDoc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const datePart = new Date().toISOString().slice(0, 10);
        resolve({
          fileName: `catalogo-productos-${datePart}.pdf`,
          buffer,
        });
      });
      pdfDoc.on("error", reject);
      pdfDoc.end();
    });
  }

  private mapProductToCatalogPdfRow(p: ProductsDto): ProductCatalogPdfItem {
    const brandName =
      (p.brand && typeof p.brand.name === "string" && p.brand.name.trim()) ||
      "Sin marca";
    const categoryName =
      (p.category &&
        typeof p.category.name === "string" &&
        p.category.name.trim()) ||
      "Sin categoría";
    const variants = (p.variants || []).map(v => {
      const prices = v.prices || [];
      const nums = prices
        .map(x => Number(x.price))
        .filter(n => !Number.isNaN(n));
      return {
        name: v.name ?? null,
        sku: v.sku ?? null,
        maxPrice: nums.length ? Math.max(...nums) : null,
      };
    });
    let kitLines: { name: string; quantity: number }[] | undefined;
    if (p.type === "KIT" && p.kitItems?.length) {
      kitLines = p.kitItems.map(k => ({
        name:
          k.productVariant?.name ||
          (k.productVariant as { product?: { name?: string } })?.product
            ?.name ||
          "Ítem",
        quantity: k.quantity,
      }));
    }
    return {
      name: p.name,
      sku: p.sku ?? null,
      brandName,
      categoryName,
      description: p.description ?? null,
      type: p.type,
      variants,
      kitLines,
    };
  }
}

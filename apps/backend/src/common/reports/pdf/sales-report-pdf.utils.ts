import type {
  TDocumentDefinitions,
  TableCell,
  Content,
} from "pdfmake/interfaces";
import { formatDateLocal } from "src/common/date-range/date-range.util";
import { formatMoney } from "src/common/money-format/money.utils";
import type { SalesReportPdfData } from "src/modules/reports/types/sales-report-pdf-types";

// Same colors and dimensions as stock-movements and receipt
const TABLE_BG = "#ececec";
const BORDER_COLOR = "#000000";
const TEXT_COLOR = "#222222";
const TEXT_COLOR_TABLE_BOLD = "#373735";
const PAGE_MARGINS: [number, number, number, number] = [30, 40, 30, 30];
// LETTER landscape width 792 - left margin 30 - right margin 30
const CONTENT_WIDTH = 732;

const FONT_BOOK = "GothamRoundedBook";
const FONT_BOLD = "GothamRoundedBold";
const FONT_SIZE_NORMAL = 8;
const FONT_SIZE_TOTAL = 9;
const FONT_SIZE_HEADER = 9;

// Table columns: Cliente, # Orden, Ubicación, Empleado, Descuento, Estado, Subtotal, Impuestos, Total
const SALES_TABLE_WIDTHS = ["*", 70, 72, 72, "*", 52, "*", "*", "*"];

/** Format YYYY-MM-DD to DD/MM/YYYY for display */
function formatDateOnly(ymd?: string): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

export type ReportPdfVariantOptions = {
  reportTitle: string;
  infoBoxRows: Array<{ label: string; value: string }>;
};

function buildReportPdfDocDefinition(
  data: SalesReportPdfData,
  logoBase64: string | null | undefined,
  options: ReportPdfVariantOptions
): TDocumentDefinitions {
  const companyTitle = data.companyName || "ESLI";
  const { reportTitle, infoBoxRows } = options;

  const defaultAddress =
    "De la Iglesia Pio X, 1c hacia abajo.\nEdificio doble planta, Esli Cosmetics.";
  const defaultEmail = "cosmeticseym@gmail.com";

  const cell = (c: TableCell): TableCell => c;

  const getSpacerTable = (): Content => ({
    table: {
      widths: ["*", 70, 80],
      body: [
        [
          {
            text: "\u00A0",
            colSpan: 3,
            border: [false, false, false, false],
            fillColor: "#ffffff",
            fontSize: FONT_SIZE_NORMAL,
          },
          {},
          {},
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => -8,
      paddingBottom: () => -8,
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
    margin: [0, 0, 0, 0],
  });

  const dataRows: TableCell[][] = (data.items || []).map((row): TableCell[] => [
    cell({
      text: row.customer || "—",
      style: "tableCell",
      alignment: "left",
      fillColor: TABLE_BG,
      fontSize: FONT_SIZE_NORMAL,
      color: TEXT_COLOR_TABLE_BOLD,
    }),
    cell({
      text: row.orderNumber || "—",
      style: "tableCell",
      alignment: "left",
      fillColor: TABLE_BG,
      fontSize: FONT_SIZE_NORMAL,
    }),
    cell({
      text: row.branch || "—",
      style: "tableCell",
      alignment: "left",
      fillColor: TABLE_BG,
      fontSize: FONT_SIZE_NORMAL,
    }),
    cell({
      text: row.sellerName || "—",
      style: "tableCell",
      alignment: "left",
      fillColor: TABLE_BG,
      fontSize: FONT_SIZE_NORMAL,
    }),
    cell({
      text: formatMoney(row.orderDiscount),
      style: "tableCell",
      alignment: "right",
      fillColor: TABLE_BG,
      fontSize: FONT_SIZE_NORMAL,
    }),
    cell({
      text: row.status || "—",
      style: "tableCell",
      alignment: "center",
      fillColor: TABLE_BG,
      fontSize: 7.2,
    }),
    cell({
      text: formatMoney(row.orderSubtotal),
      style: "tableCell",
      alignment: "right",
      fillColor: TABLE_BG,
      fontSize: FONT_SIZE_NORMAL,
    }),
    cell({
      text: formatMoney(row.orderTaxes),
      style: "tableCell",
      alignment: "right",
      fillColor: TABLE_BG,
      fontSize: FONT_SIZE_NORMAL,
    }),
    cell({
      text: formatMoney(row.orderTotal),
      style: "tableCellBold",
      alignment: "right",
      fillColor: TABLE_BG,
      font: FONT_BOLD,
      color: TEXT_COLOR_TABLE_BOLD,
    }),
  ]);

  const t = data.totals;
  // Table has 9 columns: Cliente, # Orden, Ubicación, Empleado, Descuento, Estado, Subtotal, Impuestos, Total.
  // Total label spans first 4 columns so Descuento (col 4) shows t.orderDiscount.
  const totalsRows: TableCell[][] = [
    [
      {
        text: "Total",
        style: "finalTotalLabel",
        colSpan: 4,
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
      {},
      {},
      {},
      {
        text: formatMoney(t.orderDiscount),
        style: "finalTotalValue",
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
      {},
      {
        text: formatMoney(t.orderSubtotal),
        style: "finalTotalValue",
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
      {
        text: formatMoney(t.orderTaxes),
        style: "finalTotalValue",
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
      {
        text: formatMoney(t.orderTotal),
        style: "finalTotalValue",
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
    ],
  ];

  const headerLogoStack: Content[] = logoBase64
    ? [
        {
          image: logoBase64,
          width: 135,
          height: 133,
          alignment: "left",
          margin: [5, -15, 30, -50],
        },
      ]
    : [
        {
          text: companyTitle,
          fontSize: 45,
          bold: true,
          font: FONT_BOLD,
          alignment: "left",
          margin: [30, -5, 0, 0],
        },
      ];

  // First box (receipt-style): title + Visítanos + dirección + e-mail — aligned vertically with logo (logo uses top -15)
  const HEADER_BOX_W = 230;
  const HEADER_BOX_H = 100;
  const headerBoxStack: Content = {
    width: HEADER_BOX_W,
    margin: [0, 0, 0, 0] as [number, number, number, number],
    stack: [
      {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: HEADER_BOX_W,
            h: HEADER_BOX_H,
            r: 14,
            lineWidth: 1,
            lineColor: BORDER_COLOR,
          },
        ],
      },
      {
        margin: [15, -95, 7, 0] as [number, number, number, number],
        stack: [
          {
            text: reportTitle,
            font: FONT_BOLD,
            fontSize: 22,
            alignment: "right",
            margin: [-20, 0, 10, -11] as [number, number, number, number],
            color: TEXT_COLOR_TABLE_BOLD,
          },
          "\n",
          {
            text: [
              {
                text: "Visítanos: ",
                bold: true,
                fontSize: 9.4,
                color: "#373735",
              },
              {
                text: defaultAddress,
                fontSize: 8.9,
                italics: true,
                color: "#373735",
              },
              "\n",
              { text: "e-mail: ", bold: true, fontSize: 9.4, color: "#373735" },
              { text: defaultEmail, fontSize: 8.9, color: "#373735" },
            ],
            alignment: "right",
          },
        ],
      },
    ],
  };

  // Info box (receipt-style): label | value rows — full width with spacing above/below
  const INFO_BOX_W = CONTENT_WIDTH;
  const INFO_BOX_H = Math.max(48, infoBoxRows.length * 18 + 16);
  const INFO_BOX_MARGIN_V = 14;
  const infoBoxContent: Content = {
    width: CONTENT_WIDTH,
    stack: [
      {
        canvas: [
          {
            type: "rect",
            x: 0,
            y: 0,
            w: INFO_BOX_W,
            h: INFO_BOX_H,
            r: 10,
            lineWidth: 1,
            lineColor: BORDER_COLOR,
          },
        ],
      },
      {
        margin: [7.5, -(INFO_BOX_H - 5), 30, 15] as [
          number,
          number,
          number,
          number,
        ],
        table: {
          widths: ["45%", "55%"],
          body: infoBoxRows.map(row => [
            {
              text: row.label,
              style: "infoLabel",
              color: "#373735",
              bold: true,
            },
            { text: row.value, style: "infoValue", color: "#373735" },
          ]),
        },
        layout: "noBorders",
      },
    ],
    margin: [0, INFO_BOX_MARGIN_V, 0, INFO_BOX_MARGIN_V] as [
      number,
      number,
      number,
      number,
    ],
  };

  return {
    pageSize: "LETTER",
    pageOrientation: "landscape",
    pageMargins: PAGE_MARGINS,
    defaultStyle: {
      font: FONT_BOOK,
      fontSize: FONT_SIZE_NORMAL,
      color: TEXT_COLOR,
      lineHeight: 1.2,
    },
    content: [
      {
        columns: [
          { width: "auto", stack: headerLogoStack },
          { width: "*", text: "" },
          headerBoxStack,
        ],
        margin: [0, 0, 0, 25] as [number, number, number, number],
      },

      getSpacerTable(),

      infoBoxContent,

      getSpacerTable(),

      // Rounded top header for table
      {
        canvas: [
          {
            type: "rect",
            x: 0.5,
            y: 0,
            w: CONTENT_WIDTH - 1,
            h: 15,
            r: 14,
            lineColor: BORDER_COLOR,
            color: TABLE_BG,
          },
          {
            type: "rect",
            x: 0.8,
            y: 10,
            w: CONTENT_WIDTH - 1.6,
            h: 9,
            color: TABLE_BG,
            lineColor: TABLE_BG,
            lineWidth: 0,
          },
        ],
        margin: [0, 0, 0, -10] as [number, number, number, number],
      },

      // Table: sales rows
      {
        table: {
          headerRows: 1,
          widths: SALES_TABLE_WIDTHS,
          body: [
            [
              { text: "Cliente", style: "tableHeader", alignment: "left" },
              { text: "# Orden", style: "tableHeader", alignment: "left" },
              { text: "Ubicación", style: "tableHeader", alignment: "left" },
              { text: "Empleado", style: "tableHeader", alignment: "left" },
              { text: "Descuento", style: "tableHeader", alignment: "right" },
              { text: "Estado", style: "tableHeader", alignment: "center" },
              { text: "Subtotal", style: "tableHeader", alignment: "right" },
              { text: "Impuestos", style: "tableHeader", alignment: "right" },
              { text: "Total", style: "tableHeader", alignment: "right" },
            ].map(
              h =>
                ({
                  ...h,
                  font: FONT_BOLD,
                  fontSize: FONT_SIZE_HEADER,
                  color: TEXT_COLOR_TABLE_BOLD,
                }) as TableCell
            ),
            ...dataRows,
          ],
        },
        layout: {
          hLineWidth: (i, node) => {
            if (i === 1) return 1;
            if (i === node.table.body.length) return 0;
            return 0.5;
          },
          vLineWidth: (i, node) =>
            i === 0 || i === node.table.widths?.length ? 1 : 0,
          hLineColor: i => (i === 1 ? BORDER_COLOR : TABLE_BG),
          vLineColor: () => BORDER_COLOR,
          fillColor: () => TABLE_BG,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: i => (i === 0 ? 0 : 2),
          paddingBottom: i => (i === 0 ? 0 : 2),
        },
      },

      // Totals table
      {
        table: {
          widths: SALES_TABLE_WIDTHS,
          body: totalsRows,
        },
        layout: {
          hLineWidth: (i, node) => {
            const lastRowIdx = node.table.body.length;
            if (i === lastRowIdx - 1 || i === lastRowIdx) return 1;
            return 0;
          },
          hLineColor: (i, node) => {
            const lastRowIdx = node.table.body.length;
            if (i === lastRowIdx - 1 || i === lastRowIdx) return BORDER_COLOR;
            return TABLE_BG;
          },
          vLineWidth: (i, node) =>
            i === 0 || i === node.table.widths?.length ? 1 : 0,
          vLineColor: () => BORDER_COLOR,
          fillColor: () => TABLE_BG,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 1,
          paddingBottom: () => 1,
        },
        margin: [0, 0, 0, 5],
      },
    ],

    styles: {
      infoLabel: {
        fontSize: FONT_SIZE_HEADER,
        color: "#222",
        margin: [0, 0, 0, 0],
      },
      infoValue: {
        fontSize: FONT_SIZE_NORMAL,
        color: "#222",
        alignment: "right",
        margin: [0, 0, 0, 0],
      },
      tableHeader: {
        bold: true,
        fontSize: FONT_SIZE_HEADER,
        color: "#000",
        margin: [0, 2, 0, 2],
      },
      tableCell: {
        fontSize: FONT_SIZE_NORMAL,
        color: "#333",
        margin: [0, 2, 0, 2],
      },
      tableCellBold: {
        fontSize: FONT_SIZE_NORMAL,
        bold: true,
        color: "#000",
        margin: [0, 2, 0, 2],
      },
      finalTotalLabel: {
        fontSize: FONT_SIZE_TOTAL,
        bold: true,
        color: "#000",
        alignment: "left",
        margin: [0, 0, 0, 0],
      },
      finalTotalValue: {
        fontSize: FONT_SIZE_TOTAL,
        bold: true,
        color: "#000",
        alignment: "right",
        margin: [0, 1, 0, 1],
      },
    },
  };
}

export function getSalesReportPdfDocDefinition(
  data: SalesReportPdfData,
  logoBase64?: string | null
): TDocumentDefinitions {
  const generatedAt =
    data.generatedAtFormatted ??
    formatDateLocal(
      (data.generatedAt as string | Date | undefined) ?? new Date(),
      data.timeZone
    );
  const fromStr = data.dateRangeFrom ? formatDateOnly(data.dateRangeFrom) : "?";
  const toStr = data.dateRangeTo ? formatDateOnly(data.dateRangeTo) : "?";
  const dateRangeValue =
    data.dateRangeFrom || data.dateRangeTo ? `${fromStr} - ${toStr}` : "Todos";
  return buildReportPdfDocDefinition(data, logoBase64, {
    reportTitle: "Reporte de ventas",
    infoBoxRows: [
      { label: "Período", value: dateRangeValue },
      { label: "Fecha de emisión", value: generatedAt },
    ],
  });
}

export function getCustomersReportPdfDocDefinition(
  data: SalesReportPdfData,
  logoBase64?: string | null
): TDocumentDefinitions {
  const generatedAt =
    data.generatedAtFormatted ??
    formatDateLocal(
      (data.generatedAt as string | Date | undefined) ?? new Date(),
      data.timeZone
    );
  const fromStr = data.dateRangeFrom ? formatDateOnly(data.dateRangeFrom) : "—";
  const toStr = data.dateRangeTo ? formatDateOnly(data.dateRangeTo) : "—";
  return buildReportPdfDocDefinition(data, logoBase64, {
    reportTitle: "Reporte de clientes",
    infoBoxRows: [
      { label: "Fecha desde", value: fromStr },
      { label: "Fecha hasta", value: toStr },
      { label: "Fecha emisión", value: generatedAt },
    ],
  });
}

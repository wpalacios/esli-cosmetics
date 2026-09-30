import type {
  Content,
  TDocumentDefinitions,
  TableCell,
} from "pdfmake/interfaces";
import { formatDateLocal } from "src/common/date-range/date-range.util";
import { formatUSDLocal } from "src/common/money-format/money.utils";
import type { CashSessionPdfData } from "../../../modules/reports/types/cash-session-types";

// --- Design constants  ---
const TABLE_BG = "#ececec";
const BORDER_COLOR = "#000000";
const TEXT_COLOR = "#222222";
const PAGE_MARGINS: [number, number, number, number] = [30, 40, 30, 30];
const CONTENT_WIDTH = 552;
const FONT_SIZE_NORMAL = 9;
const FONT_SIZE_TOTAL = 12;
const FONT_SIZE_HEADER = 12;

// Helper for margins
const margin = (
  a: number,
  b: number,
  c: number,
  d: number
): [number, number, number, number] => [a, b, c, d];

// Section separator helpers
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

const getTableLineSeparator = (): Content => ({
  table: {
    widths: ["*", 70, 80],
    body: [
      [
        {
          text: "\u00A0",
          colSpan: 3,
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
    vLineWidth: (i, node) =>
      i === 0 || i === (node.table.widths?.length ?? 0) ? 1 : 0,
    vLineColor: () => BORDER_COLOR,
    paddingLeft: () => 6,
    paddingRight: () => 6,
    paddingTop: () => 2,
    paddingBottom: () => 2,
  },
  margin: [0, 0, 0, 0],
});

export const getCashSessionPdfDocDefinition = (
  data: CashSessionPdfData,
  logoBase64?: string | null
): TDocumentDefinitions => {
  const formatCurrency = (val: number) => formatUSDLocal(val);
  const companyTitle = data.companyName || "ESLI";
  const tz = data.timeZone;
  const fmt = (v: string) => formatDateLocal(v, tz);

  // --- Data mapping ---
  // Order rows
  const orderRows: TableCell[][] = (data.orders || []).map(o => [
    {
      text: o.orderNumber || "-",
      style: "tableCell",
      alignment: "left",
      fillColor: TABLE_BG,
      font: "GothamRoundedBook",
    },
    {
      text: o.paymentMethod === "CREDIT" ? "Crédito" : "Efectivo",
      style: "tableCellBold",
      alignment: "center",
      fillColor: TABLE_BG,
      font: "GothamRoundedBold",
      color: "#373735",
    },
    {
      text: formatCurrency(o.totalAmount),
      style: "tableCellBold",
      alignment: "right",
      fillColor: TABLE_BG,
      font: "GothamRoundedBold",
      color: "#373735",
    },
  ]);

  // Movement rows
  const movementRows: TableCell[][] = [];
  if (data.movements?.length) {
    movementRows.push([
      {
        text: "Movimientos Manuales",
        style: "paymentHeader",
        colSpan: 3,
        font: "GothamRoundedBold",
        fontSize: FONT_SIZE_HEADER,
        color: "#373735",
      },
      { text: "" },
      { text: "" },
    ]);
    data.movements.forEach(m => {
      movementRows.push([
        {
          text: m.type === "IN" ? "ENTRADA" : "SALIDA",
          style: "paymentRow",
          colSpan: 1,
          fillColor: "#f7f6f4",
          color: m.type === "IN" ? "#059669" : "#DC2626",
          font: "GothamRoundedBold",
        },
        {
          text: m.reason || "Sin descripción",
          style: "paymentRow",
          fillColor: "#f7f6f4",
          font: "GothamRoundedBook",
        },
        {
          text: formatCurrency(m.amount),
          style: "paymentRowBold",
          alignment: "right",
          fillColor: "#f7f6f4",
          font: "GothamRoundedBold",
        },
      ]);
    });
  }

  // --- Header & logo ---
  const headerLogoStack: Content[] = logoBase64
    ? [
        {
          image: logoBase64,
          width: 135,
          height: 133,
          alignment: "left",
          margin: margin(5, -15, 30, -50),
        },
      ]
    : [
        {
          text: companyTitle,
          fontSize: 45,
          bold: true,
          font: "GothamRoundedBold",
          alignment: "left",
          margin: margin(30, -5, 0, 0),
          color: "#373735",
        },
        {
          text: "c o s m e t i c s",
          fontSize: 12,
          characterSpacing: 2,
          alignment: "left",
          margin: margin(32, -5, 0, 0),
        },
      ];

  // --- Credit Installment Payments Table ---
  const creditInstallmentPaymentsBlock: Content = {
    table: {
      headerRows: 2,
      widths: ["*", "auto", "auto", 90],
      body: [
        [
          {
            text: "Pagos de Cuotas de Crédito",
            colSpan: 4,
            style: "tableHeader",
            alignment: "left",
            fontSize: FONT_SIZE_HEADER,
            font: "GothamRoundedBold",
            color: "#373735",
            fillColor: TABLE_BG,
            border: [true, true, true, true],
            margin: [0, 2, 0, 2],
          },
          { text: "", border: [true, true, true, true] },
          { text: "", border: [true, true, true, true] },
          { text: "", border: [true, true, true, true] },
        ],
        [
          {
            text: "Número de Orden",
            style: "tableHeader",
            alignment: "left",
            fontSize: FONT_SIZE_HEADER,
            font: "GothamRoundedBold",
            color: "#373735",
            border: [true, true, true, true],
          },
          {
            text: "Fecha",
            style: "tableHeader",
            alignment: "left",
            fontSize: FONT_SIZE_HEADER,
            font: "GothamRoundedBold",
            color: "#373735",
            border: [true, true, true, true],
          },
          {
            text: "Cuota #",
            style: "tableHeader",
            alignment: "center",
            fontSize: FONT_SIZE_HEADER,
            font: "GothamRoundedBold",
            color: "#373735",
            border: [true, true, true, true],
          },
          {
            text: "Monto",
            style: "tableHeader",
            alignment: "right",
            fontSize: FONT_SIZE_HEADER,
            font: "GothamRoundedBold",
            color: "#373735",
            border: [true, true, true, true],
          },
        ],
        ...(Array.isArray(data.creditInstallmentPayments) &&
        data.creditInstallmentPayments.length
          ? data.creditInstallmentPayments.map(p => [
              {
                text: p.orderNumber || "-",
                style: "tableCell",
                alignment: "left",
                fillColor: TABLE_BG,
                font: "GothamRoundedBook",
                border: [true, false, true, false],
              },
              {
                text: fmt(p.date),
                style: "tableCell",
                alignment: "left",
                fillColor: TABLE_BG,
                font: "GothamRoundedBook",
                border: [true, false, true, false],
              },
              {
                text:
                  p.installmentNo !== null && p.installmentNo !== undefined
                    ? `#${p.installmentNo}`
                    : "-",
                style: "tableCellBold",
                alignment: "center",
                fillColor: TABLE_BG,
                font: "GothamRoundedBold",
                color: "#373735",
                border: [true, false, true, false],
              },
              {
                text: formatCurrency(p.amount),
                style: "tableCellBold",
                alignment: "right",
                fillColor: TABLE_BG,
                font: "GothamRoundedBold",
                color: "#373735",
                border: [true, false, true, false],
              },
            ])
          : [
              [
                {
                  text: "No hay pagos de cuotas de crédito",
                  colSpan: 4,
                  alignment: "center",
                  color: "#999",
                  fontSize: FONT_SIZE_NORMAL,
                  border: [true, false, true, false],
                },
                { text: "", border: [true, false, true, false] },
                { text: "", border: [true, false, true, false] },
                { text: "", border: [true, false, true, false] },
              ],
            ]),
        [
          {
            text: "Total",
            colSpan: 3,
            style: "tableHeader",
            alignment: "left",
            fontSize: FONT_SIZE_HEADER,
            font: "GothamRoundedBold",
            color: "#373735",
            fillColor: TABLE_BG,
            border: [true, true, true, true],
            margin: [0, 2, 0, 2],
          },
          { text: "", border: [true, true, true, true] },
          { text: "", border: [true, true, true, true] },
          {
            text: formatCurrency(
              (data.creditInstallmentPayments ?? []).reduce(
                (sum, p) => sum + (p.amount || 0),
                0
              )
            ),
            style: "tableCellBold",
            alignment: "right",
            fontSize: FONT_SIZE_NORMAL,
            font: "GothamRoundedBold",
            color: "#373735",
            fillColor: TABLE_BG,
            border: [true, true, true, true],
            margin: [0, 2, 0, 2],
          },
        ],
      ] as TableCell[][],
    },
    layout: {
      hLineWidth: (i, node) => {
        if (
          i === 0 || // top
          i === 1 || // after title
          i === 2 || // after headers
          i === node.table.body.length - 1 || // above Total row
          i === node.table.body.length // bottom
        ) {
          return 1;
        }
        return 0;
      },
      hLineColor: (i, node) => {
        if (
          i === 0 ||
          i === 1 ||
          i === 2 ||
          i === node.table.body.length - 1 ||
          i === node.table.body.length
        ) {
          return BORDER_COLOR;
        }
        return TABLE_BG;
      },
      vLineWidth: (i, node) =>
        i === 0 || i === (node.table.widths?.length ?? 0) ? 1 : 0,
      vLineColor: () => BORDER_COLOR,
      fillColor: () => TABLE_BG,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 0] as [number, number, number, number],
  };

  return {
    pageSize: "LETTER",
    pageMargins: PAGE_MARGINS,
    defaultStyle: {
      font: "GothamRoundedBook",
      fontSize: FONT_SIZE_NORMAL,
      color: TEXT_COLOR,
      lineHeight: 1.2,
    },
    content: [
      // HEADER
      {
        columns: [
          { width: "auto", stack: headerLogoStack },
          { width: "*", text: "" },
          {
            width: 230,
            stack: [
              {
                canvas: [
                  {
                    type: "rect" as const,
                    x: 0,
                    y: 0,
                    w: 230,
                    h: 41,
                    r: 14,
                    lineWidth: 1,
                    lineColor: BORDER_COLOR,
                  },
                ],
                margin: [0, 55, 0, 0] as [number, number, number, number],
              },
              {
                margin: [15, -36, 7, 0] as [number, number, number, number],
                stack: [
                  {
                    text: "Reporte de Caja",
                    font: "GothamRoundedBold",
                    fontSize: 26,
                    alignment: "right",
                    margin: [-20, 0, 0, -11] as [
                      number,
                      number,
                      number,
                      number,
                    ],
                  },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 25] as [number, number, number, number],
      },

      getSpacerTable(),

      // INFO BOX
      {
        stack: [
          {
            canvas: [
              {
                type: "rect" as const,
                x: 0,
                y: 0,
                w: 550,
                h: 117,
                r: 10,
                lineWidth: 1,
                lineColor: BORDER_COLOR,
              },
            ],
          },
          {
            margin: [7.5, -114, 30, 10] as [number, number, number, number],
            table: {
              widths: ["45%", "59%"],
              body: [
                [
                  { text: "Sucursal", style: "infoLabel", color: "#373735" },
                  {
                    text: data.branchName || "Tienda Principal",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Caja Registradora",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: `${data.cashRegisterName} (${data.cashRegisterCode || "N/A"})`,
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Apertura",
                    style: "infoValueBold",
                    fontSize: FONT_SIZE_HEADER,
                    font: "GothamRoundedBold",
                    color: "#373735",
                    alignment: "left",
                  },
                  {
                    text: data.employeeName,
                    style: "infoValueBold",
                    fontSize: FONT_SIZE_HEADER,
                    font: "GothamRoundedBold",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Fecha/Hora de Apertura",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: fmt(data.openedAt),
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Cierre",
                    style: "infoValueBold",
                    fontSize: FONT_SIZE_HEADER,
                    font: "GothamRoundedBold",
                    color: "#373735",
                    alignment: "left",
                  },
                  {
                    text: data.closedByName || "La sesión continúa abierta",
                    style: "infoValueBold",
                    fontSize: FONT_SIZE_HEADER,
                    font: "GothamRoundedBold",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Fecha/Hora de Cierre",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: data.closedAt
                      ? fmt(data.closedAt)
                      : "La sesión continúa abierta",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
              ],
            },
            layout: "noBorders",
          },
        ],
        margin: [0, 0, 0, 9] as [number, number, number, number],
      },

      // Add the same vertical separation between info box and table
      getSpacerTable(),

      // ORDERS TABLE
      {
        canvas: [
          {
            type: "rect" as const,
            x: 0.5,
            y: 0,
            w: CONTENT_WIDTH - 1,
            h: 15,
            r: 14,
            lineColor: BORDER_COLOR,
            color: TABLE_BG,
          },
          {
            type: "rect" as const,
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
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", 90],
          body: [
            [
              {
                text: "Número de Orden",
                style: "tableHeader",
                alignment: "left",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "Método",
                style: "tableHeader",
                alignment: "center",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "Monto",
                style: "tableHeader",
                alignment: "right",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
            ],
            ...orderRows,
          ],
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 1 ? 1 : i === node.table.body.length ? 0 : 0.5,
          vLineWidth: (i, node) =>
            i === 0 || i === (node.table.widths?.length ?? 0) ? 1 : 0,
          hLineColor: i => (i === 1 ? BORDER_COLOR : TABLE_BG),
          vLineColor: () => BORDER_COLOR,
          fillColor: () => TABLE_BG,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: i => (i === 0 ? 0 : 2),
          paddingBottom: i => (i === 0 ? 0 : 2),
        },
      },

      // --- SEPARADOR ---
      getTableLineSeparator(),

      // credit payments table
      creditInstallmentPaymentsBlock,

      getTableLineSeparator(),

      // MOVEMENTS TABLE
      {
        table: {
          widths: ["auto", "*", 80],
          body: movementRows.length
            ? movementRows
            : [
                [
                  {
                    text: "No hay movimientos manuales",
                    colSpan: 3,
                    alignment: "center",
                    color: "#999",
                    fontSize: 9,
                  },
                  {},
                  {},
                ],
              ],
        },
        layout: {
          hLineWidth: (i, node) => {
            // Draw top, after header, and bottom border
            if (i === 0) return 1;
            if (i === 1) return 1;
            if (i === node.table.body.length) return 1; // bottom border for last row
            return 0;
          },
          hLineColor: (i, node) => {
            if (i === 0 || i === 1 || i === node.table.body.length)
              return BORDER_COLOR;
            return TABLE_BG;
          },
          vLineWidth: (i, node) =>
            i === 0 || i === (node.table.widths?.length ?? 0) ? 1 : 0,
          vLineColor: () => BORDER_COLOR,
          fillColor: rowIndex => (rowIndex === 0 ? TABLE_BG : "#f7f6f4"),
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 2,
          paddingBottom: () => 2,
          margin: [0, 0, 0, -2] as [number, number, number, number],
        } as any,
      },

      getTableLineSeparator(),

      {
        table: {
          widths: ["*", 70, 80],
          body: [
            [
              {
                text: "Saldo Inicial",
                style: "totalLabel",
                colSpan: 2,
                font: "GothamRoundedBook",
                color: "#373735",
              },
              {},
              {
                text: formatCurrency(data.openingBalance),
                style: "totalValue",
                font: "GothamRoundedBook",
                color: "#373735",
              },
            ],
            [
              {
                text: "Total Ventas Sistema",
                style: "totalLabel",
                colSpan: 2,
                font: "GothamRoundedBook",
                color: "#373735",
              },
              {},
              {
                text: formatCurrency(data.systemTotal || 0),
                style: "totalValue",
                font: "GothamRoundedBook",
                color: "#373735",
              },
            ],
            [
              {
                text: "Cierre Efectivo (Físico)",
                style: "totalLabel",
                colSpan: 2,
                font: "GothamRoundedBook",
                color: "#373735",
              },
              {},
              {
                text: formatCurrency(data.closingBalance || 0),
                style: "totalValue",
                font: "GothamRoundedBook",
                color: "#373735",
              },
            ],
            [
              {
                text: "Saldo Final",
                style: "totalLabel",
                colSpan: 2,
                font: "GothamRoundedBook",
                color: "#373735",
              },
              {},
              {
                text: formatCurrency(data.closingBalance || 0),
                style: "totalValue",
                font: "GothamRoundedBook",
                color: "#373735",
              },
            ],
            [
              {
                text: "Diferencia de Caja",
                style: "finalTotalLabel",
                colSpan: 2,
                font: "GothamRoundedBold",
                color: "#000",
              },
              {},
              {
                text: formatCurrency(data.difference || 0),
                style: "finalTotalValue",
                font: "GothamRoundedBold",
                color: (data.difference || 0) < 0 ? "#DC2626" : "#059669",
              },
            ],
          ],
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
            i === 0 || i === (node.table.widths?.length ?? 0) ? 1 : 0,
          vLineColor: () => BORDER_COLOR,
          fillColor: () => TABLE_BG,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 0] as [number, number, number, number],
      },

      // FOOTER
      {
        canvas: [
          {
            type: "rect" as const,
            x: 0.5,
            y: 0,
            w: CONTENT_WIDTH - 1,
            h: 7,
            r: 15,
            lineWidth: 0,
            lineColor: BORDER_COLOR,
            color: "#f7f6f4",
          },
          {
            type: "rect" as const,
            x: 0.5,
            y: -1,
            w: CONTENT_WIDTH - 1,
            h: 5,
            lineWidth: 0,
            color: "#f7f6f4",
            lineColor: "#f7f6f4",
          },
          {
            type: "line" as const,
            x1: CONTENT_WIDTH - 0.5,
            y1: -2,
            x2: CONTENT_WIDTH - 0.5,
            y2: 4.5,
            lineWidth: 1,
            lineColor: BORDER_COLOR,
          },
          {
            type: "line" as const,
            x1: 0.5,
            y1: -2,
            x2: 0.5,
            y2: 4.5,
            lineWidth: 1,
            lineColor: BORDER_COLOR,
          },
        ],
        margin: [0, 0, 30, 10] as [number, number, number, number],
      },
    ],
    styles: {
      infoLabel: {
        fontSize: FONT_SIZE_NORMAL,
        color: "#222",
        margin: [0, 0, 0, 0],
      },
      infoValue: {
        fontSize: FONT_SIZE_NORMAL,
        color: "#222",
        alignment: "right",
        margin: [0, 0, 0, 0],
      },
      infoValueBold: {
        fontSize: FONT_SIZE_NORMAL,
        bold: true,
        color: "#000",
        alignment: "right",
        margin: [0, 0, 0, 0],
      },
      tableHeader: {
        bold: true,
        fontSize: FONT_SIZE_NORMAL,
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
      totalLabel: {
        fontSize: FONT_SIZE_NORMAL,
        alignment: "left",
        color: "#333",
        margin: [0, 2, 0, 2],
      },
      totalValue: {
        fontSize: FONT_SIZE_NORMAL,
        alignment: "right",
        color: "#333",
        margin: [0, 2, 0, 2],
      },
      finalTotalLabel: {
        fontSize: FONT_SIZE_TOTAL,
        bold: true,
        color: "#000",
        alignment: "left",
        margin: [0, 1, 0, 1],
      },
      finalTotalValue: {
        fontSize: FONT_SIZE_TOTAL,
        bold: true,
        color: "#000",
        alignment: "right",
        margin: [0, 1, 0, 1],
      },
      paymentHeader: {
        bold: true,
        fontSize: FONT_SIZE_NORMAL,
        color: "#000",
        margin: [0, 1, 0, 1],
      },
      paymentRow: { fontSize: FONT_SIZE_NORMAL, margin: [0, 1, 0, 1] },
      paymentRowBold: {
        fontSize: FONT_SIZE_NORMAL,
        bold: true,
        margin: [0, 1, 0, 1],
      },
      subheader: {
        fontSize: FONT_SIZE_HEADER,
        bold: true,
        margin: [0, 8, 0, 8],
        color: "#373735",
      },
    },
  };
};

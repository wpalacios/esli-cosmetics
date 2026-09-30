import type {
  TDocumentDefinitions,
  TableCell,
  Content,
} from "pdfmake/interfaces";
import { formatDateLocal } from "src/common/date-range/date-range.util";
import { getReceiptProductLine } from "src/common/orders/orders.utils";
import type { TransferPdfData } from "src/modules/stock-transfers/types/transfer-pdf-types";

const TABLE_BG = "#ececec";
const BORDER_COLOR = "#000000";
const TEXT_COLOR = "#222222";
const TEXT_COLOR_TABLE_BOLD = "#373735"; // for prices and quantities

const PAGE_MARGINS: [number, number, number, number] = [30, 40, 30, 30];
const CONTENT_WIDTH = 552;

const FONT_BOOK = "GothamRoundedBook";
const FONT_BOLD = "GothamRoundedBold";

const FONT_SIZE_NORMAL = 9;
const FONT_SIZE_HEADER = 12;

export const getTransferPdfDocDefinition = (
  data: TransferPdfData,
  logoBase64?: string | null
): TDocumentDefinitions => {
  const companyTitle = data.companyName || "ESLI";
  // --- Products Table Rows ---
  // Uses the same formatting as receipt PDF for product variant details
  const productRows: TableCell[][] = (data.items || []).map(item => {
    return [
      {
        text: getReceiptProductLine({
          parentName: item.parentName,
          variantName: item.variantName,
          name: item.name,
          sku: item.sku,
        }),
        style: "tableCell",
        alignment: "left",
        fillColor: TABLE_BG,
        font: FONT_BOOK,
      },
      {
        text: item.quantityRequested.toString(),
        style: "tableCellBold",
        alignment: "center",
        fillColor: TABLE_BG,
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
      {
        text: item.quantitySent?.toString() || "-",
        style: "tableCellBold",
        alignment: "center",
        fillColor: TABLE_BG,
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
      {
        text: item.quantityReceived?.toString() || "-",
        style: "tableCellBold",
        alignment: "center",
        fillColor: TABLE_BG,
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
    ];
  });

  // --- Header & Logo ---
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

  // To separate sections between tables
  const getSpacerTable = (): Content => ({
    table: {
      widths: ["*", 70, 70, 70],
      body: [
        [
          {
            text: "\u00A0",
            colSpan: 4,
            border: [false, false, false, false],
            fillColor: "#ffffff",
            fontSize: FONT_SIZE_NORMAL,
          },
          {},
          {},
          {},
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingTop: () => -8, // space between pdf sections
      paddingBottom: () => -8, // space between pdf sections
      paddingLeft: () => 0,
      paddingRight: () => 0,
    },
    margin: [0, 0, 0, 0],
  });

  const getTableLineSeparator = (): Content => ({
    table: {
      widths: ["*", 70, 70, 70],
      body: [
        [
          {
            text: "\u00A0",
            colSpan: 4,
            fillColor: "#ffffff",
            fontSize: FONT_SIZE_NORMAL,
          },
          {},
          {},
          {},
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i, node) =>
        i === 0 || i === node.table.widths?.length ? 1 : 0,
      vLineColor: (i, node) =>
        i === 0 || i === node.table.widths?.length ? "#000000" : undefined,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 0],
  });

  const getHeaderInfoGap = (gap = 10): Content => ({
    text: "\u00A0",
    fontSize: 1,
    color: "#ffffff",
    margin: [0, 0, 0, gap],
  });

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
      {
        columns: [
          { width: "auto", stack: headerLogoStack },
          { width: "*", text: "" },
          {
            width: 245,
            margin: [-4, 54, 0, 0] as [number, number, number, number],
            stack: [
              {
                canvas: [
                  {
                    type: "rect",
                    x: 9,
                    y: 0,
                    w: 235,
                    h: 42,
                    r: 10,
                    lineWidth: 1,
                    lineColor: BORDER_COLOR,
                  },
                ],
              },
              {
                // Adjust text position inside the header box: [left, top, right, bottom].
                // left: +15 shifts text right; top: -29 pulls text upward to vertically center over the canvas;
                // right: +10 keeps right inner padding; bottom: 0 leaves bottom offset unchanged.
                margin: [15, -29, 10, 0] as [number, number, number, number],
                stack: [
                  {
                    text: "Orden de Transferencia",
                    font: FONT_BOLD,
                    fontSize: 18,
                    noWrap: true,
                    alignment: "center",
                    lineHeight: 1,
                    color: TEXT_COLOR_TABLE_BOLD,
                  },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },

      getHeaderInfoGap(10),

      // INFO BOX
      {
        stack: [
          {
            canvas: [
              {
                type: "rect",
                x: 0,
                y: 0,
                w: 550,
                h: 128,
                r: 10,
                lineWidth: 1,
                lineColor: BORDER_COLOR,
              },
            ],
          },
          {
            margin: [7.5, -123, 30, 15],
            table: {
              widths: ["45%", "59%"],
              body: [
                [
                  {
                    text: "Número de Seguimiento",
                    style: "infoValueBold",
                    fontSize: FONT_SIZE_HEADER,
                    alignment: "left",
                    font: "GothamRoundedBold",
                    color: "#373735",
                  },
                  {
                    text: data.trackingNumber,
                    style: "infoValueBold",
                    fontSize: FONT_SIZE_HEADER,
                    alignment: "right",
                    font: "GothamRoundedBold",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Ubicación Origen",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: data.fromLocation || "N/A",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Ubicación Destino",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: data.toLocation || "N/A",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Fecha emisión",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: formatDateLocal(new Date(data.createdAt)),
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  { text: "Creado por", style: "infoLabel", color: "#373735" },
                  {
                    text: data.createdBy || "System Administrator",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  { text: "Enviado por", style: "infoLabel", color: "#373735" },
                  {
                    text: data.sender || "-",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Recibido por",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: data.receiver || "-",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
              ],
            },
            layout: "noBorders",
          },
        ],
        margin: [0, 0, 0, 3],
      },

      getSpacerTable(),

      // Rounded Top Header for Table
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
        margin: [0, 0, 0, -10],
      },

      // TABLE: PRODUCTS
      {
        table: {
          headerRows: 1,
          widths: ["*", 70, 70, 70],
          body: [
            [
              {
                text: "Producto",
                style: "tableHeader",
                alignment: "left",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "Solicitado",
                style: "tableHeader",
                alignment: "center",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "Enviado",
                style: "tableHeader",
                alignment: "center",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "Recibido",
                style: "tableHeader",
                alignment: "center",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
            ],
            ...productRows,
          ],
        },
        layout: {
          hLineWidth: (i, node) =>
            i === 1 ? 1 : i === node.table.body.length ? 0 : 0.5,
          vLineWidth: (i, node) =>
            i === 0 || i === node.table.widths?.length ? 1 : 0,
          hLineColor: i => (i === 1 ? BORDER_COLOR : TABLE_BG),
          vLineColor: () => BORDER_COLOR,
          fillColor: () => TABLE_BG,
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: i => (i === 0 ? 0 : 2),
          paddingBottom: i => (i === 0 ? 0 : 2),
        },
      },

      // separator
      getTableLineSeparator(),

      {
        canvas: [
          {
            type: "rect",
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
            type: "rect",
            x: 0.5,
            y: -1,
            w: CONTENT_WIDTH - 1,
            h: 5,
            lineWidth: 0,
            color: "#f7f6f4",
            lineColor: "#f7f6f4",
          },
          {
            type: "line",
            x1: CONTENT_WIDTH - 0.5,
            y1: -2,
            x2: CONTENT_WIDTH - 0.5,
            y2: 4.5,
            lineWidth: 1,
            lineColor: BORDER_COLOR,
          },
          {
            type: "line",
            x1: 0.5,
            y1: -2,
            x2: 0.5,
            y2: 4.5,
            lineWidth: 1,
            lineColor: BORDER_COLOR,
          },
        ],
        margin: [0, 0, 30, 10],
      },
    ],
    // Styles definition
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
    },
  };
};

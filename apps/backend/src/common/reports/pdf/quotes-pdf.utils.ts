import type {
  Content,
  TDocumentDefinitions,
  TableCell,
} from "pdfmake/interfaces";
import { formatDateLocal } from "src/common/date-range/date-range.util";
import { formatUSDLocal } from "src/common/money-format/money.utils";
import { getReceiptProductLine } from "src/common/orders/orders.utils";
import type { QuotePdfData } from "src/modules/reports/types/quote-types";

// colors and dimensions
const TABLE_BG = "#ececec";
const BORDER_COLOR = "#000000";
const TEXT_COLOR = "#222222";
const PAGE_MARGINS: [number, number, number, number] = [30, 40, 30, 30];
const CONTENT_WIDTH = 552;

// size adjustments
const FONT_SIZE_NORMAL = 9;
const FONT_SIZE_TOTAL = 12;
const FONT_SIZE_HEADER = 12;

export const getQuotePdfDocDefinition = (
  data: QuotePdfData,
  logoBase64?: string | null
): TDocumentDefinitions => {
  const formatCurrency = (val: number) => formatUSDLocal(val);

  const defaultAddress =
    "De la Iglesia Pio X, 1c hacia abajo.\nEdificio doble planta, Esli Cosmetics.";
  const defaultEmail = "cosmeticseym@gmail.com";
  const companyTitle = data.companyName || "ESLI";
  const getQuoteTypeLabel = (type?: string) => {
    switch (type) {
      case "DRAFT":
        return "Borrador";
      case "APPROVED":
        return "Aprobada";
      case "EXPIRED":
        return "Expirada";
      case "CONVERTED":
        return "Venta Completada";
      case "ANNULLED":
        return "Anulada";
      default:
        return type || "-";
    }
  };

  // --- Products Table Rows ---
  // Renders each item in the quote. If the item is a product kit,
  // it displays the kit's components as an indented bullet-point list
  // for better readability. Regular products are displayed on a single line.
  const productRows: TableCell[][] = (data.items || []).map(item => {
    const isKit = item.metadata?.isKit;
    let productCell: Content;

    if (
      isKit &&
      Array.isArray(item.metadata?.components) &&
      item.metadata.components.length > 0
    ) {
      // For kits, create a stack:
      // 1. The kit's name and SKU.
      // 2. A two-column layout for its components to save space.
      const componentLines: Content[] = [];
      const components = item.metadata.components;

      for (let i = 0; i < components.length; i += 2) {
        const comp1 = components[i];
        const comp2 = components[i + 1]; // This will be undefined if there's an odd number of components

        componentLines.push({
          columns: [
            {
              width: "*",
              text: `• ${comp1.qty}x ${comp1.name}`,
              fontSize: 8,
            },
            {
              width: "*",
              text: comp2 ? `• ${comp2.qty}x ${comp2.name}` : "", // Only add second item if it exists
              fontSize: 8,
            },
          ],
          columnGap: 10,
        });
      }

      productCell = {
        stack: [
          { text: `${item.name} - ${item.sku || ""}`, bold: true },
          {
            stack: componentLines,
            margin: [10, 2, 0, 0], // Indent the component block
            fontSize: FONT_SIZE_NORMAL - 1,
            color: "#555",
          },
        ],
        style: "tableCell",
        alignment: "left",
        fillColor: TABLE_BG,
        font: "GothamRoundedBook",
      };
    } else {
      // For regular products, display the standard product line.
      productCell = {
        text: getReceiptProductLine(item),
        style: "tableCell",
        alignment: "left",
        fillColor: TABLE_BG,
        font: "GothamRoundedBook",
        bold: true,
      };
    }

    return [
      productCell,
      {
        text: item.quantity.toString(),
        style: "tableCellBold",
        alignment: "center",
        fillColor: TABLE_BG,
        font: "GothamRoundedBold",
        color: "#373735",
      },
      {
        text: formatCurrency(item.lineTotal),
        style: "tableCellBold",
        alignment: "right",
        fillColor: TABLE_BG,
        font: "GothamRoundedBold",
        color: "#373735",
      },
    ];
  });

  // --- Totals Table Rows ---
  const totalsRows: TableCell[][] = [];

  // Helper function to add a total row
  const addTotalRow = (label: string, value: number, isNegative = false) => {
    totalsRows.push([
      {
        text: label,
        style: "totalLabel",
        colSpan: 2,
        font: "GothamRoundedBook",
        color: "#373735",
      },
      { text: "" },
      {
        text: isNegative
          ? `-${formatCurrency(Math.abs(value))}`
          : formatCurrency(value),
        style: "totalValue",
        font: "GothamRoundedBook",
        color: "#373735",
      },
    ]);
  };

  addTotalRow("Subtotal", data.subtotal || 0);

  if (data.itemsDiscountTotal)
    addTotalRow("Descuentos en artículos", data.itemsDiscountTotal, true);
  if (data.discountCodeValue)
    addTotalRow("Código de descuento", data.discountCodeValue, true);
  if (data.manualDiscount)
    addTotalRow("Descuento manual", data.manualDiscount, true);
  if (data.totalDiscount)
    addTotalRow("Descuento total", data.totalDiscount, true);
  if (data.taxes) addTotalRow("Impuestos", data.taxes);

  // Final Total Row
  totalsRows.push([
    {
      text: "Total",
      style: "finalTotalLabel",
      colSpan: 2,
      font: "GothamRoundedBold",
      color: "#373735",
    },
    { text: "" },
    {
      text: formatCurrency(data.totalAmount || 0),
      style: "finalTotalValue",
      font: "GothamRoundedBold",
      color: "#373735",
    },
  ]);

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
          font: "GothamRoundedBold",
          alignment: "left",
          margin: [30, -5, 0, 0],
        },
        {
          text: "c o s m e t i c s",
          fontSize: 12,
          characterSpacing: 2,
          alignment: "left",
          margin: [32, -5, 0, 0],
        },
      ];

  // To separate sections between tables
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
            width: 230,
            stack: [
              {
                canvas: [
                  {
                    type: "rect",
                    x: 0,
                    y: 0,
                    w: 230,
                    h: 100,
                    r: 14,
                    lineWidth: 1,
                    lineColor: BORDER_COLOR,
                  },
                ],
              },
              {
                margin: [15, -95, 7, 0],
                stack: [
                  {
                    text: "Cotización",
                    font: "GothamRoundedBold",
                    fontSize: 40,
                    alignment: "right",
                    margin: [-20, 0, 0, -11],
                  },
                  {
                    text: [
                      {
                        text: "Visítanos: ",
                        bold: true,
                        fontSize: 9.4,
                        color: "#373735",
                      },
                      {
                        text: data.companyAddress || defaultAddress,
                        fontSize: 8.9,
                        italics: true,
                        color: "#373735",
                      },
                      "\n",
                      {
                        text: "e-mail: ",
                        bold: true,
                        fontSize: 9.4,
                        color: "#373735",
                      },
                      {
                        text: data.email || defaultEmail,
                        fontSize: 8.9,
                        color: "#373735",
                      },
                    ],
                    alignment: "right",
                  },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 25],
      },

      // Separator
      getSpacerTable(),

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
                  { text: "Sucursal", style: "infoLabel", color: "#373735" },
                  {
                    text: data.branchName || "Tienda Principal",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Cliente",
                    style: "infoValueBold",
                    fontSize: FONT_SIZE_HEADER,
                    alignment: "left",
                    font: "GothamRoundedBold",
                    color: "#373735",
                  },
                  {
                    text: data.customer || "Cliente General",
                    style: "infoValueBold",
                    fontSize: FONT_SIZE_HEADER,
                    alignment: "right",
                    font: "GothamRoundedBold",
                    color: "#373735",
                  },
                ],
                [
                  {
                    text: "Tipo de Cotización",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: getQuoteTypeLabel(data.quoteType),
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  { text: "#Cotización", style: "infoLabel", color: "#373735" },
                  {
                    text: data.quoteNumber,
                    style: "infoValueBold",
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
                    text: formatDateLocal(data.date, data.timeZone),
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  { text: "Cajero", style: "infoLabel", color: "#373735" },
                  {
                    text: data.cashier || "System Administrator",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  { text: "Vendedor", style: "infoLabel", color: "#373735" },
                  {
                    text: data.seller || "-",
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

      // TABLE 1: PRODUCTS
      {
        table: {
          headerRows: 1,
          widths: ["*", 58, 90],
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
                text: "Cantidad",
                style: "tableHeader",
                alignment: "center",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "Total",
                style: "tableHeader",
                alignment: "right",
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

      //separator
      getTableLineSeparator(),

      // TABLE 2: TOTALS
      {
        table: {
          widths: ["*", 70, 80],
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
        margin: [0, 0, 0, 0],
      },

      // Rounded Bottom Footer
      {
        canvas: [
          {
            type: "rect",
            x: 0.5,
            y: 0,
            w: CONTENT_WIDTH - 1,
            h: 10,
            r: 11,
            lineWidth: 0,
            lineColor: BORDER_COLOR,
            color: TABLE_BG,
          },
          {
            type: "rect",
            x: 1.65,
            y: -1,
            w: CONTENT_WIDTH - 3.25,
            h: 5,
            lineWidth: 0,
            color: TABLE_BG,
            lineColor: TABLE_BG,
          },
        ],
        margin: [0, -7, 0, 10],
      },

      // FOOTER TEXT
      {
        columns: [
          {
            width: "*",
            text: [
              {
                text: data.thankYouMessage || "¡Gracias por su preferencia!",
                bold: true,
              },
              ` ${data.contactMessage || "Para consultas,\n contáctenos."}`,
            ],
            fontSize: 9,
            color: "#373735",
          },
          {
            width: "auto",
            text: [
              { text: "Celular: ", bold: true },
              "+505 7702 2605 / \n",
              "+505 8276 9703 / +505 7668 3336",
            ],
            alignment: "right",
            fontSize: 9,
            color: "#373735",
          },
        ],
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
};

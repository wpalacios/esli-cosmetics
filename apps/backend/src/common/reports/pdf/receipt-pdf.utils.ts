import type {
  Content,
  TDocumentDefinitions,
  TableCell,
} from "pdfmake/interfaces";
import { formatDateLocal } from "src/common/date-range/date-range.util";
import { formatUSDLocal } from "src/common/money-format/money.utils";
import type { ReceiptPdfData } from "src/modules/reports/types/receipt-types";

const TABLE_BG = "#ececec";
const BORDER_COLOR = "#000000";
const TEXT_COLOR = "#222222";
const TEXT_COLOR_SECONDARY = "#555555"; // for kits components
const TEXT_COLOR_TABLE_BOLD = "#373735"; // for prices and quantities

const PAGE_MARGINS: [number, number, number, number] = [30, 40, 30, 30];
const CONTENT_WIDTH = 552;

// --- Fonts ---
const FONT_BOLD = "GothamRoundedBold";

// --- Size Adjustments ---
const FONT_SIZE_NORMAL = 8;
const FONT_SIZE_TOTAL = 9;
const FONT_SIZE_HEADER = 9;

// --- Layout Helpers ---
export const getReceiptPdfDocDefinition = (
  data: ReceiptPdfData,
  logoBase64?: string | null
): TDocumentDefinitions => {
  const formatCurrency = (val: number) => formatUSDLocal(val);

  const defaultAddress =
    "De la Iglesia Pio X, 1c hacia abajo.\nEdificio doble planta, Esli Cosmetics.";
  const defaultEmail = "cosmeticseym@gmail.com";
  const companyTitle = data.companyName || "ESLI";
  const isCredit = data.receiptType === "CREDIT";

  // --- Products Table Rows ---
  // Optimized for horizontal space efficiency:
  // 1. Fixed columns (Cant, SKU, Prices) are narrowed.
  // 2. Product column uses a 3-level vertical hierarchy.
  // 3. Kit components use a micro-font (7pt) and minimal column gaps.
  const productRows: TableCell[][] = (data.items || []).map(item => {
    const componentLines: Content[] = [];

    // Micro-layout for Kit components
    if (
      item.isKit &&
      Array.isArray(item.kitItems) &&
      item.kitItems.length > 0
    ) {
      const components = item.kitItems;

      for (let i = 0; i < components.length; i += 2) {
        const comp1 = components[i];
        const comp2 = components[i + 1];

        componentLines.push({
          columns: [
            {
              width: "*",
              text: `• ${comp1.quantity}x ${comp1.name}`,
              fontSize: 7, // Micro-font for components
            },
            {
              width: "*",
              text: comp2 ? `• ${comp2.quantity}x ${comp2.name}` : "",
              fontSize: 7,
            },
          ],
          columnGap: 3, // Minimal gap to keep columns "pegadas"
        });
      }
    }

    // Vertical hierarchy to prevent horizontal stretching
    const productCellContent: Content = {
      stack: [
        // Level 1: Parent Name (Strongest visual weight)
        {
          text: item.parentName || "",
          bold: true,
          fontSize: FONT_SIZE_NORMAL,
        },
        // Level 2: Variant Details (Reduced weight)
        {
          text: [item.variantName, item.sku].filter(Boolean).join(" - "),
          fontSize: 8, // Smaller than normal text
          color: TEXT_COLOR_TABLE_BOLD,
          margin: [0, 0, 0, item.isKit ? 1 : 0] as [
            number,
            number,
            number,
            number,
          ],
        },
        // Level 3: Components (Minimal weight)
        ...(componentLines.length > 0
          ? [
              {
                stack: componentLines,
                margin: [4, 1, 0, 2] as [number, number, number, number],
                color: TEXT_COLOR_SECONDARY,
              },
            ]
          : []),
      ],
    };

    return [
      // Column: Cant. (Width: 25)
      {
        text: item.quantity.toString(),
        style: "tableCellBold",
        alignment: "center",
        fillColor: TABLE_BG,
        font: FONT_BOLD,
      },
      // Column: SKU (Width: 65)
      {
        text: item.parentSku || "",
        style: "tableCell",
        alignment: "center",
        fillColor: TABLE_BG,
        fontSize: 8,
      },
      // Column: Producto (Width: Flexible *)
      {
        ...productCellContent,
        style: "tableCell",
        alignment: "left",
        fillColor: TABLE_BG,
      },
      // Column: Costo Unit. (Width: 65)
      {
        text: formatCurrency(item.unitPrice),
        style: "tableCell",
        alignment: "right",
        fillColor: TABLE_BG,
        fontSize: 8.5,
      },
      // Column: Total (Width: 75)
      {
        text: formatCurrency(item.totalPrice),
        style: "tableCellBold",
        alignment: "right",
        fillColor: TABLE_BG,
        font: FONT_BOLD,
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

  addTotalRow("Subtotal", data.subtotal);

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
      text: formatCurrency(data.totalAmount),
      style: "finalTotalValue",
      font: "GothamRoundedBold",
      color: "#373735",
    },
  ]);

  // --- Payments Table Rows ---
  const paymentRows: TableCell[][] = [];
  // TODO: analyze if this should be added back
  if (data.payments?.length) {
    // paymentRows.push([
    //   {
    //     text: "Método de Pago",
    //     style: "paymentHeader",
    //     colSpan: 2,
    //     font: "GothamRoundedBold",
    //     fontSize: FONT_SIZE_HEADER,
    //     color: "#373735",
    //   },
    //   {},
    //   {
    //     text: "Total",
    //     style: "paymentHeader",
    //     font: "GothamRoundedBold",
    //     fontSize: FONT_SIZE_HEADER,
    //     color: "#373735",
    //     alignment: "right",
    //   },
    // ]);
    // data.payments.forEach((p) => {
    //   paymentRows.push([
    //     {
    //       text:
    //         p.paymentType === "DOWN_PAYMENT"
    //           ? "Pago Inicial"
    //           : `${p.paymentType}${p.provider ? ` (${p.provider})` : ""}`,
    //       style: "paymentRow",
    //       colSpan: 2,
    //       font: "GothamRoundedBook",
    //       fillColor: "#f7f6f4",
    //     },
    //     {},
    //     {
    //       text: formatCurrency(p.amount || 0),
    //       style: "paymentRowBold",
    //       alignment: "right",
    //       font: "GothamRoundedBold",
    //       fillColor: "#f7f6f4",
    //     },
    //   ]);
    // });
  }
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
      paddingTop: () => -8, // space between pdf sections
      paddingBottom: () => -8, // space between pdf sections
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

  // Calculate initial payment for credit receipts to determine amount due
  const initialPayment = Array.isArray(data.payments)
    ? data.payments
        .filter(p => p.paymentType === "DOWN_PAYMENT")
        .reduce((sum, p) => sum + (p.amount || 0), 0)
    : 0;

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
                    text: "Factura",
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
                    text: "Tipo de Factura",
                    style: "infoLabel",
                    color: "#373735",
                  },
                  {
                    text: isCredit ? "Crédito" : "Contado",
                    style: "infoValue",
                    color: "#373735",
                  },
                ],
                [
                  { text: "#Factura", style: "infoLabel", color: "#373735" },
                  {
                    text: data.orderNumber,
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
        margin: [0, 12.5, 0, -10],
      },

      // TABLE 1: PRODUCTS
      {
        table: {
          headerRows: 1,
          // Optimized widths: [Cant, SKU, Producto, Costo, Total]
          // Total fixed width reduced to 230, leaving ~322 for the flexible column.
          widths: [25, 65, "*", 65, 75],
          body: [
            [
              {
                text: "Cant.",
                style: "tableHeader",
                alignment: "center",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "SKU",
                style: "tableHeader",
                alignment: "center",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "Producto",
                style: "tableHeader",
                alignment: "left",
                fontSize: FONT_SIZE_HEADER,
                font: "GothamRoundedBold",
                color: "#373735",
              },
              {
                text: "Costo Unit.",
                style: "tableHeader",
                alignment: "right",
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
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: i => (i === 0 ? 0 : 2),
          paddingBottom: i => (i === 0 ? 0 : 2),
        },
      },

      //separatpr
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
          paddingTop: () => 2,
          paddingBottom: () => 2,
        },
        margin: [0, 0, 0, 0],
      },

      // TABLE 3: PAYMENTS (only include if there are payments)
      ...(paymentRows.length > 0
        ? [
            getTableLineSeparator(),
            {
              table: {
                widths: ["*", 70, 80],
                body: paymentRows,
              },
              layout: {
                hLineWidth: (i, node) => {
                  if (i === 0) return 1;
                  if (i === 1) return 1;
                  const lastRowIdx = node.table.body.length;
                  if (i === lastRowIdx) return 0;
                  return 0;
                },
                hLineColor: i => (i === 0 || i === 1 ? BORDER_COLOR : TABLE_BG),
                vLineWidth: (i, node) =>
                  i === 0 || i === node.table.widths?.length ? 1 : 0,
                vLineColor: () => BORDER_COLOR,
                fillColor: rowIndex => {
                  if (rowIndex === 0) return TABLE_BG;
                  return "#f7f6f4";
                },
                paddingLeft: () => 6,
                paddingRight: () => 6,
                paddingTop: () => 2,
                paddingBottom: () => 2,
                margin: [0, 0, 0, -5],
              } as any,
            },
          ]
        : []),

      // TABLE 4: AMOUNT DUE
      ...(isCredit
        ? [
            {
              table: {
                widths: ["*", 70, 80],
                body: [
                  [
                    {
                      text: "Monto Adeudado",
                      style: "paymentHeader",
                      alignment: "left" as const,
                      color: "#373735",
                    },
                    { text: "" },
                    {
                      text: "Total",
                      style: "finalTotalValue",
                      alignment: "right" as const,
                      color: "#373735",
                    },
                  ],
                  [
                    {
                      text: "Saldo pendiente",
                      style: "infoLabel",
                      colSpan: 2,
                      fillColor: "#f7f6f4",
                    },
                    {},
                    {
                      text: formatCurrency(data.totalAmount - initialPayment),
                      style: "infoValue",
                      color: "#373735",
                      alignment: "right" as const,
                      fillColor: "#f7f6f4",
                    },
                  ],
                ] as TableCell[][],
              },
              layout: {
                hLineWidth: (i: number) => (i === 0 || i === 1 ? 1 : 0),
                hLineColor: (i: number) =>
                  i === 0 || i === 1 ? BORDER_COLOR : TABLE_BG,
                vLineWidth: (i: number, node: any) =>
                  i === 0 || i === node.table.widths?.length ? 1 : 0,
                vLineColor: () => BORDER_COLOR,
                fillColor: (rowIndex: number) =>
                  rowIndex === 0 ? TABLE_BG : "#f7f6f4",
                paddingLeft: () => 6,
                paddingRight: () => 6,
                paddingTop: () => 2,
                paddingBottom: () => 2,
                margin: [0, 0, 0, -5],
              } as any,
            },
          ]
        : []),

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

      // FOOTER TEXT
      {
        columns: [
          {
            width: "*",
            text: [
              { text: "¡Gracias por su compra!", bold: true },
              " Para consultas,\n contáctenos.",
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
    },
  };
};

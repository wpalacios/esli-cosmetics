import type {
  TDocumentDefinitions,
  TableCell,
  Content,
} from "pdfmake/interfaces";
import { formatDateLocal } from "src/common/date-range/date-range.util";
import type { StockMovementReportData } from "src/modules/reports/types/stock-movements-types";

// colors and dimensions
const TABLE_BG = "#ececec";
const BORDER_COLOR = "#000000";
const TEXT_COLOR = "#222222";
const TEXT_COLOR_SECONDARY = "#555555";
const TEXT_COLOR_TABLE_BOLD = "#373735";
const PAGE_MARGINS: [number, number, number, number] = [30, 40, 30, 30];
const CONTENT_WIDTH = 552;

// fonts
const FONT_BOOK = "GothamRoundedBook";
const FONT_BOLD = "GothamRoundedBold";

// size adjustments
const FONT_SIZE_NORMAL = 8;
const FONT_SIZE_TOTAL = 9;
const FONT_SIZE_HEADER = 9;

// table widths: Cant | Tipo | Ítem | Desde | Hacia | Creado Por
const MOVEMENT_TABLE_WIDTHS = [26, 50, "*", 72, 72, 80];
const TOTALS_TABLE_WIDTHS = ["*", 90, 90];

export const getStockMovementsPdfDocDefinition = (
  data: StockMovementReportData,
  logoBase64?: string | null
): TDocumentDefinitions => {
  const companyTitle = data.companyName || "ESLI";

  const generatedAt =
    data.generatedAtFormatted ??
    formatDateLocal(
      (data.generatedAt as string | Date | undefined) ?? new Date(),
      data.timeZone
    );

  const cell = (c: TableCell): TableCell => c;

  const MOVEMENT_TYPE_LABELS: Record<string, string> = {
    PURCHASE: "Compra",
    SALE: "Venta",
    POSITIVE_ADJUSTMENT: "Ajuste positivo",
    NEGATIVE_ADJUSTMENT: "Ajuste negativo",
    TRANSFER: "Transferencia",
    DAMAGE: "Daño",
    RETURN: "Devolución",
    ANNULMENT: "Anulación",
    RESTOCK: "Reabastecimiento",
  };

  const normalizeType = (type?: string) => {
    if (!type) return "—";
    return MOVEMENT_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
  };

  const resolveItemTitle = (item: any) => {
    if (item?.productVariant?.product?.name && item?.productVariant?.name) {
      return `${item.productVariant.product.name} - ${item.productVariant.name}`;
    }
    if (item?.product?.name) return item.product.name;
    if (item?.description) return item.description;
    return "—";
  };
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

  const getTableLineSeparator = (widths: Array<string | number>): Content => ({
    table: {
      widths,
      body: [
        [
          {
            text: "\u00A0",
            colSpan: widths.length,
            fillColor: "#ffffff",
            fontSize: FONT_SIZE_NORMAL,
          },
          ...Array(widths.length - 1).fill({}),
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: (i, node) =>
        i === 0 || i === node.table.widths?.length ? 1 : 0,
      vLineColor: (i, node) =>
        i === 0 || i === node.table.widths?.length ? BORDER_COLOR : undefined,
      paddingLeft: () => 6,
      paddingRight: () => 6,
      paddingTop: () => 2,
      paddingBottom: () => 2,
    },
    margin: [0, 0, 0, 0],
  });

  const movementRows: TableCell[][] = (data.items || []).map(
    (item): TableCell[] => [
      cell({
        text: String(item.quantity ?? 0),
        style: "tableCellBold",
        alignment: "center",
        fillColor: TABLE_BG,
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      }),
      cell({
        text: normalizeType(String(item.type || "")),
        style: "tableCellBold",
        alignment: "center",
        fillColor: TABLE_BG,
        fontSize: 7.2,
        color: TEXT_COLOR_TABLE_BOLD,
      }),
      cell({
        stack: [
          {
            text: resolveItemTitle(item),
            bold: true,
            fontSize: FONT_SIZE_NORMAL,
            color: TEXT_COLOR_TABLE_BOLD,
          },
          {
            text: `SKU: ${item.sku || "—"}${item.reference ? `  | Ref: ${item.reference}` : ""}`,
            fontSize: 7,
            color: TEXT_COLOR_SECONDARY,
            margin: [0, 0, 0, 0],
          },
          {
            text: `Fecha: ${formatDateLocal(item.date, data.timeZone)}`,
            fontSize: 7,
            color: TEXT_COLOR_SECONDARY,
          },
        ],
        style: "tableCell",
        alignment: "left",
        fillColor: TABLE_BG,
      }),
      cell({
        text: item.fromLocation || "—",
        style: "tableCell",
        alignment: "left",
        fillColor: TABLE_BG,
        fontSize: 7.4,
      }),
      cell({
        text: item.toLocation || "—",
        style: "tableCell",
        alignment: "left",
        fillColor: TABLE_BG,
        fontSize: 7.4,
      }),
      cell({
        text: item.createdBy || "—",
        style: "tableCell",
        alignment: "right",
        fillColor: TABLE_BG,
        fontSize: 7.2,
      }),
    ]
  );

  const totalsRows: TableCell[][] = [
    [
      {
        text: "Total Items",
        style: "finalTotalLabel",
        colSpan: 2,
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
      { text: "" },
      {
        text: String(data.totalItems || 0),
        style: "finalTotalValue",
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
    ],
    [
      {
        text: "Cantidad Total de Movimientos",
        style: "finalTotalLabel",
        colSpan: 2,
        font: FONT_BOLD,
        color: TEXT_COLOR_TABLE_BOLD,
      },
      { text: "" },
      {
        text: String(data.totalQuantity || 0),
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

  return {
    pageSize: "LETTER",
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
          {
            width: 250,
            margin: [0, 40, 0, 0] as [number, number, number, number],
            stack: [
              {
                canvas: [
                  {
                    type: "rect",
                    x: 0,
                    y: 0,
                    w: 250,
                    h: 50,
                    r: 12,
                    lineWidth: 1,
                    lineColor: BORDER_COLOR,
                  },
                ],
              },
              {
                margin: [14, -44, 12, 0] as [number, number, number, number],
                stack: [
                  {
                    text: "Reporte de\nMovimientos de Stock",
                    font: FONT_BOLD,
                    fontSize: 17,
                    alignment: "left",
                    lineHeight: 1.05,
                    color: TEXT_COLOR_TABLE_BOLD,
                  },
                ],
              },
            ],
          },
        ],
        margin: [0, 0, 0, 25] as [number, number, number, number],
      },

      getSpacerTable(),

      // Rounded Top Header for movement table
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

      // TABLE 1: MOVEMENTS
      {
        table: {
          headerRows: 1,
          widths: MOVEMENT_TABLE_WIDTHS,
          body: [
            [
              { text: "Cant.", style: "tableHeader", alignment: "center" },
              { text: "Tipo", style: "tableHeader", alignment: "center" },
              { text: "Item", style: "tableHeader", alignment: "left" },
              { text: "Desde", style: "tableHeader", alignment: "left" },
              { text: "Hacia", style: "tableHeader", alignment: "left" },
              { text: "Creado Por", style: "tableHeader", alignment: "right" },
            ].map(
              h =>
                ({
                  ...h,
                  font: FONT_BOLD,
                  fontSize: FONT_SIZE_HEADER,
                  color: TEXT_COLOR_TABLE_BOLD,
                }) as TableCell
            ),
            ...movementRows,
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

      getTableLineSeparator(TOTALS_TABLE_WIDTHS),

      // TABLE 2: TOTALS
      {
        table: {
          widths: TOTALS_TABLE_WIDTHS,
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

      // Rounded Bottom Footer
      {
        canvas: [
          {
            type: "rect",
            x: 0.5,
            y: 0,
            w: CONTENT_WIDTH - 1,
            h: 12,
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
            width: "auto",
            text: [
              { text: "Reporte generado: ", bold: true },
              `${generatedAt} `,
            ],
            alignment: "right",
            fontSize: 9,
            color: "#373735",
          },
        ],
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
};

import { Injectable } from "@nestjs/common";
import type {
  Content,
  TDocumentDefinitions,
  TableCell,
} from "pdfmake/interfaces";
import { formatDateLocal } from "src/common/date-range/date-range.util";
import { formatUSDLocal } from "src/common/money-format/money.utils";
import type { SupplierOrderPdfData } from "src/modules/reports/types/supplier-order-types";

@Injectable()
export class SupplierOrderPdfService {
  private readonly TABLE_BG = "#ececec";
  private readonly BORDER_COLOR = "#000000";
  private readonly TEXT_COLOR = "#222222";
  private readonly PAGE_MARGINS: [number, number, number, number] = [
    30, 40, 30, 30,
  ];
  private readonly CONTENT_WIDTH = 552;
  private readonly FONT_SIZE_NORMAL = 9;
  private readonly FONT_SIZE_TOTAL = 12;
  private readonly FONT_SIZE_HEADER = 12;
  private readonly ROW_PADDING = 4;

  generatePdfDefinition(
    data: SupplierOrderPdfData,
    logoBase64?: string | null
  ): TDocumentDefinitions {
    const formatCurrency = (val: number) => formatUSDLocal(val);

    const companyTitle = data.companyName || "ESLI";

    const createCell = (
      content: any,
      style: string,
      alignment: string = "left"
    ): TableCell =>
      ({
        text: content,
        style,
        alignment,
        fillColor:
          style.includes("Bold") || style === "tableCell"
            ? this.TABLE_BG
            : undefined,
        font: style.includes("Bold")
          ? "GothamRoundedBold"
          : "GothamRoundedBook",
        color: style.includes("Bold") ? "#373735" : undefined,
      }) as TableCell;

    // --- Products Rows ---
    const productRows: TableCell[][] = (data.items || []).map(item => [
      createCell(
        [
          { text: item.productName, bold: true },
          item.variantName ? `\nVariante: ${item.variantName}` : "",
          item.sku ? `\nSKU: ${item.sku}` : "",
        ].filter(Boolean),
        "tableCell"
      ),
      createCell(item.quantity.toString(), "tableCellBold", "center"),
      createCell(formatCurrency(item.unitCost), "tableCell", "center"),
      createCell(formatCurrency(item.totalCost), "tableCellBold", "right"),
    ]);

    // --- Totals Row ---
    const totalsRows: TableCell[][] = [
      [
        {
          text: "Total Orden",
          style: "finalTotalLabel",
          colSpan: 3,
          font: "GothamRoundedBold",
          color: "#373735",
        },
        { text: "" },
        { text: "" },
        {
          text: formatCurrency(data.totalAmount),
          style: "finalTotalValue",
          font: "GothamRoundedBold",
          color: "#373735",
        },
      ],
    ];

    // --- Header Logo ---
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
            color: "#373735",
          },
        ];

    // --- Spacer Table ---
    const getSpacerTable = (): Content => ({
      table: {
        widths: ["*", 70, 80],
        body: [
          [
            {
              text: "\u00A0",
              colSpan: 3,
              border: [true, false, true, true],
              borderColor: ["#0000", "#0000", "#0000", "#0000"],
              fillColor: "#ffffff",
              fontSize: this.FONT_SIZE_NORMAL,
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
        paddingTop: () => this.ROW_PADDING,
        paddingBottom: () => this.ROW_PADDING,
        paddingLeft: () => 8,
        paddingRight: () => 8,
      },
      margin: [0, 0, 0, 0],
    });

    return {
      pageSize: "LETTER",
      pageMargins: this.PAGE_MARGINS,
      defaultStyle: {
        font: "GothamRoundedBook",
        fontSize: this.FONT_SIZE_NORMAL,
        color: this.TEXT_COLOR,
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
                      type: "rect",
                      x: 0,
                      y: 40,
                      w: 230,
                      h: 55,
                      r: 14,
                      lineWidth: 1,
                      lineColor: this.BORDER_COLOR,
                    },
                  ],
                },
                {
                  margin: [15, -40, 7, 0],
                  stack: [
                    {
                      text: "Orden de Compra",
                      font: "GothamRoundedBold",
                      fontSize: 22,
                      bold: true,
                      alignment: "right",
                      margin: [-50, 0, 0, -8],
                      color: "#373735",
                    },
                  ],
                },
              ],
            },
          ],
          margin: [0, 0, 0, 25],
        },

        { text: "", margin: [0, 2.5, 0, 2.5] },

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
                  h: 105,
                  r: 10,
                  lineWidth: 1,
                  lineColor: this.BORDER_COLOR,
                },
              ],
            },
            {
              margin: [7.5, -98, 30, 25],
              table: {
                widths: ["45%", "59%"],
                body: [
                  [
                    {
                      text: "Proveedor",
                      style: "infoValueBold",
                      fontSize: this.FONT_SIZE_HEADER,
                      alignment: "left",
                      font: "GothamRoundedBold",
                      color: "#373735",
                    },
                    {
                      text: data.supplierName || "Proveedor General",
                      style: "infoValueBold",
                      fontSize: this.FONT_SIZE_HEADER,
                      alignment: "right",
                      font: "GothamRoundedBold",
                      color: "#373735",
                    },
                  ],
                  [
                    { text: "Contacto", style: "infoLabel", color: "#373735" },
                    {
                      text: data.supplierContact || "-",
                      style: "infoValue",
                      color: "#373735",
                    },
                  ],
                  [
                    { text: "ID Orden", style: "infoLabel", color: "#373735" },
                    {
                      text: data.orderNumber,
                      style: "infoValueBold",
                      color: "#373735",
                    },
                  ],
                  [
                    {
                      text: "Fecha Creación",
                      style: "infoLabel",
                      color: "#373735",
                    },
                    {
                      text: data.date
                        ? formatDateLocal(data.date)
                            .split(" ")[0]
                            .replace(/,$/, "")
                        : "",
                      style: "infoValue",
                      color: "#373735",
                    },
                  ],
                  [
                    {
                      text: "Fecha Esperada",
                      style: "infoLabel",
                      color: "#373735",
                    },
                    {
                      text: data.expectedDate
                        ? formatDateLocal(data.expectedDate)
                            .split(" ")[0]
                            .replace(/,$/, "")
                        : "Pendiente",
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

        { text: "", margin: [0, -2, 0, -2] },

        // Table header (Rounded Top)
        {
          canvas: [
            {
              type: "rect",
              x: 0.5,
              y: 0,
              w: this.CONTENT_WIDTH - 1,
              h: 15,
              r: 14,
              lineColor: this.BORDER_COLOR,
              color: this.TABLE_BG,
            },
            {
              type: "rect",
              x: 0.8,
              y: 10,
              w: this.CONTENT_WIDTH - 1.6,
              h: 9,
              color: this.TABLE_BG,
              lineColor: this.TABLE_BG,
              lineWidth: 0,
            },
          ],
          margin: [0, 0, 0, -10],
        },

        // TABLE: PRODUCTS
        {
          table: {
            headerRows: 1,
            widths: ["*", 58, 80, 80],
            body: [
              [
                {
                  text: "Producto",
                  style: "tableHeader",
                  alignment: "left",
                  fontSize: this.FONT_SIZE_HEADER,
                  font: "GothamRoundedBold",
                  color: "#373735",
                },
                {
                  text: "Cantidad",
                  style: "tableHeader",
                  alignment: "center",
                  fontSize: this.FONT_SIZE_HEADER,
                  font: "GothamRoundedBold",
                  color: "#373735",
                },
                {
                  text: "Costo Unit.",
                  style: "tableHeader",
                  alignment: "center",
                  fontSize: this.FONT_SIZE_HEADER,
                  font: "GothamRoundedBold",
                  color: "#373735",
                },
                {
                  text: "Total",
                  style: "tableHeader",
                  alignment: "right",
                  fontSize: this.FONT_SIZE_HEADER,
                  font: "GothamRoundedBold",
                  color: "#373735",
                },
              ],
              ...productRows,
            ],
          },
          layout: {
            hLineWidth: (i, node) =>
              i === 1
                ? 1
                : i === 0
                  ? 0
                  : i === node.table.body.length
                    ? 1
                    : 0.5,
            vLineWidth: (i, node) =>
              i === 0 || i === node.table.widths?.length ? 1 : 0,
            hLineColor: (i, node) =>
              i === node.table.body.length
                ? this.BORDER_COLOR
                : i === 1
                  ? this.BORDER_COLOR
                  : this.TABLE_BG,
            vLineColor: () => this.BORDER_COLOR,
            fillColor: () => this.TABLE_BG,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: i => (i === 0 ? 0 : this.ROW_PADDING),
            paddingBottom: i => (i === 0 ? 0 : this.ROW_PADDING),
          },
        },

        getSpacerTable(),

        // TABLE: TOTALS
        {
          table: { widths: ["*", 80, 80, 80], body: totalsRows },
          layout: {
            hLineWidth: (i, node) => {
              const last = node.table.body.length;
              return i === last - 1 || i === last ? 1 : 0;
            },
            hLineColor: () => this.BORDER_COLOR,
            vLineWidth: (i, node) =>
              i === 0 || i === node.table.widths?.length ? 1 : 0,
            vLineColor: () => this.BORDER_COLOR,
            fillColor: () => this.TABLE_BG,
            paddingLeft: () => 8,
            paddingRight: () => 8,
            paddingTop: () => 1,
            paddingBottom: () => 1,
          },
        },

        // FOOTER (Rounded Bottom)
        {
          canvas: [
            {
              type: "rect",
              x: 0.5,
              y: 0,
              w: this.CONTENT_WIDTH - 1,
              h: 6,
              r: 100,
              lineWidth: 0,
              lineColor: this.BORDER_COLOR,
              color: this.TABLE_BG,
            },
            {
              type: "rect",
              x: 1.65,
              y: -1,
              w: this.CONTENT_WIDTH - 3.25,
              h: 2,
              r: 100,
              lineWidth: 0,
              color: this.TABLE_BG,
              lineColor: this.TABLE_BG,
            },
          ],
          margin: [0, -1, 0, 10],
        },

        // FOOTER TEXT
        {
          columns: [
            {
              width: "*",
              text: [{ text: "Para consultas, ", bold: true }, "contáctenos."],
              alignment: "left",
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
      styles: {
        infoLabel: { fontSize: this.FONT_SIZE_NORMAL, color: "#222" },
        infoValue: {
          fontSize: this.FONT_SIZE_NORMAL,
          color: "#222",
          alignment: "right",
        },
        infoValueBold: {
          fontSize: this.FONT_SIZE_NORMAL,
          bold: true,
          color: "#000",
          alignment: "right",
        },
        tableHeader: {
          bold: true,
          fontSize: this.FONT_SIZE_NORMAL,
          color: "#000",
          margin: [0, 2, 0, 2],
        },
        tableCell: {
          fontSize: this.FONT_SIZE_NORMAL,
          color: "#333",
          margin: [0, 2, 0, 2],
        },
        tableCellBold: {
          fontSize: this.FONT_SIZE_NORMAL,
          bold: true,
          color: "#000",
          margin: [0, 2, 0, 2],
        },
        finalTotalLabel: {
          fontSize: this.FONT_SIZE_TOTAL,
          bold: true,
          color: "#000",
          alignment: "left",
          margin: [0, 2, 0, 2],
        },
        finalTotalValue: {
          fontSize: this.FONT_SIZE_TOTAL,
          bold: true,
          color: "#000",
          alignment: "right",
          margin: [0, 5, 0, 2],
        },
      },
    };
  }
}

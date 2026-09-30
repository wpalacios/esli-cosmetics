/**
 * Genera PDF del reporte operativo de estado de cuenta (cliente específico).
 *
 * Uso:
 *   pnpm exec tsx scripts/generate-customer-operational-report-pdf.ts
 *   CUSTOMER_ID=<uuid> OUTPUT=/path/to/file.pdf pnpm exec tsx scripts/generate-customer-operational-report-pdf.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";
import PdfPrinter from "pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";

const CUSTOMER_ID =
  process.env.CUSTOMER_ID ?? "2060f3e7-8e8b-48e6-b390-73a44224126e";

const DEFAULT_OUTPUT = path.join(
  process.cwd(),
  "..",
  "..",
  "docs",
  "reports",
  "reporte-operativo-estado-cuenta-EDITH-MAGALY-CASTILLO.pdf"
);

const OUTPUT_PATH = process.env.OUTPUT
  ? path.resolve(process.env.OUTPUT)
  : path.resolve(DEFAULT_OUTPUT);

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const printer = new PdfPrinter(fonts);

function fmt(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return (
    sign +
    "C$" +
    abs.toLocaleString("es-NI", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function cell(
  text: string,
  opts: {
    bold?: boolean;
    fillColor?: string;
    alignment?: "left" | "right" | "center";
  } = {}
) {
  return {
    text,
    bold: opts.bold,
    fillColor: opts.fillColor,
    alignment: opts.alignment ?? "left",
    fontSize: 8,
    margin: [2, 3, 2, 3] as [number, number, number, number],
  };
}

function buildDocument(): TDocumentDefinitions {
  const generatedAt = new Date().toLocaleString("es-NI", {
    dateStyle: "long",
    timeStyle: "short",
  });

  const summaryTable = {
    table: {
      widths: ["*", "*"],
      body: [
        [
          cell("Concepto", { bold: true, fillColor: "#f5b1cc" }),
          cell("Monto", {
            bold: true,
            fillColor: "#f5b1cc",
            alignment: "right",
          }),
        ],
        [
          cell("Saldo inicial (migración)"),
          cell(fmt(0), { alignment: "right" }),
        ],
        [
          cell("Total de cargos (ventas a crédito en el período)"),
          cell(fmt(75720.3), { alignment: "right" }),
        ],
        [
          cell("Total de pagos registrados"),
          cell(fmt(84000.14), { alignment: "right" }),
        ],
        [
          cell("Saldo final (libro mayor)", { bold: true }),
          cell(fmt(-8279.84), { bold: true, alignment: "right" }),
        ],
        [
          cell("Monto pendiente por cobrar (pedidos activos)", { bold: true }),
          cell(fmt(20640.23), { bold: true, alignment: "right" }),
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cccccc",
      vLineColor: () => "#cccccc",
    },
    margin: [0, 0, 0, 12] as [number, number, number, number],
  };

  const transactionsTable = {
    table: {
      headerRows: 1,
      widths: [32, 48, 52, "*", 58, 58, 62],
      body: [
        [
          cell("#", { bold: true, fillColor: "#ececec", alignment: "center" }),
          cell("Fecha", { bold: true, fillColor: "#ececec" }),
          cell("Tipo", { bold: true, fillColor: "#ececec" }),
          cell("Descripción / Referencia", {
            bold: true,
            fillColor: "#ececec",
          }),
          cell("Débito", {
            bold: true,
            fillColor: "#ececec",
            alignment: "right",
          }),
          cell("Crédito", {
            bold: true,
            fillColor: "#ececec",
            alignment: "right",
          }),
          cell("Saldo", {
            bold: true,
            fillColor: "#ececec",
            alignment: "right",
          }),
        ],
        [
          "1",
          "30/12/2025",
          "Saldo inicial",
          "Saldo inicial (migración) — MIGRACIÓN",
          "—",
          "—",
          fmt(0),
        ].map((t, i) => cell(t, { alignment: i >= 4 ? "right" : "left" })),
        [
          "2",
          "17/03/2026",
          "Pedido",
          "Orden de crédito — ESL-000000010183",
          fmt(26160),
          "—",
          fmt(26160),
        ].map((t, i) => cell(t, { alignment: i >= 4 ? "right" : "left" })),
        [
          "3",
          "15/04/2026",
          "Pago",
          "Pago cuota #1 — ESL-000000010183 (registro global C$55,080.07)",
          "—",
          fmt(55080.07),
          fmt(-28920.07),
        ].map((t, i) => cell(t, { alignment: i >= 4 ? "right" : "left" })),
        [
          "4",
          "15/04/2026",
          "Pedido",
          "Orden de crédito — ESL-000000014419",
          fmt(28920.07),
          "—",
          fmt(0),
        ].map((t, i) => cell(t, { alignment: i >= 4 ? "right" : "left" })),
        [
          "5",
          "06/05/2026",
          "Pago",
          "Pago cuota #1 — ESL-000000014419",
          "—",
          fmt(28920.07),
          fmt(-28920.07),
        ].map((t, i) => cell(t, { alignment: i >= 4 ? "right" : "left" })),
        [
          "6",
          "09/05/2026",
          "Pedido",
          "Orden de crédito — ESL-000000018302",
          fmt(20640.23),
          "—",
          fmt(-8279.84),
        ].map((t, i) => cell(t, { alignment: i >= 4 ? "right" : "left" })),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cccccc",
      vLineColor: () => "#cccccc",
    },
    margin: [0, 0, 0, 12] as [number, number, number, number],
  };

  const paymentBreakdown = {
    table: {
      widths: [70, "*", 80],
      body: [
        [
          cell("Fecha", { bold: true, fillColor: "#ececec" }),
          cell("Detalle", { bold: true, fillColor: "#ececec" }),
          cell("Monto", {
            bold: true,
            fillColor: "#ececec",
            alignment: "right",
          }),
        ],
        [
          cell("15/04/2026"),
          cell(
            "Pago global C$55,080.07 — registrado por Maite Díaz\n• C$26,160.00 → pedido ESL-000000010183\n• C$28,920.07 → pedido ESL-000000013746"
          ),
          cell(fmt(55080.07), { alignment: "right" }),
        ],
        [
          cell("06/05/2026"),
          cell(
            "Pago cuota #1 pedido ESL-000000014419 — registrado por Maite Díaz"
          ),
          cell(fmt(28920.07), { alignment: "right" }),
        ],
        [
          cell("", { bold: true }),
          cell("Total cobrado y registrado", { bold: true }),
          cell(fmt(84000.14), { bold: true, alignment: "right" }),
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cccccc",
      vLineColor: () => "#cccccc",
    },
    margin: [0, 0, 0, 12] as [number, number, number, number],
  };

  const ordersTable = {
    table: {
      widths: [95, 55, 65, 75, 75],
      body: [
        [
          cell("Pedido", { bold: true, fillColor: "#ececec" }),
          cell("Fecha venta", { bold: true, fillColor: "#ececec" }),
          cell("Monto", {
            bold: true,
            fillColor: "#ececec",
            alignment: "right",
          }),
          cell("Estado", { bold: true, fillColor: "#ececec" }),
          cell("Saldo por cobrar", {
            bold: true,
            fillColor: "#ececec",
            alignment: "right",
          }),
        ],
        [
          cell("ESL-000000010183"),
          cell("17/03/2026"),
          cell(fmt(26160), { alignment: "right" }),
          cell("Completado"),
          cell("No", { alignment: "right" }),
        ],
        [
          cell("ESL-000000013746"),
          cell("10/04/2026"),
          cell(fmt(28920.07), { alignment: "right" }),
          cell("Anulado"),
          cell("No", { alignment: "right" }),
        ],
        [
          cell("ESL-000000014419"),
          cell("15/04/2026"),
          cell(fmt(28920.07), { alignment: "right" }),
          cell("Completado"),
          cell("No", { alignment: "right" }),
        ],
        [
          cell("ESL-000000018302"),
          cell("09/05/2026"),
          cell(fmt(20640.23), { alignment: "right" }),
          cell("Aprobado (activo)"),
          cell(fmt(20640.23), { bold: true, alignment: "right" }),
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cccccc",
      vLineColor: () => "#cccccc",
    },
    margin: [0, 0, 0, 12] as [number, number, number, number],
  };

  const actionsTable = {
    table: {
      widths: [45, "*"],
      body: [
        [
          cell("Prioridad", { bold: true, fillColor: "#ececec" }),
          cell("Acción recomendada", { bold: true, fillColor: "#ececec" }),
        ],
        [
          cell("Alta"),
          cell(
            "Confirmar con caja/banco si hubo dos ingresos de C$28,920.07 (15/04 y 06/05) o solo uno."
          ),
        ],
        [
          cell("Alta"),
          cell(
            "Revisar comprobante del pago C$55,080.07 del 15/04/2026: monto recibido vs. monto digitado."
          ),
        ],
        [
          cell("Media"),
          cell(
            "Definir cobro del pedido ESL-000000018302 (C$20,640.23): aplicar saldo a favor, cobrar total o combinar."
          ),
        ],
        [
          cell("Media"),
          cell(
            "Si el pago del 06/05 fue duplicado, evaluar reversión y/o devolución de C$8,279.84 al cliente."
          ),
        ],
        [
          cell("Baja"),
          cell(
            "Documentar en expediente la anulación del pedido ESL-000000013746 y su relación con ESL-000000014419."
          ),
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#cccccc",
      vLineColor: () => "#cccccc",
    },
  };

  const content: Content[] = [
    {
      text: "ESLI Cosmetics",
      fontSize: 14,
      bold: true,
      color: "#ff48b0",
      margin: [0, 0, 0, 4] as [number, number, number, number],
    },
    {
      text: "Reporte operativo — Estado de cuenta",
      fontSize: 12,
      bold: true,
      margin: [0, 0, 0, 10] as [number, number, number, number],
    },
    {
      columns: [
        {
          width: "*",
          stack: [
            {
              text: "Cliente: EDITH MAGALY CASTILLO (JINOTEPE)",
              fontSize: 9,
              bold: true,
            },
            {
              text: `Identificador: ${CUSTOMER_ID}`,
              fontSize: 8,
              color: "#555555",
            },
            {
              text: "Período del estado de cuenta: 31/12/2025 al 02/06/2026",
              fontSize: 8,
            },
            { text: "Límite de crédito: C$300,000.00", fontSize: 8 },
          ],
        },
        {
          width: 140,
          stack: [
            {
              text: "Generado:",
              fontSize: 7,
              color: "#555555",
              alignment: "right",
            },
            { text: generatedAt, fontSize: 8, alignment: "right" },
          ],
        },
      ],
      margin: [0, 0, 0, 14] as [number, number, number, number],
    },
    {
      text: "1. Resumen ejecutivo",
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 6] as [number, number, number, number],
    },
    summaryTable,
    {
      text:
        "El cliente muestra saldo a favor en el libro mayor y deuda pendiente en el pedido ESL-000000018302. " +
        "La causa operativa principal: pago global del 15/04/2026 (C$55,080.07), anulación del pedido ESL-000000013746 con abono previo, " +
        "pedido sustituto ESL-000000014419 por el mismo monto y segundo pago el 06/05/2026.",
      fontSize: 8,
      margin: [0, 0, 0, 14] as [number, number, number, number],
    },
    {
      text: "2. Detalle de transacciones (estado de cuenta)",
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 6] as [number, number, number, number],
    },
    transactionsTable,
    {
      text: "3. Desglose de pagos registrados",
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 6] as [number, number, number, number],
    },
    paymentBreakdown,
    {
      text: "4. Pedidos a crédito — situación actual",
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 6] as [number, number, number, number],
    },
    ordersTable,
    {
      text: "5. Cronología operativa (acciones en el sistema)",
      fontSize: 10,
      bold: true,
      margin: [0, 12, 0, 6] as [number, number, number, number],
    },
    {
      ul: [
        "17/03/2026 — Venta a crédito ESL-000000010183 por C$26,160.00 (hoy completada).",
        "10/04/2026 — Venta ESL-000000013746; ajuste de saldo el mismo día; pedido posteriormente anulado (no aparece como cargo en el estado de cuenta).",
        "15/04/2026 15:21 — Maite Díaz registra pago global C$55,080.07 (C$26,160 a 010183 + C$28,920.07 a 013746). Saldo corrido: -C$28,920.07.",
        "15/04/2026 15:50 — Nueva venta ESL-000000014419 por C$28,920.07 (~29 min después del pago). Saldo corrido: C$0.00.",
        "06/05/2026 — Maite Díaz registra pago C$28,920.07 sobre ESL-000000014419 (segundo cobro del mismo monto comercial). Saldo: -C$28,920.07.",
        "09/05/2026 — Venta ESL-000000018302 por C$20,640.23 sin abono. Saldo final: -C$8,279.84; pendiente: C$20,640.23.",
      ],
      fontSize: 8,
      margin: [0, 0, 0, 12] as [number, number, number, number],
    },
    {
      text: "6. Interpretación para cobranza",
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 6] as [number, number, number, number],
    },
    {
      text:
        "• El estado de cuenta cuadra aritméticamente.\n" +
        "• Saldo a favor C$8,279.84 = doble registro de C$28,920.07 menos pedido 018302 sin cobrar (28,920.07 − 20,640.23).\n" +
        "• Riesgo: posible doble cobro del tramo C$28,920.07; validar con comprobantes físicos/bancarios.\n" +
        "• El pedido activo 018302 no tiene pagos aplicados pese al saldo a favor visible.",
      fontSize: 8,
      margin: [0, 0, 0, 12] as [number, number, number, number],
    },
    {
      text: "7. Acciones recomendadas",
      fontSize: 10,
      bold: true,
      margin: [0, 0, 0, 6] as [number, number, number, number],
    },
    actionsTable,
    {
      text: "8. Conclusión",
      fontSize: 10,
      bold: true,
      margin: [0, 12, 0, 6] as [number, number, number, number],
    },
    {
      text:
        "El estado de cuenta refleja operaciones registradas por Maite Díaz (15/04 y 06/05/2026). " +
        "La aparente inconsistencia entre crédito a favor y pendiente se explica por la secuencia operativa descrita. " +
        "Se requiere revisión de caja, comprobantes y decisión de cobro sobre ESL-000000018302.",
      fontSize: 8,
    },
  ];

  return {
    pageSize: "LETTER",
    pageMargins: [40, 50, 40, 50],
    defaultStyle: { font: "Helvetica", fontSize: 9 },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Página ${currentPage} de ${pageCount}`,
      alignment: "center",
      fontSize: 7,
      color: "#888888",
      margin: [0, 10, 0, 0] as [number, number, number, number],
    }),
    content,
  };
}

async function main() {
  const doc = buildDocument();
  const pdfDoc = printer.createPdfKitDocument(doc);
  const dir = path.dirname(OUTPUT_PATH);
  fs.mkdirSync(dir, { recursive: true });

  const stream = fs.createWriteStream(OUTPUT_PATH);
  pdfDoc.pipe(stream);
  pdfDoc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
    pdfDoc.on("error", reject);
  });

  console.log("PDF generado:", OUTPUT_PATH);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

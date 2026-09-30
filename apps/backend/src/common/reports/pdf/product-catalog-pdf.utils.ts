import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { formatMoney } from "src/common/money-format/money.utils";

/** A4 width minus typical margins — used for layout math */
const PAGE_W = 515;
const PRIMARY = "#ff48b0";
const PRIMARY_SOFT = "#fce7f3";
const ACCENT = "#f5b1cc";
const TEXT = "#1f2937";
const TEXT_MUTED = "#6b7280";

export type ProductCatalogPdfVariant = {
  name: string | null;
  sku?: string | null;
  /** Highest configured price across price lists (negotiation ceiling for sellers) */
  maxPrice: number | null;
};

export type ProductCatalogPdfItem = {
  name: string;
  sku?: string | null;
  brandName: string;
  categoryName: string;
  description: string | null;
  type: "STANDARD" | "KIT";
  variants: ProductCatalogPdfVariant[];
  kitLines?: { name: string; quantity: number }[];
};

function stripHtml(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decorativeCanvasBackground(yOffset = 0): Content {
  return {
    canvas: [
      {
        type: "ellipse",
        x: 420,
        y: 60 + yOffset,
        r1: 140,
        r2: 110,
        color: PRIMARY_SOFT,
      },
      {
        type: "ellipse",
        x: -30,
        y: 320 + yOffset,
        r1: 100,
        r2: 80,
        color: PRIMARY_SOFT,
      },
      {
        type: "rect",
        x: 0,
        y: 0,
        w: PAGE_W + 80,
        h: 8,
        color: PRIMARY_SOFT,
      },
    ],
    absolutePosition: { x: 0, y: 0 },
  };
}

function coverPage(
  logoBase64: string | null,
  title: string,
  subtitle: string
): Content {
  const logoBlock: Content = logoBase64
    ? {
        image: logoBase64,
        width: 110,
        alignment: "center",
        margin: [0, 0, 0, 24],
      }
    : {
        text: "ESLI",
        fontSize: 36,
        bold: true,
        color: PRIMARY,
        alignment: "center",
        margin: [0, 0, 0, 24],
      };

  return {
    stack: [
      decorativeCanvasBackground(0),
      {
        margin: [40, 72, 40, 0],
        stack: [
          logoBlock,
          {
            text: title,
            fontSize: 26,
            bold: true,
            color: PRIMARY,
            alignment: "center",
            margin: [0, 0, 0, 8],
          },
          {
            text: subtitle,
            fontSize: 11,
            color: TEXT_MUTED,
            alignment: "center",
            margin: [0, 0, 0, 6],
          },
          {
            text: "Cosméticos al por mayor · Nicaragua",
            fontSize: 10,
            italics: true,
            color: TEXT_MUTED,
            alignment: "center",
          },
        ],
      },
    ],
    pageBreak: "after" as const,
  };
}

function brandDividerPage(
  brandName: string,
  usePageBreakBefore: boolean
): Content {
  const stack: Content[] = [decorativeCanvasBackground(0)];
  if (usePageBreakBefore) {
    stack.unshift({ text: "", pageBreak: "before" });
  }
  stack.push({
    margin: [40, 220, 40, 0],
    stack: [
      {
        text: "MARCA",
        fontSize: 10,
        letterSpacing: 4,
        color: PRIMARY,
        alignment: "center",
        margin: [0, 0, 0, 12],
      } as Content,
      {
        text: brandName,
        fontSize: 32,
        bold: true,
        color: TEXT,
        alignment: "center",
      },
      {
        canvas: [
          {
            type: "line",
            x1: PAGE_W / 2 - 80,
            y1: 0,
            x2: PAGE_W / 2 + 80,
            y2: 0,
            lineWidth: 2,
            lineColor: PRIMARY,
          },
        ],
        margin: [0, 24, 0, 0],
      },
    ],
  });
  return { stack, pageBreak: "after" as const };
}

function categoryDividerPage(
  categoryName: string,
  brandName: string,
  pageBreakBefore: boolean
): Content {
  const stack: Content[] = [decorativeCanvasBackground(-40)];
  if (pageBreakBefore) {
    stack.unshift({ text: "", pageBreak: "before" });
  }
  stack.push({
    margin: [40, 200, 40, 0],
    stack: [
      {
        text: brandName.toUpperCase(),
        fontSize: 9,
        letterSpacing: 2,
        color: TEXT_MUTED,
        alignment: "center",
        margin: [0, 0, 0, 16],
      } as Content,
      {
        text: "CATEGORÍA",
        fontSize: 10,
        letterSpacing: 4,
        color: PRIMARY,
        alignment: "center",
        margin: [0, 0, 0, 12],
      } as Content,
      {
        text: categoryName,
        fontSize: 28,
        bold: true,
        color: TEXT,
        alignment: "center",
      },
      {
        canvas: [
          {
            type: "line",
            x1: PAGE_W / 2 - 70,
            y1: 0,
            x2: PAGE_W / 2 + 70,
            y2: 0,
            lineWidth: 1.5,
            lineColor: ACCENT,
          },
        ],
        margin: [0, 20, 0, 0],
      },
    ],
  });
  return { stack, pageBreak: "after" as const };
}

function productCard(p: ProductCatalogPdfItem): Content {
  const desc = stripHtml(p.description);
  const variantRows: Content[] = [];
  if (p.type === "KIT" && p.kitLines?.length) {
    for (const line of p.kitLines) {
      variantRows.push({
        text: `• ${line.name}  ×${line.quantity}`,
        fontSize: 8,
        color: TEXT_MUTED,
        margin: [0, 1, 0, 0],
      });
    }
  } else {
    for (const v of p.variants) {
      const priceText =
        v.maxPrice != null && !Number.isNaN(v.maxPrice)
          ? formatMoney(v.maxPrice)
          : "—";
      variantRows.push({
        columns: [
          { text: v.name || "—", width: "*", fontSize: 8 },
          {
            text: v.sku ? `SKU ${v.sku}` : "",
            width: "auto",
            fontSize: 7,
            color: TEXT_MUTED,
          },
          {
            text: priceText,
            width: 68,
            alignment: "right",
            fontSize: 8,
            bold: true,
          },
        ],
      });
    }
  }

  const titleBlock: Content =
    p.type === "KIT"
      ? {
          columns: [
            {
              text: p.name,
              bold: true,
              fontSize: 11,
              color: TEXT,
              width: "*",
            },
            {
              text: "KIT",
              fontSize: 7,
              bold: true,
              color: "#fff",
              fillColor: PRIMARY,
              margin: [6, 2, 6, 2],
            },
          ],
        }
      : {
          text: p.name,
          bold: true,
          fontSize: 11,
          color: TEXT,
        };

  const cardStack: Content[] = [titleBlock];
  if (p.sku) {
    cardStack.push({
      text: `SKU: ${p.sku}`,
      fontSize: 8,
      color: TEXT_MUTED,
      margin: [0, 4, 0, 0],
    });
  }
  if (desc) {
    cardStack.push({
      text: desc,
      fontSize: 8,
      color: TEXT_MUTED,
      margin: [0, 6, 0, 0],
    });
  }
  if (variantRows.length > 0) {
    cardStack.push({
      margin: [0, p.type === "KIT" ? 8 : 0, 0, 0],
      stack: variantRows,
    });
  }

  return {
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: cardStack,
            margin: [12, 12, 12, 12],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => ACCENT,
      vLineColor: () => ACCENT,
      fillColor: () => "#ffffff",
    },
    margin: [0, 0, 0, 12],
  };
}

export function getProductCatalogPdfDocDefinition(
  products: ProductCatalogPdfItem[],
  logoBase64: string | null,
  generatedLabel: string
): TDocumentDefinitions {
  const content: Content[] = [];

  content.push(coverPage(logoBase64, "Catálogo de productos", generatedLabel));

  if (!products.length) {
    content.push({
      text: "No hay productos que coincidan con los filtros seleccionados.",
      fontSize: 12,
      alignment: "center",
      margin: [40, 120, 40, 0],
      color: TEXT_MUTED,
    });
    return buildDoc(content);
  }

  let lastBrand = "";
  let lastCategory = "";
  let isFirstBrand = true;
  let isFirstCategoryInBrand = true;

  for (const p of products) {
    if (p.brandName !== lastBrand) {
      content.push(brandDividerPage(p.brandName, !isFirstBrand));
      isFirstBrand = false;
      lastBrand = p.brandName;
      lastCategory = "";
      isFirstCategoryInBrand = true;
    }
    if (p.categoryName !== lastCategory) {
      content.push(
        categoryDividerPage(
          p.categoryName,
          p.brandName,
          !isFirstCategoryInBrand
        )
      );
      lastCategory = p.categoryName;
      isFirstCategoryInBrand = false;
    }
    content.push(productCard(p));
  }

  return buildDoc(content);
}

function buildDoc(content: Content[]): TDocumentDefinitions {
  return {
    pageMargins: [36, 42, 36, 42],
    defaultStyle: {
      font: "Helvetica",
      fontSize: 9,
      color: TEXT,
    },
    content,
    styles: {
      h1: { fontSize: 22, bold: true, color: PRIMARY },
    },
  };
}

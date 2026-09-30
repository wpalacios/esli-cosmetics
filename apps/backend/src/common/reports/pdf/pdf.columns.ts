import type { TFontDictionary } from "pdfmake/interfaces";
import type { Order } from "../../orders/orders.utils";
import { findFont } from "./pdf.utils";

export interface PdfColumn {
  key: string;
  header: string;
  extractor: (r: Order) => string | number | null | undefined;
}

export const pdfFonts: TFontDictionary = {
  GothamRoundedBook: {
    normal: findFont("GothamRnd-Book.ttf", "Helvetica"),
    bold: findFont("GothamRnd-Bold.ttf", "Helvetica"),
    italics: findFont("GothamRnd-BookItalic.ttf", "Helvetica"),
    bolditalics: findFont("GothamRnd-Medium.ttf", "Helvetica"),
  },
  GothamRoundedBold: {
    normal: findFont("GothamRnd-Bold.ttf", "Helvetica"),
    bold: findFont("GothamRnd-Bold.ttf", "Helvetica"),
    italics: findFont("GothamRnd-BookItalic.ttf", "Helvetica"),
    bolditalics: findFont("GothamRnd-Medium.ttf", "Helvetica"),
  },
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

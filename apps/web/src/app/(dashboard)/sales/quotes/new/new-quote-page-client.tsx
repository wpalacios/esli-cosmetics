"use client";

import { useTranslation } from "react-i18next";
import { QuotePage } from "../quote-page-client";

export function NewQuotePageClient() {
  const { t } = useTranslation("quotes");
  return <QuotePage title={t("page.createTitle")} />;
}

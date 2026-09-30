"use client";

import { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n/client";

type I18nProviderProps = {
  children: ReactNode;
  lng?: string;
};

export function I18nProvider({ children, lng = "es" }: I18nProviderProps) {
  // Set the language if provided
  if (lng && i18n.resolvedLanguage !== lng) {
    i18n.changeLanguage(lng);
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

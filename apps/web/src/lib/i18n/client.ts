"use client";

import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import resourcesToBackend from "i18next-resources-to-backend";
import {
  initReactI18next,
  useTranslation as useTranslationOrg,
} from "react-i18next";
import { getOptions, languages, cookieName } from "./settings";

const runsOnServerSide = typeof window === "undefined";

// Initialize i18next for client-side
i18next
  .use(initReactI18next)
  .use(LanguageDetector)
  .use(
    resourcesToBackend(
      (language: string, namespace: string) =>
        import(`./locales/${language}/${namespace}.json`)
    )
  )
  .init({
    ...getOptions(),
    lng: undefined, // let detect the language on client side
    detection: {
      order: ["cookie", "localStorage", "navigator"] as const,
      caches: ["cookie"] as const,
      lookupCookie: cookieName,
    },
    preload: runsOnServerSide ? languages : [],
  } as any);

export default i18next;

export function useTranslation(
  lng: string,
  ns?: string,
  options?: { keyPrefix?: string }
) {
  const ret = useTranslationOrg(ns, options);
  const { i18n } = ret;

  if (runsOnServerSide && lng && i18n.resolvedLanguage !== lng) {
    i18n.changeLanguage(lng);
  } else {
    // client side language detection
    const detectedLng = lng || i18n.resolvedLanguage;
    if (detectedLng && i18n.resolvedLanguage !== detectedLng) {
      i18n.changeLanguage(detectedLng);
    }
  }

  return ret;
}

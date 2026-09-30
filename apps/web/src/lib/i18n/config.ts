import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translation files
import esCommon from "./locales/es/common.json";
import enCommon from "./locales/en/common.json";
import esProducts from "./locales/es/products.json";
import enProducts from "./locales/en/products.json";
import esBrands from "./locales/es/brands.json";
import enBrands from "./locales/en/brands.json";
import esPos from "./locales/es/pos.json";
import enPos from "./locales/en/pos.json";
import esUsers from "./locales/es/users.json";
import enUsers from "./locales/en/users.json";
import esRoles from "./locales/es/roles.json";
import enRoles from "./locales/en/roles.json";
import esPermissions from "./locales/es/permissions.json";
import enPermissions from "./locales/en/permissions.json";
import esCategories from "./locales/es/categories.json";
import enCategories from "./locales/en/categories.json";

const resources = {
  es: {
    common: esCommon,
    products: esProducts,
    brands: esBrands,
    pos: esPos,
    users: esUsers,
    roles: esRoles,
    permissions: esPermissions,
    categories: esCategories,
  },
  en: {
    common: enCommon,
    products: enProducts,
    brands: enBrands,
    pos: enPos,
    users: enUsers,
    roles: enRoles,
    permissions: enPermissions,
    categories: enCategories,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: "common",
    fallbackLng: "es", // Spanish as default
    lng: "es", // Force Spanish as the initial language
    debug: false,
    interpolation: {
      escapeValue: false, // React already does escaping
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },
  });

export default i18n;

// Common constants used throughout the application

// Esli Cosmetics brand colors
export const BRAND_COLORS = {
  primary: "#ff48b0", // Wild Strawberry
  secondary: "#f5b1cc", // Pink Chalk
} as const;

// Common page sizes for pagination
export const PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 25;

// Debounce delays
export const DEBOUNCE_DELAYS = {
  search: 300,
  api: 500,
  resize: 100,
} as const;

// API endpoints base paths
export const API_ENDPOINTS = {
  auth: "/auth",
  users: "/users",
  products: "/products",
  categories: "/categories",
  customers: "/customers",
  orders: "/orders",
  inventory: "/inventory",
  reports: "/reports",
} as const;

// File upload limits
export const FILE_UPLOAD = {
  maxSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp"],
  allowedDocumentTypes: [
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
} as const;

// Validation limits
export const VALIDATION_LIMITS = {
  name: { min: 2, max: 100 },
  description: { max: 1000 },
  email: { max: 254 },
  phone: { min: 10, max: 15 },
  sku: { min: 3, max: 50 },
  barcode: { min: 8, max: 13 },
} as const;

// Currency and locale settings
export const LOCALE_SETTINGS = {
  currency: "NIO",
  locale: "es-NI",
  timezone: "America/Managua",
} as const;

// Currency sign for display (Nicaraguan Cordoba)
export const CURRENCY_SIGN = "C$";

// Tax rate
export const DEFAULT_TAX_RATE = 0.15;

// Regular expressions for validation
export const REGEX_PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^\+?[1-9]\d{1,14}$/,
  sku: /^[A-Z0-9-_]+$/,
  barcode: /^\d{8,13}$/,
  slug: /^[a-z0-9-]+$/,
} as const;

// Date format strings
export const DATE_FORMATS = {
  short: "dd/MM/yyyy",
  medium: "dd MMM yyyy",
  long: "dd MMMM yyyy",
  dateTime: "dd/MM/yyyy HH:mm",
  time: "HH:mm",
} as const;

// Breakpoints (should match Tailwind config)
export const BREAKPOINTS = {
  xs: 475,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

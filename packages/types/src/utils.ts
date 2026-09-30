// Utility types for formatting, validation, and common utilities

// Currency formatting
export type Currency =
  | "USD"
  | "EUR"
  | "GBP"
  | "JPY"
  | "CAD"
  | "AUD"
  | "CHF"
  | "CNY"
  | "SEK"
  | "NOK"
  | "DKK"
  | "PLN"
  | "CZK"
  | "HUF"
  | "RUB"
  | "BRL"
  | "MXN"
  | "INR"
  | "KRW"
  | "SGD"
  | "HKD"
  | "NZD"
  | "ZAR"
  | "TRY"
  | "ILS"
  | "AED"
  | "SAR"
  | "QAR"
  | "KWD"
  | "BHD"
  | "OMR"
  | "JOD"
  | "LBP"
  | "EGP"
  | "MAD"
  | "TND"
  | "DZD"
  | "LYD"
  | "SDG"
  | "ETB"
  | "KES"
  | "UGX"
  | "TZS"
  | "RWF"
  | "BIF"
  | "DJF"
  | "SOS"
  | "ERN"
  | "SLL"
  | "GMD"
  | "GNF"
  | "LRD"
  | "CDF"
  | "AOA"
  | "ZMW"
  | "BWP"
  | "SZL"
  | "LSL"
  | "NAD"
  | "MZN"
  | "MWK"
  | "ZWL"
  | "BND"
  | "KHR"
  | "LAK"
  | "MMK"
  | "THB"
  | "VND"
  | "IDR"
  | "MYR"
  | "PHP"
  | "TWD"
  | "MOP"
  | "PKR"
  | "LKR"
  | "BDT"
  | "NPR"
  | "AFN"
  | "IRR"
  | "IQD"
  | "SYP"
  | "YER"
  | "NIO";

export type CurrencyFormatOptions = {
  currency?: Currency;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  style?: "decimal" | "currency" | "percent";
  notation?: "standard" | "scientific" | "engineering" | "compact";
  signDisplay?: "auto" | "never" | "always" | "exceptZero";
};

// Date formatting
export type DateFormat =
  | "short"
  | "medium"
  | "long"
  | "full"
  | "iso"
  | "relative"
  | "custom"
  | "dateTime"
  | "time";

export type DateFormatOptions = {
  format?: DateFormat;
  locale?: string;
  timeZone?: string;
  customFormat?: string;
  includeTime?: boolean;
  includeSeconds?: boolean;
  includeMilliseconds?: boolean;
};

// Number formatting
export type NumberFormatType =
  | "decimal"
  | "currency"
  | "percent"
  | "percentage"
  | "scientific"
  | "engineering"
  | "compact";

export type NumberFormatOptions = {
  type?: NumberFormatType;
  locale?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  minimumIntegerDigits?: number;
  useGrouping?: boolean;
  notation?: "standard" | "scientific" | "engineering" | "compact";
  signDisplay?: "auto" | "never" | "always" | "exceptZero";
  currency?: Currency;
  currencyDisplay?: "code" | "symbol" | "narrowSymbol" | "name";
};

// Text formatting
export type TextCase =
  | "lowercase"
  | "uppercase"
  | "capitalize"
  | "title"
  | "sentence";

export type TextFormatOptions = {
  case?: TextCase;
  trim?: boolean;
  maxLength?: number;
  ellipsis?: string;
  preserveWhitespace?: boolean;
};

// Validation
export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
};

export type ValidationRule<T = any> = {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: T) => string | undefined;
  message?: string;
};

// Local storage hooks
export type UseLocalStorageReturn<T> = [
  T | undefined,
  (value: T | ((prev: T | undefined) => T)) => void,
  () => void,
];

// Media query hooks
export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

export type MediaQueryOptions = {
  breakpoint?: Breakpoint;
  minWidth?: number;
  maxWidth?: number;
  orientation?: "portrait" | "landscape";
};

// Clipboard hooks
export type ClipboardOptions = {
  timeout?: number;
  onSuccess?: (text: string) => void;
  onError?: (error: Error) => void;
};

// Debounce options
export type DebounceOptions = {
  delay?: number;
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
};

// Toggle options
export type ToggleOptions = {
  initialValue?: boolean;
  onToggle?: (value: boolean) => void;
};

// API client types
export type ApiResponse<T = any> = {
  data: T;
  message?: string;
  status: number;
  success: boolean;
};

export type ApiError = {
  message: string;
  status: number;
  code?: string;
  details?: Record<string, any>;
};

export type RequestConfig = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
};

// Pagination types
export type PaginationParams = {
  page: number;
  limit: number;
  offset?: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
};

// Search and filter types
export type SearchParams = {
  query?: string;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    direction: "asc" | "desc";
  };
  pagination?: PaginationParams;
};

// File handling types
export type FileUploadOptions = {
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  onProgress?: (progress: number) => void;
  onSuccess?: (file: File) => void;
  onError?: (error: Error) => void;
};

export type FileInfo = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  url?: string;
};

// Error handling types
export type ErrorBoundaryProps = {
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  children: React.ReactNode;
};

// Performance monitoring types
export type PerformanceMetrics = {
  loadTime: number;
  renderTime: number;
  memoryUsage?: number;
  networkRequests?: number;
};

export type PerformanceOptions = {
  enabled?: boolean;
  sampleRate?: number;
  onMetric?: (metric: PerformanceMetrics) => void;
};

// Accessibility types
export type A11yOptions = {
  announceChanges?: boolean;
  liveRegion?: "polite" | "assertive" | "off";
  focusManagement?: boolean;
  keyboardNavigation?: boolean;
};

// Theme types
export type ThemeMode = "light" | "dark" | "system";

export type ThemeOptions = {
  mode?: ThemeMode;
  customColors?: Record<string, string>;
  fonts?: {
    primary?: string;
    secondary?: string;
    mono?: string;
  };
  spacing?: Record<string, string>;
  borderRadius?: Record<string, string>;
  shadows?: Record<string, string>;
};

// Animation types
export type AnimationType =
  | "fade"
  | "slide"
  | "scale"
  | "rotate"
  | "bounce"
  | "shake"
  | "pulse"
  | "wiggle";

export type AnimationOptions = {
  type?: AnimationType;
  duration?: number;
  delay?: number;
  easing?: string;
  direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
  iterationCount?: number | "infinite";
  fillMode?: "none" | "forwards" | "backwards" | "both";
};

// Storage types
export type StorageType =
  | "localStorage"
  | "sessionStorage"
  | "indexedDB"
  | "memory";

export type StorageOptions = {
  type?: StorageType;
  prefix?: string;
  serialize?: boolean;
  encryption?: boolean;
  compression?: boolean;
};

// Cache types
export type CacheOptions = {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items
  strategy?: "lru" | "fifo" | "lfu"; // Cache eviction strategy
  persist?: boolean; // Persist to storage
};

export type CacheEntry<T> = {
  key: string;
  value: T;
  timestamp: number;
  ttl: number;
  hits: number;
};

// Event types
export type EventHandler<T = any> = (event: T) => void | Promise<void>;

export type EventOptions = {
  once?: boolean;
  passive?: boolean;
  capture?: boolean;
  signal?: AbortSignal;
};

// Utility function types
export type Predicate<T> = (value: T) => boolean;
export type Mapper<T, U> = (value: T) => U;
export type Reducer<T, U> = (accumulator: U, current: T) => U;
export type Comparator<T> = (a: T, b: T) => number;
export type Transformer<T, U> = (value: T) => U;
export type Validator<T> = (value: T) => boolean | string;

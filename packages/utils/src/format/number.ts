import type { NumberFormatType } from "@esli-cosmetics/types";
import { LOCALE_SETTINGS } from "../lib/constants";

/**
 * Format number with localization
 */
export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(LOCALE_SETTINGS.locale, options).format(value);
  } catch (error) {
    console.warn("Number formatting error:", error);
    return value.toString();
  }
}

/**
 * Format percentage
 */
export function formatPercentage(
  value: number,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2
): string {
  return formatNumber(value / 100, {
    style: "percent",
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

/**
 * Format decimal number
 */
export function formatDecimal(
  value: number,
  minimumFractionDigits = 0,
  maximumFractionDigits = 2
): string {
  return formatNumber(value, {
    minimumFractionDigits,
    maximumFractionDigits,
  });
}

/**
 * Format compact number (1K, 1M, etc.)
 */
export function formatCompactNumber(value: number): string {
  return formatNumber(value, {
    notation: "compact",
    compactDisplay: "short",
  } as Intl.NumberFormatOptions);
}

/**
 * Format file size in bytes
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format ordinal number (1st, 2nd, 3rd, etc.)
 */
export function formatOrdinal(value: number): string {
  const _suffixes = ["º", "º", "º", "º"]; // Spanish ordinals (reserved for i18n)
  const lastDigit = value % 10;
  const lastTwoDigits = value % 100;

  // Special cases for 11, 12, 13
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${value}º`;
  }

  // Regular cases
  switch (lastDigit) {
    case 1:
      return `${value}º`; // 1º, 21º, 31º
    case 2:
      return `${value}º`; // 2º, 22º, 32º
    case 3:
      return `${value}º`; // 3º, 23º, 33º
    default:
      return `${value}º`; // All others
  }
}

/**
 * Format quantity with singular/plural
 */
export function formatQuantity(
  count: number,
  singular: string,
  plural?: string
): string {
  const pluralForm = plural || `${singular}s`;
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

/**
 * Format rating (e.g., 4.5/5)
 */
export function formatRating(
  rating: number,
  maxRating = 5,
  minimumFractionDigits = 1
): string {
  const formattedRating = formatNumber(rating, {
    minimumFractionDigits,
    maximumFractionDigits: 1,
  });
  return `${formattedRating}/${maxRating}`;
}

/**
 * Format with specific number type
 */
export function formatByType(value: number, type: NumberFormatType): string {
  switch (type) {
    case "currency":
      return formatNumber(value, {
        style: "currency",
        currency: LOCALE_SETTINGS.currency,
      });
    case "percentage":
      return formatPercentage(value);
    case "decimal":
      return formatDecimal(value);
    case "compact":
      return formatCompactNumber(value);
    default:
      return formatNumber(value);
  }
}

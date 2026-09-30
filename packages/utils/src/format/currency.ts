import type { Currency, CurrencyFormatOptions } from "@esli-cosmetics/types";
import { LOCALE_SETTINGS } from "../lib/constants";

/**
 * Format currency amount with proper localization
 */
export function formatCurrency(
  amount: number,
  options?: Partial<CurrencyFormatOptions>
): string {
  const {
    currency = LOCALE_SETTINGS.currency as Currency,
    locale = LOCALE_SETTINGS.locale,
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
  } = options || {};

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount);
  } catch (error) {
    // Fallback for unsupported locales
    console.warn("Currency formatting error:", error);
    return `${currency} ${amount.toFixed(maximumFractionDigits)}`;
  }
}

/**
 * Format currency for Nicaragua (Córdoba)
 */
export function formatNicaraguanCurrency(amount: number): string {
  return formatCurrency(amount, {
    currency: "NIO", // Nicaraguan Córdoba
    locale: "es-NI",
  });
}

/**
 * Format currency for display without symbol (just numbers)
 */
export function formatCurrencyValue(
  amount: number,
  maximumFractionDigits = 2
): string {
  return amount.toLocaleString(LOCALE_SETTINGS.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  });
}

/**
 * Parse currency string back to number
 */
export function parseCurrency(currencyString: string): number {
  // Remove currency symbols, spaces, and other non-numeric characters
  const numericString = currencyString.replace(/[^\d.,]/g, "");

  // Handle different decimal separators
  const normalizedString = numericString.replace(",", ".");

  return parseFloat(normalizedString) || 0;
}

/**
 * Format price range
 */
export function formatPriceRange(
  min: number,
  max: number,
  currency?: Currency
): string {
  if (min === max) {
    return currency ? formatCurrency(min, { currency }) : formatCurrency(min);
  }

  return currency
    ? `${formatCurrency(min, { currency })} - ${formatCurrency(max, { currency })}`
    : `${formatCurrency(min)} - ${formatCurrency(max)}`;
}

/**
 * Utility functions for sanitizing user input
 */

/**
 * Sanitize string input by removing potentially dangerous characters
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, "");

  // Trim whitespace
  sanitized = sanitized.trim();

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Sanitize email by normalizing and validating format
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== "string") {
    return "";
  }

  // Trim and lowercase
  let sanitized = email.trim().toLowerCase();

  // Remove any whitespace
  sanitized = sanitized.replace(/\s/g, "");

  return sanitized;
}

/**
 * Sanitize phone number by removing non-digit characters (except + at start)
 */
export function sanitizePhone(phone: string): string {
  if (!phone || typeof phone !== "string") {
    return "";
  }

  // Remove all characters except digits and + at the start
  let sanitized = phone.trim();

  // Keep + only at the beginning
  const hasPlus = sanitized.startsWith("+");
  sanitized = sanitized.replace(/[^\d+]/g, "");

  if (hasPlus && !sanitized.startsWith("+")) {
    sanitized = "+" + sanitized;
  } else if (!hasPlus && sanitized.startsWith("+")) {
    sanitized = sanitized.substring(1);
  }

  return sanitized;
}

/**
 * Sanitize object by applying sanitization to string fields
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const sanitized = { ...obj };

  for (const field of fields) {
    if (typeof sanitized[field] === "string") {
      sanitized[field] = sanitizeString(
        sanitized[field] as string
      ) as T[keyof T];
    }
  }

  return sanitized;
}

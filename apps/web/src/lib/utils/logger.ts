/**
 * Client-side logger utility that respects environment settings.
 * Only logs in development or when explicitly enabled.
 */

const isDevelopment = process.env.NODE_ENV === "development";
const isLoggingEnabled =
  process.env.NEXT_PUBLIC_ENABLE_LOGGING === "true" || isDevelopment;

function shouldLog(): boolean {
  return isLoggingEnabled;
}

/**
 * Sanitize sensitive data from logs
 */
function sanitizeData(
  data?: Record<string, any>
): Record<string, any> | undefined {
  if (!data) return undefined;

  const sensitiveKeys = [
    "password",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
  ];
  const sanitized = { ...data };

  for (const key of sensitiveKeys) {
    if (sanitized[key]) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

export const logger = {
  log: (message: string, ...args: any[]): void => {
    if (shouldLog()) {
    }
  },

  error: (message: string, ...args: any[]): void => {
    // Always log errors
    console.error(message, ...args);
  },

  warn: (message: string, ...args: any[]): void => {
    if (shouldLog()) {
      console.warn(message, ...args);
    }
  },

  debug: (message: string, data?: Record<string, any>): void => {
    if (shouldLog()) {
      const sanitized = sanitizeData(data);
      console.debug(message, sanitized);
    }
  },

  /**
   * Log authentication events (always logged for security monitoring)
   */
  authLog: (message: string, data?: Record<string, any>): void => {
    // Always log auth events, but sanitize sensitive data
    const sanitized = sanitizeData(data);
  },
};

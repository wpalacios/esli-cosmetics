import { Injectable, LoggerService as NestLoggerService } from "@nestjs/common";

/**
 * Custom logger service that respects environment settings.
 * Only logs in development or when explicitly enabled.
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly isDevelopment = process.env.NODE_ENV === "development";
  private readonly isLoggingEnabled =
    process.env.ENABLE_LOGGING === "true" || this.isDevelopment;

  private shouldLog(): boolean {
    return this.isLoggingEnabled;
  }

  log(message: string, context?: string, ...optionalParams: any[]): void {
    if (this.shouldLog()) {
      if (context) {
      } else {
      }
    }
  }

  error(
    message: string,
    trace?: string,
    context?: string,
    ...optionalParams: any[]
  ): void {
    // Always log errors, but sanitize in production
    if (context) {
      console.error(`[${context}] ${message}`, trace || "", ...optionalParams);
    } else {
      console.error(message, trace || "", ...optionalParams);
    }
  }

  warn(message: string, context?: string, ...optionalParams: any[]): void {
    if (this.shouldLog()) {
      if (context) {
        console.warn(`[${context}] ${message}`, ...optionalParams);
      } else {
        console.warn(message, ...optionalParams);
      }
    }
  }

  debug(message: string, context?: string, ...optionalParams: any[]): void {
    if (this.shouldLog()) {
      if (context) {
        console.debug(`[${context}] ${message}`, ...optionalParams);
      } else {
        console.debug(message, ...optionalParams);
      }
    }
  }

  verbose(message: string, context?: string, ...optionalParams: any[]): void {
    if (this.shouldLog()) {
      if (context) {
      } else {
      }
    }
  }

  /**
   * Log authentication events (always logged for security monitoring)
   */
  authLog(message: string, data?: Record<string, any>): void {
    // Always log auth events, but sanitize sensitive data
    const sanitizedData = this.sanitizeAuthData(data);
  }

  /**
   * Sanitize sensitive data from logs
   */
  private sanitizeAuthData(
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

    // Redact token from cookies object
    if (sanitized.cookies) {
      const cookies = { ...sanitized.cookies };
      for (const key of sensitiveKeys) {
        if (cookies[key]) {
          cookies[key] = "[REDACTED]";
        }
      }
      sanitized.cookies = cookies;
    }

    return sanitized;
  }
}

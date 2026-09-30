/**
 * Custom error class for API errors that preserves HTTP status codes and response data.
 * This allows components to handle specific HTTP status codes (e.g., 409 Conflict).
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly response?: string | object | undefined;
  public readonly originalError?: Error | undefined;

  constructor(
    message: string,
    status: number,
    response?: string | object,
    originalError?: Error
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.response = response;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }

  /**
   * Check if the error is a specific HTTP status code
   */
  isStatus(statusCode: number): boolean {
    return this.status === statusCode;
  }

  /**
   * Check if the error is a client error (4xx)
   */
  isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /**
   * Check if the error is a server error (5xx)
   */
  isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }
}

/**
 * Check if an error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Check if an error has a status code (ApiError or Error with status property)
 */
export function hasStatusCode(
  error: unknown
): error is Error & { status: number } {
  return (
    isApiError(error) ||
    (error instanceof Error &&
      "status" in error &&
      typeof (error as any).status === "number")
  );
}

/**
 * Get the status code from an error, if available
 * Tries multiple methods to extract the status code:
 * 1. ApiError instance
 * 2. Error with status property
 * 3. Parse from error message (format: "API Error: 409 - ...")
 */
export function getErrorStatus(error: unknown): number | null {
  // Method 1: Check if it's an ApiError instance
  if (isApiError(error)) {
    return error.status;
  }

  // Method 2: Check if error has status property
  if (hasStatusCode(error)) {
    return error.status;
  }

  // Method 3: Check for status property directly (for serialized errors)
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as any).status;
    if (typeof status === "number") {
      return status;
    }
  }

  // Method 4: Parse from error message (fallback for serialized errors)
  if (error instanceof Error) {
    const statusRegex = /API Error: (\d+)/;
    const statusMatch = statusRegex.exec(error.message);
    if (statusMatch?.[1]) {
      return Number.parseInt(statusMatch[1], 10);
    }
  }

  // Method 5: Check error object message property (for non-Error objects)
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as any).message);
    const statusRegex = /API Error: (\d+)/;
    const statusMatch = statusRegex.exec(message);
    if (statusMatch?.[1]) {
      return Number.parseInt(statusMatch[1], 10);
    }
  }

  return null;
}

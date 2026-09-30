/**
 * Custom error class for session expiration.
 * This error should be caught and handled by redirecting to login.
 */
export class SessionExpiredError extends Error {
  constructor(message = "Session expired. Please log in again.") {
    super(message);
    this.name = "SessionExpiredError";
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SessionExpiredError);
    }
  }
}

/**
 * Check if an error is a SessionExpiredError
 */
export function isSessionExpiredError(
  error: unknown
): error is SessionExpiredError {
  return (
    error instanceof SessionExpiredError ||
    (error instanceof Error && error.message.includes("Session expired"))
  );
}

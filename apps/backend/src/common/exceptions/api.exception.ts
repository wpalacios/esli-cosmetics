import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  timestamp: string;
  path?: string;
  code?: string; // Custom error code for client-side handling
}

/**
 * Base API exception with standardized error format
 */
export class ApiException extends HttpException {
  constructor(
    message: string | string[],
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    code?: string
  ) {
    const response: ApiErrorResponse = {
      statusCode: status,
      error: HttpStatus[status] || "Error",
      message,
      timestamp: new Date().toISOString(),
      ...(code && { code }),
    };

    super(response, status);
  }
}

/**
 * Authentication-related exceptions
 */
export class AuthenticationException extends ApiException {
  constructor(
    message: string = "Authentication failed",
    code: string = "AUTH_FAILED"
  ) {
    super(message, HttpStatus.UNAUTHORIZED, code);
  }
}

export class AuthorizationException extends ApiException {
  constructor(
    message: string = "Access denied",
    code: string = "ACCESS_DENIED"
  ) {
    super(message, HttpStatus.FORBIDDEN, code);
  }
}

/**
 * Validation-related exceptions
 */
export class ValidationException extends ApiException {
  constructor(
    message: string | string[] = "Validation failed",
    code: string = "VALIDATION_ERROR"
  ) {
    super(message, HttpStatus.BAD_REQUEST, code);
  }
}

/**
 * Resource-related exceptions
 */
export class NotFoundException extends ApiException {
  constructor(
    message: string = "Resource not found",
    code: string = "NOT_FOUND"
  ) {
    super(message, HttpStatus.NOT_FOUND, code);
  }
}

export class ConflictException extends ApiException {
  constructor(
    message: string = "Resource conflict",
    code: string = "CONFLICT"
  ) {
    super(message, HttpStatus.CONFLICT, code);
  }
}

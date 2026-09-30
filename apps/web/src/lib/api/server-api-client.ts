import {
  getAccessTokenFromCookie,
  getRefreshTokenFromCookie,
} from "@/lib/auth/session";
import { SessionExpiredError } from "@/lib/errors/session-expired-error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export class ServerApiClient {
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL || API_BASE_URL;
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const refreshToken = await getRefreshTokenFromCookie();

      if (!refreshToken) {
        return null;
      }


      const response = await fetch(`${this.baseURL}/api/v1/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${refreshToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");

        if (response.status === 401 || response.status === 403) {
          return null;
        }

        // 5xx errors are transient server issues, NOT expired sessions.
        // Throw instead of returning null so callers don't misclassify as session expiry.
        throw new Error(`Token refresh failed with status ${response.status}`);
      }

      const data = await response.json();

      if (!data.accessToken) {
        return null;
      }

      /**
       * Best Practice: Backend sets new HttpOnly cookies automatically via Set-Cookie headers.
       * These are handled by the browser - no need to manually extract and store.
       * The token in the response body is for immediate use in this request.
       */
      return data.accessToken;
    } catch (error) {
      console.error("❌ Error refreshing token:", error);
      // Don't try to clear session here - might be in invalid context
      // The error will be handled by the calling code
      return null;
    }
  }

  private async request(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<any> {
    const url = `${this.baseURL}/api/v1${endpoint}`;

    // Get tokens from HttpOnly cookies (set by backend)
    let accessToken = await getAccessTokenFromCookie();
    const refreshToken = await getRefreshTokenFromCookie();

    // Get headers from the incoming request for proper browser detection
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/html, */*",
      "User-Agent": "Mozilla/5.0 (compatible; EsliCosmetics/1.0)",
    };

    // Add backend cookies for authentication
    const cookieParts = [];
    if (accessToken) {
      cookieParts.push(`access_token=${accessToken}`);
    }
    if (refreshToken) {
      cookieParts.push(`refresh_token=${refreshToken}`);
    }

    if (cookieParts.length > 0) {
      headers.Cookie = cookieParts.join("; ");
    }

    // Merge existing headers
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = value;
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }


    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401/403 - attempt token refresh
    if (
      (response.status === 401 || response.status === 403) &&
      retryCount === 0
    ) {

      try {
        const newAccessToken = await this.refreshToken();

        if (newAccessToken) {
          accessToken = newAccessToken;
          return this.request(endpoint, options, retryCount + 1);
        }

        throw new SessionExpiredError("Session expired. Please log in again.");
      } catch (refreshError) {
        if (refreshError instanceof SessionExpiredError) throw refreshError;
        // refreshToken() threw on a transient 5xx — don't force logout
        throw new Error(
          `Request failed: server unavailable during token refresh`
        );
      }
    }

    if (!response.ok) {
      // Try to parse JSON error response (standardized format from HttpExceptionFilter)
      // Format: { statusCode, error, message, timestamp, path, code? }
      let errorData: any;
      let errorText: string;
      const contentType = response.headers.get("content-type") || "";
      const isHtmlResponse =
        contentType.includes("text/html") || contentType.includes("text/plain");

      try {
        errorText = await response.text();

        // Detect HTML responses (e.g., Cloudflare error pages)
        const isHtml =
          isHtmlResponse ||
          errorText.trim().startsWith("<!DOCTYPE") ||
          errorText.trim().startsWith("<html");

        if (isHtml) {
          // For HTML responses (typically from Cloudflare or proxy errors), provide user-friendly messages
          const isServerError = response.status >= 500 && response.status < 600;

          if (isServerError) {
            // Extract error title from HTML if possible (Cloudflare format)
            const titleMatch = errorText.match(/<title[^>]*>([^<]+)<\/title>/i);
            const errorTitle = titleMatch?.[1]?.trim() ?? null;

            // Provide user-friendly error messages for common server errors
            let userMessage: string;
            switch (response.status) {
              case 502:
                userMessage =
                  "The server is temporarily unavailable. Please try again in a few moments.";
                break;
              case 503:
                userMessage =
                  "The service is temporarily unavailable. Please try again later.";
                break;
              case 504:
                userMessage = "The request timed out. Please try again.";
                break;
              default:
                userMessage =
                  "The server encountered an error. Please try again later.";
            }

            errorData = {
              message: userMessage,
              isHtmlError: true,
              originalError: errorTitle || `HTTP ${response.status} Error`,
            };
          } else {
            // For non-server errors with HTML, still try to extract meaningful info
            errorData = {
              message: `Request failed with status ${response.status}. Please try again.`,
              isHtmlError: true,
            };
          }
        } else {
          // Try to parse as JSON
          try {
            errorData = JSON.parse(errorText);
          } catch {
            // If not JSON and not HTML, use text as message (but truncate if too long)
            const maxLength = 500;
            const truncatedText =
              errorText.length > maxLength
                ? errorText.substring(0, maxLength) + "..."
                : errorText;
            errorData = { message: truncatedText };
          }
        }
      } catch {
        errorText = "Unknown error";
        errorData = {
          message: "An unexpected error occurred. Please try again.",
        };
      }

      console.error("❌ Server API Error:", {
        status: response.status,
        code: errorData.code,
        message: errorData.message || errorText.substring(0, 200),
        isHtmlError: errorData.isHtmlError,
        url,
        retryCount,
      });

      // Create a proper Error object with the API error details
      const errorMessage = errorData.message || `API Error: ${response.status}`;
      const error = new Error(
        `API Error: ${response.status} - ${errorMessage}`
      );

      // Add structured error data for better error handling
      (error as any).status = response.status;
      (error as any).code = errorData.code; // Error code from backend (e.g., "VALIDATION_ERROR", "INVALID_CREDENTIALS")
      (error as any).response = errorData; // Full error object
      (error as any).errorText = errorText; // Original text for backward compatibility
      (error as any).isHtmlError = errorData.isHtmlError; // Flag for HTML error responses

      throw error;
    }

    // Handle responses with no content (204 No Content, 205 Reset Content)
    // These status codes explicitly indicate no response body
    if (response.status === 204 || response.status === 205) {
      return null;
    }

    // Check if response has content before parsing JSON
    const contentLength = response.headers.get("content-length");
    const contentType = response.headers.get("content-type");

    // Read the response body as text first to check if it's empty
    const text = await response.text();

    // If body is empty, handle based on expected behavior
    if (!text || text.trim().length === 0) {
      // For DELETE requests, empty body is acceptable
      if (options.method === "DELETE") {
        return null;
      }

      // For other requests, log a warning but return null to avoid JSON parse error
      // This prevents the "Unexpected end of JSON input" error
      console.warn("⚠️ Empty response body received (expected JSON):", {
        url,
        status: response.status,
        method: options.method || "GET",
        contentType,
        contentLength,
      });
      return null;
    }

    // Parse JSON if content exists
    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("❌ Failed to parse JSON response:", {
        url,
        status: response.status,
        contentType,
        contentLength,
        textPreview: text.substring(0, 200),
        error: parseError,
      });
      throw new Error(
        `Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : String(parseError)}`
      );
    }
  }

  async get(endpoint: string) {
    return this.request(endpoint, { method: "GET" });
  }

  async post(endpoint: string, data?: any) {
    const requestOptions: RequestInit = {
      method: "POST",
    };

    if (data) {
      requestOptions.body = JSON.stringify(data);
    }

    return this.request(endpoint, requestOptions);
  }

  async put(endpoint: string, data?: any) {
    const requestOptions: RequestInit = {
      method: "PUT",
    };

    if (data) {
      requestOptions.body = JSON.stringify(data);
    }

    return this.request(endpoint, requestOptions);
  }

  async patch(endpoint: string, data?: any) {
    const requestOptions: RequestInit = {
      method: "PATCH",
    };

    if (data) {
      requestOptions.body = JSON.stringify(data);
    }

    return this.request(endpoint, requestOptions);
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: "DELETE" });
  }

  private async requestBinary(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<{ arrayBuffer: ArrayBuffer; headers: Headers }> {
    const url = `${this.baseURL}/api/v1${endpoint}`;

    // Get tokens from HttpOnly cookies (set by backend)
    let accessToken = await getAccessTokenFromCookie();
    const refreshToken = await getRefreshTokenFromCookie();

    const headers: Record<string, string> = {
      Accept: "application/octet-stream, */*",
      "User-Agent": "Mozilla/5.0 (compatible; EsliCosmetics/1.0)",
    };

    const cookieParts: string[] = [];
    if (accessToken) cookieParts.push(`access_token=${accessToken}`);
    if (refreshToken) cookieParts.push(`refresh_token=${refreshToken}`);
    if (cookieParts.length > 0) headers.Cookie = cookieParts.join("; ");

    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(options.headers)) {
        options.headers.forEach(([key, value]) => {
          headers[key] = String(value);
        });
      } else {
        Object.assign(headers, options.headers);
      }
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && retryCount === 0) {
      const newAccessToken = await this.refreshToken();
      if (newAccessToken) {
        // Tokens are already in HttpOnly cookies, just retry
        accessToken = newAccessToken;
        return this.requestBinary(endpoint, options, retryCount + 1);
      }
      // Don't try to clear session here - might be in invalid context
      throw new SessionExpiredError("Session expired. Please log in again.");
    }

    if (!response.ok) {
      // Try to parse JSON error response (standardized format from HttpExceptionFilter)
      let errorData: any;
      let errorText: string;

      try {
        errorText = await response.text().catch(() => "");
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText };
        }
      } catch {
        errorText = "Unknown error";
        errorData = { message: errorText };
      }

      const errorMessage =
        errorData.message || errorText || `API Error: ${response.status}`;
      const error = new Error(
        `API Error: ${response.status} - ${errorMessage}`
      );
      (error as any).status = response.status;
      (error as any).code = errorData.code; // Error code from backend
      (error as any).response = errorData; // Full error object
      (error as any).errorText = errorText; // Original text for backward compatibility
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    return { arrayBuffer, headers: response.headers };
  }

  async postBinary(
    endpoint: string,
    data?: any,
    accept = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const options: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: `${accept}, application/octet-stream`,
      },
    };

    if (data !== undefined) {
      options.body = JSON.stringify(data);
    }

    return this.requestBinary(endpoint, options);
  }
}

export const serverApiClient = new ServerApiClient();

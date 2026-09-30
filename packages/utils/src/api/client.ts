// API client for backend communication
export class ApiClient {
  private baseURL: string;
  private accessToken: string | null = null;

  constructor(baseURL?: string) {
    // Handle environment variable safely for both client and server environments
    const defaultUrl = "http://localhost:3001";
    let envUrl: string | undefined;

    // Check for environment variables in a type-safe way
    if (typeof globalThis !== "undefined" && "process" in globalThis) {
      const processEnv = (globalThis as any).process?.env;
      envUrl = processEnv?.NEXT_PUBLIC_API_URL;
    }

    this.baseURL = baseURL || envUrl || defaultUrl;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseURL}/api/v1${endpoint}`;

    // Auto-detect user agent for browser detection
    const userAgent =
      typeof window !== "undefined"
        ? window.navigator.userAgent
        : "Mozilla/5.0 (compatible; EsliCosmetics/1.0)";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/html, */*",
      "User-Agent": userAgent,
    };

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

    // For client-side requests, include credentials to send HTTP-only cookies
    const fetchOptions: RequestInit = {
      ...options,
      headers,
      credentials: "include", // This ensures HTTP-only cookies are sent
    };

    // Only add Authorization header if we have a token (for server-side requests)
    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    return response.json();
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
}

export const apiClient = new ApiClient();

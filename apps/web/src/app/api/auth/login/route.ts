import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Login API route that proxies to backend and forwards Set-Cookie headers.
 *
 * This is necessary because server actions can't set response cookies directly.
 * API routes can properly forward Set-Cookie headers from backend to browser.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    // Call backend login endpoint
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      // Try to parse error response from backend
      let errorData: {
        error?: string;
        message?: string | string[];
        code?: string;
      } = {};
      try {
        errorData = await response.json();
      } catch {
        // If JSON parsing fails, use default error
        errorData = { error: "Invalid credentials" };
      }

      // Forward error code and message from backend
      return NextResponse.json(
        {
          error: Array.isArray(errorData.message)
            ? errorData.message[0]
            : errorData.message || errorData.error || "Invalid credentials",
          code: errorData.code || "UNKNOWN_ERROR",
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Create Next.js response with the data
    const nextResponse = NextResponse.json({ success: true, user: data.user });

    // Forward Set-Cookie headers from backend to browser
    // This is CRITICAL - backend sets HttpOnly cookies that need to reach the browser
    const setCookieHeaders = response.headers.getSetCookie();

    for (const cookieString of setCookieHeaders) {
      // Parse the Set-Cookie header: "name=value; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800"
      const parts = cookieString.split(";");
      const nameValuePart = parts[0];

      if (!nameValuePart) continue;

      const equalIndex = nameValuePart.indexOf("=");
      if (equalIndex === -1) continue;

      const name = nameValuePart.substring(0, equalIndex).trim();
      const value = nameValuePart.substring(equalIndex + 1).trim();

      if (!name || !value) continue;

      // Parse cookie attributes
      const isHttpOnly = cookieString.includes("HttpOnly");
      const isSecure =
        cookieString.includes("Secure") ||
        process.env.NODE_ENV === "production";

      let sameSite: "strict" | "lax" | "none" = "strict";
      const sameSiteRegex = /SameSite=(\w+)/i;
      const sameSiteMatch = sameSiteRegex.exec(cookieString);
      if (sameSiteMatch?.[1]) {
        const samesiteValue = sameSiteMatch[1].toLowerCase();
        if (samesiteValue === "lax") sameSite = "lax";
        else if (samesiteValue === "none") sameSite = "none";
      }

      const pathRegex = /Path=([^;]+)/;
      const pathMatch = pathRegex.exec(cookieString);
      const path = pathMatch?.[1]?.trim() || "/";

      const maxAgeRegex = /Max-Age=(\d+)/;
      const maxAgeMatch = maxAgeRegex.exec(cookieString);
      const maxAge = maxAgeMatch?.[1]
        ? Number.parseInt(maxAgeMatch[1], 10)
        : undefined;

      // Set the cookie in the response - this will be sent to the browser
      nextResponse.cookies.set(name, value, {
        httpOnly: isHttpOnly,
        secure: isSecure,
        sameSite,
        path,
        ...(maxAge !== undefined && { maxAge }),
      });
    }

    return nextResponse;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Login failed", code: "NETWORK_ERROR" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getRefreshTokenFromCookie } from "@/lib/auth/session";
import { logger } from "@/lib/utils/logger";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * API route for refreshing access tokens.
 *
 * This route proxies the refresh request to the backend and forwards
 * Set-Cookie headers to the browser, ensuring HttpOnly cookies are
 * properly set after refresh.
 *
 * Best Practice: API routes can set response cookies, unlike server actions.
 */
export async function POST() {
  try {
    const refreshToken = await getRefreshTokenFromCookie();

    if (!refreshToken) {
      return NextResponse.json(
        { error: "No refresh token found" },
        { status: 401 }
      );
    }

    // Include cookies in the request so backend can read HttpOnly cookies if needed
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${refreshToken}`,
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Token refresh failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Forward Set-Cookie headers from backend to browser
    const setCookieHeaders = response.headers.getSetCookie();
    const nextResponse = NextResponse.json(data);

    // Parse and forward each cookie
    for (const cookieString of setCookieHeaders) {
      const parts = cookieString.split(";");
      const nameValuePart = parts[0];

      if (!nameValuePart) continue;

      const equalIndex = nameValuePart.indexOf("=");
      if (equalIndex === -1) continue;

      const name = nameValuePart.substring(0, equalIndex).trim();
      const value = nameValuePart.substring(equalIndex + 1).trim();

      if (!name || !value) continue;

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

      nextResponse.cookies.set(name, value, {
        httpOnly: isHttpOnly,
        secure: isSecure,
        sameSite,
        path,
        ...(maxAge !== undefined && { maxAge }),
      });
    }

    // Also set access_token cookie if returned in response body
    if (data.accessToken) {
      const maxAge = data.expiresIn || 7 * 24 * 60 * 60; // Default to 7 days
      nextResponse.cookies.set("access_token", data.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge,
      });
    }

    return nextResponse;
  } catch (error) {
    logger.error("Error refreshing token:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

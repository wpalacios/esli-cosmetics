import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Decode JWT payload to check expiration (without verification).
 * This is safe for middleware as we only read the exp claim.
 */
function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return true;
    }

    const payload = parts[1];
    if (!payload) {
      return true;
    }

    // Decode base64url payload
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const decoded = Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as { exp?: number };

    if (!parsed.exp) {
      return true;
    }

    // exp is in seconds, Date.now() is in milliseconds
    const expirationTime = parsed.exp * 1000;
    const now = Date.now();

    // Add 1 minute buffer to refresh before actual expiration
    const bufferTime = 1 * 60 * 1000; // 1 minute

    return now >= expirationTime - bufferTime;
  } catch {
    // If we can't decode, consider it expired
    // This handles malformed tokens gracefully
    return true;
  }
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Allow access to auth pages and API routes without authentication
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/")
  ) {
    const response = NextResponse.next();
    // Add pathname to headers for use in layouts
    response.headers.set("x-pathname", pathname);
    return response;
  }

  // Check for access token cookie (set by backend)
  const accessTokenCookie = request.cookies.get("access_token")?.value;
  const refreshTokenCookie = request.cookies.get("refresh_token")?.value;

  // Check if access token is expired or missing
  const hasValidAccessToken =
    accessTokenCookie && !isTokenExpired(accessTokenCookie);

  // If no valid access token exists, check for refresh token
  // If refresh token exists, allow request through so client can refresh
  // If neither exists, redirect to login
  if (!hasValidAccessToken) {
    // If we have a refresh token, allow the request through
    // The client-side AuthProvider will handle token refresh
    if (refreshTokenCookie) {
      // Allow request - client will handle refresh
      const response = NextResponse.next();
      response.headers.set("x-pathname", pathname);
      return response;
    }

    // No tokens at all - redirect to login
    // Only redirect if not already on login/register page
    if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  const response = NextResponse.next();
  // Add pathname to headers for use in layouts
  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Logout API route that clears all authentication cookies.
 *
 * Best Practice: Clear all backend authentication cookies.
 */
export async function POST() {
  try {
    // Call backend logout endpoint to clear backend cookies
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(cookieHeader && { Cookie: cookieHeader }),
        },
        credentials: "include",
      });
    } catch (error) {
      // Continue even if backend logout fails
      console.warn("Backend logout failed:", error);
    }

    // Create response
    const response = NextResponse.json({ success: true });

    // Clear all authentication cookies (new backend cookies)
    const authCookies = [
      // New backend cookies
      "access_token",
      "refresh_token",
      "user_roles",
      // TODO: remove legacy iron-session cookies
      // Legacy iron-session cookies (cleanup)
      "esli-access-token",
      "esli-refresh-token",
      "esli-roles",
      "esli-session",
    ];

    for (const cookieName of authCookies) {
      response.cookies.delete(cookieName);
      // Also try to clear with path
      response.cookies.set(cookieName, "", {
        expires: new Date(0),
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });
    }

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}

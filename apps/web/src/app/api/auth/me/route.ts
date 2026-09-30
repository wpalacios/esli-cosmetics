import { NextResponse } from "next/server";
import {
  getAccessTokenFromCookie,
  getUserIdFromToken,
} from "@/lib/auth/session";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET() {
  try {
    // Get access token from backend's HttpOnly cookie
    const accessToken = await getAccessTokenFromCookie();

    // Get userId from JWT token (no need for separate session storage)
    const userId = await getUserIdFromToken();

    if (!accessToken || !userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user data from backend
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: response.status }
      );
    }

    const userData = await response.json();
    return NextResponse.json(userData);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

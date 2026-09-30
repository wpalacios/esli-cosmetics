import { NextResponse } from "next/server";
import { getLocations } from "@/actions/locations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const locations = await getLocations(page, limit);
    return NextResponse.json(locations);
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations", locations: [] },
      { status: 500 }
    );
  }
}

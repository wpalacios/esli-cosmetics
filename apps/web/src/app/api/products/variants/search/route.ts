import { NextResponse } from "next/server";
import { searchProductVariants } from "@/actions/product-variants";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query") || "";
    const locationId = searchParams.get("locationId");

    if (!query || query.trim().length < 2) {
      return NextResponse.json([]);
    }

    const variants = await searchProductVariants({
      query: query.trim(),
      ...(locationId && { locationId }),
    });
    return NextResponse.json(variants);
  } catch (error) {
    console.error("Error searching product variants:", error);
    return NextResponse.json(
      { error: "Failed to search product variants", data: [] },
      { status: 500 }
    );
  }
}

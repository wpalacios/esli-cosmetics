import { NextResponse } from "next/server";
import { getCustomers } from "@/actions/customers";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search");

    const customersData = await getCustomers({
      page,
      limit,
      ...(search && { search }),
    });
    return NextResponse.json(customersData);
  } catch (error) {
    console.error("Error fetching customers:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch customers",
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
      },
      { status: 500 }
    );
  }
}

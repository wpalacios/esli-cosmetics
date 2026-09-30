import { NextResponse } from "next/server";
import { getEmployees } from "@/actions/employees";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get("locationId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");

    const employees = await getEmployees({
      ...(locationId && { locationId }),
      page,
      limit,
    });

    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees", employees: [], total: 0 },
      { status: 500 }
    );
  }
}

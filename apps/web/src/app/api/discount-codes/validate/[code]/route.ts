import { NextResponse } from "next/server";
import { ServerApiClient } from "@/lib/api/server-api-client";

const apiClient = new ServerApiClient();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId") || undefined;
    const orderAmount = searchParams.get("orderAmount")
      ? parseFloat(searchParams.get("orderAmount")!)
      : undefined;

    const searchParamsBackend = new URLSearchParams();
    if (customerId) searchParamsBackend.set("customerId", customerId);
    if (orderAmount !== undefined) {
      searchParamsBackend.set("orderAmount", orderAmount.toString());
    }

    const queryString = searchParamsBackend.toString();
    const endpoint = `/discount-codes/validate/${encodeURIComponent(code)}${queryString ? `?${queryString}` : ""}`;

    const result = await apiClient.get(endpoint);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error validating discount code:", error);

    // Handle API errors
    if (error.message && error.message.includes("API Error")) {
      const statusMatch = error.message.match(/API Error: (\d+)/);
      const statusCode = statusMatch ? parseInt(statusMatch[1]) : 500;

      return NextResponse.json(
        {
          valid: false,
          message: error.message || "Failed to validate discount code",
          discountCode: null,
          calculatedDiscount: 0,
        },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      {
        valid: false,
        message: "Failed to validate discount code",
        discountCode: null,
        calculatedDiscount: 0,
      },
      { status: 500 }
    );
  }
}

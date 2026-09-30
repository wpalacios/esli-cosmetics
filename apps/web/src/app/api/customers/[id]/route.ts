import { NextResponse } from "next/server";
import { getCustomer } from "@/actions/customers";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const customer = await getCustomer(id);
    if (!customer) {
      return NextResponse.json(
        { message: "Customer not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(customer);
  } catch (error) {
    console.error("Error fetching customer by ID:", error);
    return NextResponse.json(
      { message: "Failed to fetch customer data" },
      { status: 500 }
    );
  }
}

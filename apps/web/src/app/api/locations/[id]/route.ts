import { NextResponse } from "next/server";
import { ServerApiClient } from "@/lib/api/server-api-client";

const apiClient = new ServerApiClient();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Try to get location from branches endpoint first (stores)
    const branches = await apiClient.get("/branches?limit=100");
    const allBranches = branches.data || [];

    for (const branch of allBranches) {
      const location = branch.locations?.find((loc: any) => loc.id === id);
      if (location) {
        return NextResponse.json({
          ...location,
          branchId: branch.id,
          branch: {
            id: branch.id,
            name: branch.name,
            code: branch.code,
          },
        });
      }
    }

    // If not found in branches, try warehouses
    const warehouses = await apiClient.get("/warehouses?limit=100");
    const allWarehouses = warehouses.data || [];
    const warehouse = allWarehouses.find((w: any) => w.id === id);

    if (warehouse) {
      return NextResponse.json({
        ...warehouse,
        branchId: warehouse.branchId || null,
        branch: warehouse.branch || null,
      });
    }

    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  } catch (error) {
    console.error("Error fetching location:", error);
    return NextResponse.json(
      { error: "Failed to fetch location" },
      { status: 500 }
    );
  }
}

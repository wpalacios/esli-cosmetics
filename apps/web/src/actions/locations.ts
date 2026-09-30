"use server";

import { ServerApiClient } from "@/lib/api/server-api-client";
import { LocationInfo } from "@esli-cosmetics/types";

const apiClient = new ServerApiClient();

export interface LocationsResponse {
  locations: LocationInfo[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export async function getLocations(
  page: number = 1,
  limit: number = 100
): Promise<LocationsResponse> {
  try {
    // Fetch both warehouses and branches
    const [warehousesResponse, branchesResponse] = await Promise.all([
      apiClient.get(`/warehouses?page=${page}&limit=${limit}`),
      apiClient.get(`/branches?page=${page}&limit=${limit}`),
    ]);

    // Extract data from responses
    const warehouses = warehousesResponse?.data || [];
    const branches = branchesResponse?.data || [];

    // Combine and map to LocationInfo interface
    const warehouseLocations: LocationInfo[] = warehouses.map((w: any) => ({
      id: w.id,
      branchId: w.branchId || null,
      name: w.name,
      locationType: w.locationType || "WAREHOUSE",
      address: w.address,
      contact: w.contact,
      isDeleted: w.isDeleted || w.is_deleted || false,
      createdAt: w.createdAt || w.created_at,
      updatedAt: w.updatedAt || w.updated_at,
      deletedAt: w.deletedAt || w.deleted_at,
    }));

    // Extract locations from branches (branches include locations array)
    const branchLocations: LocationInfo[] = branches.flatMap((b: any) => {
      const branchLocations = b.locations || [];
      return branchLocations.map((loc: any) => ({
        id: loc.id,
        branchId: b.id,
        name: `${loc.name}${b.name ? ` (${b.name})` : ""}`,
        locationType: loc.locationType || "STORE",
        address: loc.address || b.address,
        contact: loc.contact || b.phone,
        isDeleted: loc.isDeleted || loc.is_deleted || false,
        createdAt: loc.createdAt || loc.created_at,
        updatedAt: loc.updatedAt || loc.updated_at,
        deletedAt: loc.deletedAt || loc.deleted_at,
      }));
    });

    const allLocations = [...warehouseLocations, ...branchLocations];

    return {
      locations: allLocations,
      page,
      limit,
      total: allLocations.length,
      totalPages: Math.ceil(allLocations.length / limit),
    };
  } catch (error) {
    console.error("Error fetching locations:", error);
    return {
      locations: [],
      page,
      limit,
      total: 0,
      totalPages: 0,
    };
  }
}

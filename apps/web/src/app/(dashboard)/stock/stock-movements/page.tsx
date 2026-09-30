import { getStockMovements } from "@/actions";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { StockMovementsPageClient } from "./stock-movements-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stock Movements | Esli Cosmetics",
  description: "View and manage stock movement history",
};

async function getInitialData() {
  try {
    // Fetch first page of stock movements
    const stockMovements = await getStockMovements(1, 10);

    // Convert StockMovementsResponse to PaginatedStockMovementDto
    const paginatedData = {
      data: stockMovements.stockMovements || [],
      pagination: {
        page: stockMovements.page,
        limit: stockMovements.limit,
        total: stockMovements.total,
        totalPages: stockMovements.totalPages,
        hasNext: stockMovements.page < stockMovements.totalPages,
        hasPrev: stockMovements.page > 1,
      },
    };

    return {
      initialData: paginatedData,
      error: null,
    };
  } catch (error) {
    console.error("Error fetching stock movements:", error);
    return {
      initialData: {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
      error: "Failed to load stock movements",
    };
  }
}

export default async function StockMovementsPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Check if user has permission to read stock movements
  const canReadStockMovements = await hasPermission("stock-movements.read");
  if (!canReadStockMovements) {
    redirect("/login");
  }

  // Fetch initial data
  const { initialData, error } = await getInitialData();

  return (
    <StockMovementsPageClient initialData={initialData} initialError={error} />
  );
}

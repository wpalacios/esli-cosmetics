import { Metadata } from "next";
import { getStockMovementsPreview } from "@/actions/reports";
import StockMovementsReportsPageClient from "./reports-page-client";
import type {
  ReportPreviewResponse,
  StockMovementsPreviewFilters,
  PaginatedStockMovements,
} from "@esli-cosmetics/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reports | Esli Cosmetics",
  description: "Preview and export stock movements reports",
};
async function getInitialPreview(): Promise<ReportPreviewResponse> {
  try {
    const filters = { page: 1, limit: 10 };

    const rawData = await getStockMovementsPreview(filters);

    return {
      fileName: "Stock Movements Report",
      sheets: [
        {
          name: "Movements",
          rows: rawData.data as any,
          columns: [],
        },
      ],
      pagination: {
        page: rawData.pagination.page,
        limit: rawData.pagination.limit,
        total: rawData.pagination.total,
        totalPages: rawData.pagination.totalPages,
      },
    };
  } catch (error) {
    return {
      fileName: "",
      sheets: [],
      pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
    };
  }
}

export default async function StockMovementsReportPage() {
  const initialPreview = await getInitialPreview();
  return <StockMovementsReportsPageClient initialPreview={initialPreview} />;
}

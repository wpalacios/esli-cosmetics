import { getCategories } from "@/actions";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { CategoriesResponse } from "@esli-cosmetics/types";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { CategoriesPageClient } from "./categories-page-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categories",
  description: "Manage your product categories and their hierarchy",
};

async function getCategoriesData(): Promise<any> {
  try {
    const data = await getCategories({ page: 1, limit: 10 });

    // Ensure data is JSON-serializable (dates as strings)
    return JSON.parse(JSON.stringify(data));
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
}

export default async function CategoriesPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadCategories = await hasPermission("categories.read");
  if (!canReadCategories) {
    redirect("/login");
  }

  const initialData = await getCategoriesData();

  return <CategoriesPageClient initialData={initialData} />;
}

import { Metadata } from "next";
import { BranchesPageClient } from "./branches-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getBranches } from "@/actions/branches";
import { BranchesResponse } from "@esli-cosmetics/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Branches | Esli Cosmetics",
  description: "Manage your store branches and locations",
};

// Server-side data fetching with authentication
async function getBranchesData(): Promise<BranchesResponse> {
  try {
    // Fetch data using server action
    const data = await getBranches({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch branches:", error);
    // Return empty data structure on error
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

export default async function BranchesPage() {
  // Check authentication first - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  // Then check if user has permission to read branches
  const canReadBranches = await hasPermission("branch.read");
  if (!canReadBranches) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getBranchesData();

  return <BranchesPageClient initialData={initialData} />;
}

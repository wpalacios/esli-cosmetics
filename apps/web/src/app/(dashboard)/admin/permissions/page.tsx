import { Metadata } from "next";
import { redirect } from "next/navigation";
import { PermissionsPageClient } from "./permissions-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getPermissions } from "@/actions/permissions";
import { PermissionsResponse } from "@esli-cosmetics/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Permissions | Esli Cosmetics",
  description: "Manage system permissions",
};

async function getPermissionsData(): Promise<PermissionsResponse> {
  try {
    const data = await getPermissions({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
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

export default async function PermissionsPage() {
  // Check authentication - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadPermissions = await hasPermission("system.roles");
  if (!canReadPermissions) {
    redirect("/login");
  }

  const initialData = await getPermissionsData();

  return <PermissionsPageClient initialData={initialData} />;
}

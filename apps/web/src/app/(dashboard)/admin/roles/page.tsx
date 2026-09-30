import { Metadata } from "next";
import { redirect } from "next/navigation";
import { RolesPageClient } from "./roles-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getRoles } from "@/actions/roles";
import { RolesResponse } from "@esli-cosmetics/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roles | Esli Cosmetics",
  description: "Manage system roles",
};

async function getRolesData(): Promise<RolesResponse> {
  try {
    const data = await getRoles({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch roles:", error);
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

export default async function RolesPage() {
  // Check authentication - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadRoles = await hasPermission("system.roles");
  if (!canReadRoles) {
    redirect("/login");
  }

  const initialData = await getRolesData();

  return <RolesPageClient initialData={initialData} />;
}

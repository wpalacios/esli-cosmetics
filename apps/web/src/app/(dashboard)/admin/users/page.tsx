import { Metadata } from "next";
import { redirect } from "next/navigation";
import { UsersPageClient } from "./users-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getUsers } from "@/actions/users";
import { UsersResponse } from "@esli-cosmetics/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Users | Esli Cosmetics",
  description: "Manage system users",
};

async function getUsersData(): Promise<UsersResponse> {
  try {
    const data = await getUsers({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch users:", error);
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

export default async function UsersPage() {
  // Check authentication - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadUsers = await hasPermission("users.read");
  if (!canReadUsers) {
    redirect("/login");
  }

  const initialData = await getUsersData();

  return <UsersPageClient initialData={initialData} />;
}

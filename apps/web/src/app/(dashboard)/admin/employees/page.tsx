import { Metadata } from "next";
import { redirect } from "next/navigation";
import { EmployeesPageClient } from "./employees-page-client";
import { hasPermission, shouldRedirectToLogin } from "@/lib/auth/server-auth";
import { getEmployees } from "@/actions";
import { EmployeesResponse } from "@esli-cosmetics/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Employees",
  description: "Manage your team members and their information",
};

// Server-side data fetching with authentication
async function getEmployeesData(): Promise<EmployeesResponse> {
  try {
    // Fetch data using server action
    const data = await getEmployees({ page: 1, limit: 10 });
    return data;
  } catch (error) {
    console.error("Failed to fetch employees:", error);
    // Return empty data structure on error
    return {
      employees: [],
      total: 0,
      page: 1,
      limit: 10,
    };
  }
}

export default async function EmployeesPage() {
  // Check authentication - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  const canReadEmployees = await hasPermission("employees.read");
  if (!canReadEmployees) {
    redirect("/login");
  }

  // Fetch data on the server
  const initialData = await getEmployeesData();

  return <EmployeesPageClient initialData={initialData} />;
}

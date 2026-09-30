import React from "react";
import { redirect } from "next/navigation";
import GuidelinesPlayground from "./_components/guidelines-playground";
import { shouldRedirectToLogin } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

export default async function GuidelinesPage() {
  // Check authentication - only redirect if no user AND no refresh token
  // Note: This page is typically for development/design purposes
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  return <GuidelinesPlayground />;
}

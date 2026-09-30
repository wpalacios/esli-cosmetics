import { Metadata } from "next";
import { redirect } from "next/navigation";
import { ProfilePageClient } from "./profile-page-client";
import { shouldRedirectToLogin } from "@/lib/auth/server-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile | Esli Cosmetics",
  description: "Manage your profile information",
};

export default async function ProfilePage() {
  // Check authentication - only redirect if no user AND no refresh token
  if (await shouldRedirectToLogin()) {
    redirect("/login");
  }

  return <ProfilePageClient />;
}

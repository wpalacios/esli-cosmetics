import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "../globals.css";

import {
  Providers,
  Toaster,
  SidebarProvider,
  Sidebar,
  Header,
} from "@/components";
import { MainContentWrapper } from "./_components/main-content-wrapper";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Esli Cosmetics",
    template: "%s | Esli Cosmetics",
  },
  description: "Esli Cosmetics Nicaragua",
  keywords: [
    "cosmetics",
    "beauty",
    "makeup",
    "retail",
    "inventory",
    "POS",
    "point of sale",
    "esli",
  ],
  authors: [
    {
      name: "Esli Cosmetics",
      url: "https://eslicosmetics.com",
    },
  ],
  creator: "Esli Cosmetics Team",
  publisher: "Esli Cosmetics",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://eslicosmetics.com"
  ),
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://eslicosmetics.com",
    siteName: "Esli Cosmetics",
    title: "Esli Cosmetics",
    description:
      "Modern cosmetics retail and inventory management system. Trendy, innovative, and accessible beauty solutions.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Esli Cosmetics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Esli Cosmetics",
    description:
      "Modern cosmetics retail and inventory management system. Trendy, innovative, and accessible beauty solutions.",
    images: ["/og-image.png"],
    creator: "@eslicosmetics",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

type RootLayoutProps = {
  children: React.ReactNode;
};

export default async function RootLayout({ children }: RootLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar />

        <div className="w-full bg-gray-50 dark:bg-gray-900">
          <Header />

          <MainContentWrapper>{children}</MainContentWrapper>
        </div>
      </div>
    </SidebarProvider>
  );
}

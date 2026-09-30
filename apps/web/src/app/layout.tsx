import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

import { cn } from "@esli-cosmetics/utils";
import Providers from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

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
    default: "Esli Cosmetics ",
    template: "%s | Esli Cosmetics",
  },
  description:
    "Modern cosmetics retail and inventory management system. Trendy, innovative, and accessible beauty solutions for the modern customer.",
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
  icons: {
    icon: "/assets/images/fav.ico",
    shortcut: "/assets/images/fav.ico",
    apple: "/assets/images/fav.ico",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://eslicosmetics.com"
  ),
  openGraph: {
    type: "website",
    locale: "es_CO",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "https://eslicosmetics.com",
    siteName: "Esli Cosmetics",
    title: "Esli Cosmetics",
    description: "Esli Cosmetics Nicaragua",
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
    description: "Esli Cosmetics Nicaragua",
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

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} ${inter.variable} light`}
      suppressHydrationWarning
    >
      <head />
      <body className="bg-background min-h-screen font-sans antialiased">
        <Providers>
          <div className="relative flex min-h-screen flex-col">{children}</div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

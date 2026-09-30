"use client";

import Image from "next/image";
import logoImage from "@/assets/images/logo.png";

import { LoginForm } from "./_components/login-form";
import { useTranslation } from "react-i18next";

export default function LoginPage() {
  const { t } = useTranslation("login");

  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Animated Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-secondary-100 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        {/* Decorative Circles */}
        <div className="absolute -right-24 -top-24 h-96 w-96 animate-pulse rounded-full bg-primary-200 opacity-30 blur-3xl" />
        <div className="absolute -left-32 top-1/2 h-80 w-80 animate-pulse rounded-full bg-secondary-200 opacity-20 blur-3xl delay-1000" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 animate-pulse rounded-full bg-primary-100 opacity-25 blur-3xl delay-500" />
      </div>

      {/* Content Container */}
      <div className="relative z-10 flex w-full items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Logo & Brand Section */}
          <div className="animate-slide-down mb-8 text-center">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse rounded-3xl bg-primary-400 opacity-40 blur-xl" />
                <div className="relative rounded-3xl bg-white p-6 shadow-elevation-lg dark:bg-gray-900">
                  <Image
                    src={logoImage}
                    alt="ESLI Cosmetics Logo"
                    width={80}
                    height={80}
                    className="h-20 w-20"
                    priority
                  />
                </div>
              </div>
            </div>

            <h1 className="mb-2 bg-gradient-to-r from-primary-500 to-primary-700 bg-clip-text font-heading text-4xl font-bold text-transparent">
              {t("welcomeTitle")}
            </h1>

            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {t("welcomeSubtitle")}
            </p>
          </div>

          {/* Login Card */}
          <div className="animate-scale-in relative">
            {/* Glass Effect Background */}
            <div className="absolute inset-0 rounded-3xl border border-white/20 bg-white/60 shadow-glass backdrop-blur-xl dark:border-gray-700/40 dark:bg-gray-900/60" />

            {/* Card Content */}
            <div className="relative z-10 p-8 sm:p-10">
              <div className="mb-6 text-center">
                <h2 className="mb-2 text-2xl font-semibold text-neutral-800 dark:text-white">
                  {t("title")}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {t("subtitle")}
                </p>
              </div>

              <LoginForm />
            </div>
          </div>

          {/* Footer Text */}
          <p className="animate-fade-in mt-6 text-center text-xs text-neutral-400 dark:text-neutral-500">
            © 2025 ESLI Cosmetics. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Floating Decorative Elements */}
      <div className="absolute left-10 top-20 hidden h-9 w-9 animate-bounce rounded-full bg-primary-300 opacity-60 lg:block" />
      <div className="absolute right-20 top-40 hidden h-6 w-6 animate-bounce rounded-full bg-secondary-400 opacity-60 delay-300 lg:block" />
      <div className="absolute bottom-32 left-1/4 hidden h-4 w-4 animate-bounce rounded-full bg-primary-200 opacity-60 delay-700 lg:block" />
    </div>
  );
}

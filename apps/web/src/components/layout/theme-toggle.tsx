"use client";

import * as Switch from "@radix-ui/react-switch";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { MoonIcon, SunIcon } from "./header-icons";

export function ThemeToggle() {
  const { t } = useTranslation("layout");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsDark(theme === "dark");
  }, [theme]);

  const handleToggle = (checked: boolean) => {
    setIsDark(checked);
    setTheme(checked ? "dark" : "light");
  };

  if (!mounted) {
    return (
      <div className="flex items-center space-x-2">
        <SunIcon className="h-4 w-4 text-gray-400" />
        <Switch.Root
          checked={false}
          disabled
          className="switch-root cursor-not-allowed opacity-50"
        >
          <Switch.Thumb className="switch-thumb" />
        </Switch.Root>
        <MoonIcon className="h-4 w-4 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <SunIcon
        className={`h-4 w-4 transition-colors ${!isDark ? "text-yellow-500" : "text-gray-400"}`}
      />
      <Switch.Root
        checked={isDark}
        onCheckedChange={handleToggle}
        className="switch-root"
      >
        <Switch.Thumb className="switch-thumb" />
      </Switch.Root>
      <MoonIcon
        className={`h-4 w-4 transition-colors ${isDark ? "text-blue-500" : "text-gray-400"}`}
      />
      <span className="sr-only">{t("theme.toggle")}</span>
    </div>
  );
}

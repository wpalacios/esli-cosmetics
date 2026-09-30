"use client";

import { useTranslation } from "react-i18next";
import { SearchIcon, MenuIcon } from "./header-icons";
import { useSidebarContext } from "./sidebar-context";
import { ThemeToggle } from "./theme-toggle";
import { Notification } from "./notification";
import { UserInfo } from "./user-info";

export function Header() {
  const { t } = useTranslation("layout");
  const { toggleSidebar, isMobile } = useSidebarContext();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200 bg-white p-2 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:px-5">
      <button
        onClick={toggleSidebar}
        className="mr-8 rounded-lg border border-gray-200 px-1.5 py-1 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        <MenuIcon className="h-5 w-5" />
        <span className="sr-only">{t("header.toggleSidebar")}</span>
      </button>

      {isMobile && (
        <div className="ml-2 flex items-center space-x-2 max-[430px]:hidden min-[375px]:ml-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-primary-600">
            <span className="text-sm font-bold text-white">E</span>
          </div>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            Esli Cosmetics
          </span>
        </div>
      )}

      <div className="flex flex-1 items-center justify-end gap-2 min-[375px]:gap-4">
        {/* TODO: Add search bar if needed */}
        {/* <div className="relative w-full max-w-[300px]">
          <input
            type="search"
            placeholder="Search products, orders, customers..."
            className="flex w-full items-center gap-3.5 rounded-full border border-gray-200 bg-gray-50 py-3 pl-[53px] pr-5 text-sm outline-none transition-colors focus:border-primary-500 focus:bg-white focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400 dark:focus:border-primary-500 dark:focus:bg-gray-700"
          />
          <SearchIcon className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        </div> */}

        <ThemeToggle />
        <Notification />
        <div className="shrink-0">
          <UserInfo />
        </div>
      </div>
    </header>
  );
}

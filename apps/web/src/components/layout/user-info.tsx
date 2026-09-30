"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "@esli-cosmetics/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@esli-cosmetics/ui";
import {
  ChevronDownIcon,
  UserIcon,
  SettingsIcon,
  LogOutIcon,
} from "./header-icons";
import { cn } from "@esli-cosmetics/utils";
import { useAuth } from "@/lib/auth/auth-provider";

export function UserInfo() {
  const { t } = useTranslation("layout");
  const [isOpen, setIsOpen] = useState(false);
  const { session, signOut } = useAuth();

  // Get user name from person data if available, otherwise derive from email
  const getUserName = () => {
    if (session?.person?.firstName) {
      return `${session.person.firstName} ${session.person.lastName || ""}`.trim();
    }
    return session?.user?.email?.split("@")[0] || "User";
  };

  const USER = {
    name: getUserName(),
    email: session?.user?.email || "user@example.com",
    img: "/placeholder-avatar.svg",
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-3 rounded-lg p-1 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:hover:bg-gray-800">
          <div className="hidden text-right md:block">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {USER.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {USER.email}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Avatar
              src={USER.img}
              name={USER.name}
              size="sm"
              className="cursor-pointer"
            />
            <ChevronDownIcon
              className={cn(
                "h-4 w-4 text-gray-600 transition-transform dark:text-gray-300",
                isOpen && "rotate-180"
              )}
            />
          </div>
          <span className="sr-only">{t("userMenu.menuLabel")}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-80 border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
        align="end"
        sideOffset={5}
      >
        <div className="p-4">
          <div className="flex items-center space-x-3">
            <Avatar src={USER.img} name={USER.name} size="md" />
            <div className="space-y-1">
              <div className="text-base font-medium text-gray-900 dark:text-white">
                {USER.name}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {USER.email}
              </div>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />

        <div className="p-2">
          <DropdownMenuItem asChild>
            <a
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex w-full cursor-pointer items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <UserIcon className="h-4 w-4" />
              <span>{t("userMenu.viewProfile")}</span>
            </a>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />

        <div className="p-2">
          <DropdownMenuItem asChild>
            <button
              onClick={async () => {
                setIsOpen(false);
                await signOut();
              }}
              className="flex w-full cursor-pointer items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <LogOutIcon className="h-4 w-4" />
              <span>{t("userMenu.logout")}</span>
            </button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

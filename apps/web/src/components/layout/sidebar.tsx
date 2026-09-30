"use client";

import { cn } from "@esli-cosmetics/utils";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import logoImage from "@/assets/images/logo.png";

import { NAV_DATA } from "./sidebar-data";
import type { SidebarItem } from "./sidebar-data";
import {
  ArrowLeftIcon,
  ChevronUpIcon,
  iconMap,
  TagIcon,
} from "./sidebar-icons";
import { useSidebarContext } from "./sidebar-context";
import { MenuItem } from "./menu-item";
import { useAuth } from "@/lib/auth/auth-provider";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { setIsOpen, isOpen, isMobile, toggleSidebar } = useSidebarContext();
  const { session, loading } = useAuth();

  const userPermissions = useMemo(
    () => new Set(session?.permissions?.map(p => p.key) ?? []),
    [session?.permissions]
  );

  const filteredNavData = useMemo(() => {
    return NAV_DATA.map(section => ({
      ...section,
      items: section.items
        .map((item): SidebarItem | null => {
          if (item.items.length === 0) {
            if (
              !item.requiredPermission ||
              userPermissions.has(item.requiredPermission)
            ) {
              return item;
            }
            return null;
          }
          const visibleSubItems = item.items.filter(
            subItem =>
              !subItem.requiredPermission ||
              userPermissions.has(subItem.requiredPermission)
          );
          if (visibleSubItems.length === 0) return null;
          return { ...item, items: visibleSubItems };
        })
        .filter((item): item is SidebarItem => item !== null),
    })).filter(section => section.items.length > 0);
  }, [userPermissions]);

  // All hooks must be called before any conditional returns
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // Initialize with all items that have subitems expanded by default
    return filteredNavData.flatMap(section =>
      section.items
        .filter(item => item.items.length > 0)
        .map(item => item.titleKey)
    );
  });

  const toggleExpanded = (titleKey: string) => {
    setExpandedItems(prev =>
      prev.includes(titleKey)
        ? prev.filter(item => item !== titleKey)
        : [...prev, titleKey]
    );
  };

  useEffect(() => {
    if (isMobile) setIsOpen(false);

    for (const section of filteredNavData) {
      for (const item of section.items) {
        if (item.items.some(sub => sub.url === pathname)) {
          setExpandedItems(prev =>
            prev.includes(item.titleKey) ? prev : [...prev, item.titleKey]
          );
          return;
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Show loading spinner only while actively loading
  // Once loading completes (even if session is null), render the sidebar
  // This prevents the sidebar from being stuck in loading state forever
  if (loading || !session) {
    return (
      <aside
        className={cn(
          "overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 ease-linear dark:border-gray-800 dark:bg-gray-900",
          isMobile
            ? "fixed bottom-0 top-0 z-20 w-0 max-w-[290px]"
            : "sticky top-0 h-screen",
          !isMobile && (isOpen ? "w-[290px] min-w-[290px]" : "w-16 min-w-16")
        )}
      >
        {!isMobile && (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary-500 border-r-transparent" />
          </div>
        )}
      </aside>
    );
  }

  // If no session after loading completes, render sidebar with empty navigation
  // This is better than showing a spinner forever or hiding the sidebar completely
  // The middleware will handle redirecting to login if needed

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-10 bg-black/50 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          "overflow-hidden border-r border-gray-200 bg-white transition-[width] duration-200 ease-linear dark:border-gray-800 dark:bg-gray-900",
          isMobile
            ? "fixed bottom-0 top-0 z-20 max-w-[290px]"
            : "sticky top-0 h-screen",
          isMobile
            ? isOpen
              ? "w-full"
              : "w-0"
            : isOpen
              ? "w-[290px] min-w-[290px]"
              : "w-16 min-w-16"
        )}
        aria-label="Main navigation"
        aria-hidden={!isOpen && isMobile}
        inert={!isOpen && isMobile}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col py-2.5 transition-all duration-200",
            !isOpen && "!pt-[.825rem] pl-2"
          )}
        >
          <div className={cn("relative", isOpen ? "pr-4.5" : "pr-0")}>
            {!isMobile && (
              <Link href="/" className={cn("flex items-center justify-center")}>
                <div
                  className={`${isOpen ? "size-16" : "size-8"} flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white`}
                >
                  <Image
                    src={logoImage}
                    alt="ESLI Cosmetics Logo"
                    width={64}
                    height={64}
                    className="h-full w-full object-contain"
                  />
                </div>
              </Link>
            )}
          </div>

          {/* Navigation */}
          <div
            className={cn(
              "custom-scrollbar mt-6 flex-1 overflow-y-auto min-[850px]:mt-10",
              isOpen ? "pl-6 pr-3" : "pr-0",
              isMobile && "mt-20"
            )}
          >
            {filteredNavData.map(section => (
              <div key={section.labelKey} className="mb-6">
                {isOpen && (
                  <h2 className="mb-5 text-sm font-medium text-gray-500 dark:text-gray-400">
                    {t(section.labelKey)}
                  </h2>
                )}

                <nav role="navigation" aria-label={t(section.labelKey)}>
                  <ul className="space-y-2">
                    {section.items.map(item => {
                      const IconComponent =
                        iconMap[item.icon as keyof typeof iconMap];

                      return (
                        <li key={item.titleKey}>
                          {item.items.length ? (
                            <div>
                              <MenuItem
                                isActive={item.items.some(
                                  ({ url }) => url === pathname
                                )}
                                onClick={() => {
                                  if (!isOpen && !isMobile) {
                                    setIsOpen(true);
                                  }
                                  toggleExpanded(item.titleKey);
                                }}
                                className={cn(
                                  !isOpen && !isMobile && "justify-center px-2"
                                )}
                                {...(!isOpen && { title: t(item.titleKey) })}
                              >
                                <IconComponent
                                  className="size-6 shrink-0"
                                  aria-hidden="true"
                                />
                                {isOpen && (
                                  <>
                                    <span className="min-w-0 flex-1 whitespace-nowrap text-left">
                                      {t(item.titleKey)}
                                    </span>
                                    <ChevronUpIcon
                                      className={cn(
                                        "ml-auto h-4 w-4 shrink-0 rotate-180 transition-transform duration-200",
                                        expandedItems.includes(item.titleKey) &&
                                          "rotate-0"
                                      )}
                                      aria-hidden="true"
                                    />
                                  </>
                                )}
                              </MenuItem>

                              {isOpen &&
                                expandedItems.includes(item.titleKey) && (
                                  <ul
                                    className="ml-9 mr-0 space-y-1.5 pb-[15px] pr-0 pt-2"
                                    role="menu"
                                  >
                                    {item.items.map(subItem => (
                                      <li key={subItem.titleKey} role="none">
                                        <MenuItem
                                          as="link"
                                          href={subItem.url}
                                          isActive={pathname === subItem.url}
                                        >
                                          <span className="min-w-0 whitespace-nowrap">
                                            {t(subItem.titleKey)}
                                          </span>
                                        </MenuItem>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                            </div>
                          ) : (
                            (() => {
                              const href =
                                item.url ||
                                `/${t(item.titleKey).toLowerCase().split(" ").join("-")}`;

                              return (
                                <MenuItem
                                  className={cn(
                                    "flex items-center gap-3 py-3",
                                    !isOpen &&
                                      !isMobile &&
                                      "justify-center px-2"
                                  )}
                                  as="link"
                                  href={href}
                                  isActive={pathname === href}
                                  {...(!isOpen && { title: t(item.titleKey) })}
                                >
                                  <IconComponent
                                    className="size-6 shrink-0"
                                    aria-hidden="true"
                                  />
                                  {isOpen && (
                                    <span className="min-w-0 whitespace-nowrap">
                                      {t(item.titleKey)}
                                    </span>
                                  )}
                                </MenuItem>
                              );
                            })()
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
}

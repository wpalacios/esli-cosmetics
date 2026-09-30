"use client";

import { cn } from "@esli-cosmetics/utils";
import Link from "next/link";
import { forwardRef } from "react";

type MenuItemProps = {
  children: React.ReactNode;
  className?: string;
  isActive?: boolean;
  as?: "button" | "link";
  href?: string;
  onClick?: () => void;
  title?: string;
};

const MenuItem = forwardRef<
  HTMLButtonElement | HTMLAnchorElement,
  MenuItemProps
>(
  (
    {
      children,
      className,
      isActive = false,
      as = "button",
      href,
      onClick,
      title,
      ...props
    },
    ref
  ) => {
    const baseClasses = cn(
      "flex w-full min-w-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200",
      "hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/20 dark:hover:text-primary-300",
      isActive
        ? "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
        : "text-gray-700 dark:text-gray-300",
      className
    );

    if (as === "link" && href) {
      return (
        <Link
          ref={ref as React.ForwardedRef<HTMLAnchorElement>}
          href={href as any}
          className={baseClasses}
          title={title}
        >
          {children as any}
        </Link>
      );
    }

    return (
      <button
        ref={ref as React.ForwardedRef<HTMLButtonElement>}
        type="button"
        onClick={onClick}
        className={baseClasses}
        title={title}
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
      >
        {children as any}
      </button>
    );
  }
);

MenuItem.displayName = "MenuItem";

export { MenuItem };

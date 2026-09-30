import { forwardRef } from "react";

import { cn } from "@esli-cosmetics/utils";
import { Avatar } from "../atoms/avatar";
import { Button } from "../atoms/button";

type NavItem = {
  key: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  active?: boolean;
};

type NavbarProps = React.HTMLAttributes<HTMLElement> & {
  brand?: React.ReactNode;
  items?: NavItem[];
  actions?: React.ReactNode;
  user?: {
    name?: string;
    email?: string;
    avatar?: string;
  };
  onProfileClick?: () => void;
  onLogout?: () => void;
};

const Navbar = forwardRef<HTMLElement, NavbarProps>(
  (
    {
      className,
      brand,
      items = [],
      actions,
      user,
      onProfileClick,
      onLogout,
      ...props
    },
    ref
  ) => {
    return (
      <nav
        ref={ref}
        className={cn(
          "sticky top-0 z-40 w-full border-b border-neutral-200 bg-white/80 backdrop-blur-lg dark:border-neutral-800 dark:bg-neutral-900/80",
          className
        )}
        {...props}
      >
        <div className="flex h-16 items-center px-6">
          {/* Brand */}
          {brand && <div className="flex items-center space-x-4">{brand}</div>}

          {/* Navigation Items */}
          {items.length > 0 && (
            <div className="flex items-center space-x-1 ml-6">
              {items.map(item => (
                <Button
                  key={item.key}
                  variant={item.active ? "secondary" : "ghost"}
                  size="sm"
                  className="relative"
                  onClick={item.onClick}
                >
                  {item.icon}
                  {item.label}
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-500 text-xs text-white">
                      {item.badge}
                    </span>
                  )}
                </Button>
              ))}
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          {actions && (
            <div className="flex items-center space-x-2 mr-4">{actions}</div>
          )}

          {/* User Profile */}
          {user && (
            <div className="flex items-center space-x-3">
              <div className="hidden md:block text-right">
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {user.name}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {user.email}
                </p>
              </div>
              <Avatar
                {...(user.avatar && { src: user.avatar })}
                {...(user.name && { name: user.name })}
                size="sm"
                className="cursor-pointer"
                onClick={onProfileClick}
              />
            </div>
          )}
        </div>
      </nav>
    );
  }
);

Navbar.displayName = "Navbar";

export { Navbar };
export type { NavbarProps, NavItem };

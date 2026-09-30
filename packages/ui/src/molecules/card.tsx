import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@esli-cosmetics/utils";
import type { CardProps as BaseCardProps } from "@esli-cosmetics/types";

const cardVariants = cva(
  "rounded-2xl border bg-white text-neutral-900 shadow-sm transition-all dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700",
  {
    variants: {
      variant: {
        default: "border-neutral-200",
        glass:
          "glass border-neutral-200/20 bg-white/80 backdrop-blur-lg dark:bg-neutral-800/80 dark:border-neutral-700/20",
        gradient:
          "bg-gradient-to-br from-primary-50 to-secondary-50 border-primary-200/50 dark:from-primary-900/20 dark:to-secondary-900/20",
        bordered: "border-2 border-neutral-300 dark:border-neutral-600",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-6",
        lg: "p-8",
      },
      hover: {
        none: "",
        lift: "hover:shadow-lg hover:-translate-y-1",
        glow: "hover:shadow-lg hover:shadow-primary-200/50 hover:border-primary-300/50 dark:hover:shadow-primary-800/20",
        scale: "hover:scale-105",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
      hover: "none",
    },
  }
);

type CardProps = BaseCardProps &
  React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof cardVariants> & {
    title?: string;
    subtitle?: string;
    header?: React.ReactNode;
    footer?: React.ReactNode;
    clickable?: boolean;
  };

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      variant,
      padding,
      hover,
      title,
      subtitle,
      header,
      footer,
      clickable,
      children,
      onClick,
      ...props
    },
    ref
  ) => {
    const hoverVariant = clickable && !hover ? "lift" : hover;

    return (
      <div
        ref={ref}
        className={cn(
          cardVariants({ variant, padding, hover: hoverVariant }),
          clickable && "cursor-pointer",
          className
        )}
        onClick={onClick}
        {...props}
      >
        {/* Header Section */}
        {(header ?? title ?? subtitle) && (
          <div className={cn("mb-4", padding === "none" && "p-6 pb-4")}>
            {header ?? (
              <>
                {title && (
                  <h3 className="text-lg font-semibold leading-none tracking-tight">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
                    {subtitle}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "flex-1",
            padding === "none" && (title ?? subtitle ?? header) && "px-6",
            padding === "none" && footer && "pb-0"
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div
            className={cn(
              "mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700",
              padding === "none" && "px-6 pb-6"
            )}
          >
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = "Card";

export { Card, cardVariants };
export type { CardProps };

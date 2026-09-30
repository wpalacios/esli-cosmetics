import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@esli-cosmetics/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        primary:
          "border-transparent bg-primary-500 text-primary-foreground shadow",
        secondary:
          "border-transparent bg-secondary-100 text-secondary-800 dark:bg-secondary-900/30 dark:text-secondary-300",
        success:
          "border-transparent bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300",
        warning:
          "border-transparent bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300",
        error:
          "border-transparent bg-error-100 text-error-800 dark:bg-error-900/30 dark:text-error-300",
        outline:
          "border-neutral-200 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300",
        neutral:
          "border-transparent bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-100",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        md: "px-2.5 py-0.5 text-xs",
        lg: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type BadgeProps = React.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof badgeVariants> & {
    children: React.ReactNode;
  };

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

export { Badge, badgeVariants };
export type { BadgeProps };

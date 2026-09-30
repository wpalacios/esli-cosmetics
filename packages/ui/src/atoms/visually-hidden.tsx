import React from "react";
import { cn } from "@esli-cosmetics/utils";

type VisuallyHiddenProps = {
  as?: React.ElementType;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>;

/**
 * VisuallyHidden component for accessibility
 * Hides content visually but keeps it available for screen readers
 */
export const VisuallyHidden = React.forwardRef<
  HTMLElement,
  VisuallyHiddenProps
>(({ as: Component = "span", className, children, ...props }, ref) => {
  return React.createElement(
    Component as React.ElementType,
    {
      ref,
      className: cn("sr-only", className),
      ...props,
    } as React.HTMLAttributes<HTMLElement>,
    children
  );
});

VisuallyHidden.displayName = "VisuallyHidden";

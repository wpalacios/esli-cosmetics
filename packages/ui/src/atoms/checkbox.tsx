"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { AiOutlineCheck } from "react-icons/ai";
import { cn } from "@esli-cosmetics/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded border border-gray-300 shadow-sm transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-primary-500 data-[state=checked]:to-secondary-500 data-[state=checked]:border-primary-500 data-[state=checked]:text-white",
      "hover:border-primary-400 hover:scale-105 active:scale-95",
      "dark:border-gray-600 dark:focus-visible:ring-primary-400 dark:focus-visible:ring-offset-gray-900",
      className
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={cn("flex items-center justify-center text-current")}
    >
      {React.createElement(AiOutlineCheck as React.ElementType, {
        className: "h-3.5 w-3.5 font-bold",
      })}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };

import React, { forwardRef } from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cva, type VariantProps } from "class-variance-authority";
import { AiOutlineUser } from "react-icons/ai";

import { cn } from "@esli-cosmetics/utils";
import { getInitials } from "@esli-cosmetics/utils/lib/string";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-xs",
        sm: "h-8 w-8 text-sm",
        md: "h-10 w-10",
        lg: "h-12 w-12 text-lg",
        xl: "h-16 w-16 text-xl",
        "2xl": "h-20 w-20 text-2xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const avatarImageVariants = cva("aspect-square h-full w-full object-cover");

const avatarFallbackVariants = cva(
  "flex h-full w-full items-center justify-center rounded-full bg-neutral-100 text-neutral-600 font-medium dark:bg-neutral-800 dark:text-neutral-300",
  {
    variants: {
      size: {
        xs: "text-xs",
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
        xl: "text-lg",
        "2xl": "text-xl",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

type AvatarProps = React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> &
  VariantProps<typeof avatarVariants> & {
    src?: string;
    alt?: string;
    name?: string;
    fallback?: React.ReactNode;
  };

const Avatar = forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, src, alt, name, fallback, ...props }, ref) => {
  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    >
      {src && (
        <AvatarPrimitive.Image
          src={src}
          alt={alt ?? name ?? "Avatar"}
          className={avatarImageVariants()}
        />
      )}
      <AvatarPrimitive.Fallback
        className={cn(avatarFallbackVariants({ size }))}
        delayMs={600}
      >
        {fallback ??
          (name
            ? getInitials(name)
            : React.createElement(AiOutlineUser as React.ElementType, {
                className: "h-1/2 w-1/2",
              }))}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
});

Avatar.displayName = AvatarPrimitive.Root.displayName;

export { Avatar };
export type { AvatarProps };

import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { cn } from "@esli-cosmetics/utils";
import type { ButtonProps as BaseButtonProps } from "@esli-cosmetics/types";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-primary-500 to-secondary-500 hover:from-primary-500 hover:to-primary-500 text-white shadow transform hover:scale-105 active:scale-95 focus-visible:ring-primary-200 dark:focus-visible:ring-primary-800 disabled:hover:scale-100",
        secondary:
          "bg-primary-500 text-white shadow-sm transform hover:scale-105 active:scale-95 focus-visible:ring-secondary-200 dark:focus-visible:ring-secondary-800 disabled:hover:scale-100",
        accent:
          "bg-gradient-to-r text-white from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 hover:scale-105 active:scale-95",
        success:
          "bg-success-600 text-white shadow hover:bg-success-700 active:scale-95 focus-visible:ring-success-200 dark:focus-visible:ring-success-800 hover:scale-105 active:scale-95",
        warning:
          "bg-warning-600 text-white shadow hover:bg-warning-700 active:scale-95 focus-visible:ring-warning-200 dark:focus-visible:ring-warning-800 hover:scale-105 active:scale-95",
        error:
          "bg-error-600 text-white shadow hover:bg-error-700 active:scale-95 focus-visible:ring-error-200 dark:focus-visible:ring-error-800 hover:scale-105 active:scale-95",
        ghost:
          "text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 focus-visible:ring-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700 hover:scale-105 active:scale-95",
        outline:
          "border border-primary-500 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50 active:bg-neutral-100 focus-visible:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 hover:scale-105 active:scale-95",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-4 text-sm",
        md: "h-10 px-6 text-sm",
        lg: "h-11 px-8 text-base",
        xl: "h-12 px-10 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

type ButtonProps = BaseButtonProps &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    loading?: boolean;
    loadingText?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    fullWidth?: boolean;
  };

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      loadingText,
      leftIcon,
      rightIcon,
      fullWidth,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button";

    const isDisabled = disabled ?? loading;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LoadingIcon = AiOutlineLoading3Quarters as any;

    // When using asChild with Slot, we need a single child element
    // So we wrap everything in a span when asChild is true
    const content = loading ? (
      <>
        <LoadingIcon className="animate-spin" />
        {loadingText && <span>{loadingText}</span>}
      </>
    ) : (
      <>
        {leftIcon}
        {children}
        {rightIcon}
      </>
    );

    // If asChild is true, wrap content in a single element for Slot
    const slotContent = asChild ? <span>{content}</span> : content;

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size }),
          fullWidth && "w-full",
          className
        )}
        ref={ref}
        disabled={isDisabled}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {...(props as any)}
      >
        {slotContent}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };
export type { ButtonProps };

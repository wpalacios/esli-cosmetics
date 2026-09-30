import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@esli-cosmetics/utils";
import type { InputProps as BaseInputProps } from "@esli-cosmetics/types";

const inputVariants = cva(
  "flex w-full rounded-xl border bg-white dark:bg-neutral-800 px-4 py-3 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-neutral-200 focus-visible:ring-primary-200 focus-visible:border-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-400",
        error:
          "border-error-300 focus-visible:ring-error-200 focus-visible:border-error-500 text-error-900 placeholder:text-error-400 dark:text-error-300 dark:border-error-600 dark:placeholder:text-error-500",
        success:
          "border-success-300 focus-visible:ring-success-200 focus-visible:border-success-500 text-success-900 dark:text-success-300 dark:border-success-600",
      },
      size: {
        xs: "h-8 px-3 text-xs",
        sm: "h-9 px-3 text-base",
        md: "h-10 px-4",
        lg: "h-11 px-4 text-base",
        xl: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

type InputProps = Omit<BaseInputProps, "size"> &
  VariantProps<typeof inputVariants> & {
    label?: string;
    helperText?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    containerClassName?: string;
  };

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      variant,
      size,
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const finalVariant = hasError ? "error" : variant;

    return (
      <div className={cn("w-full", containerClassName)}>
        {label && (
          <label className="block text-base font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {leftIcon}
            </div>
          )}

          <input
            className={cn(
              inputVariants({ variant: finalVariant, size }),
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            ref={ref}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            {...(props as any)}
            onScroll={e => e.currentTarget.blur()}
            onWheel={e => e.currentTarget.blur()}
          />

          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400">
              {rightIcon}
            </div>
          )}
        </div>

        {(error ?? helperText) && (
          <p
            className={cn(
              "mt-1 text-xs",
              error ? "text-error-600" : "text-neutral-500"
            )}
          >
            {error ?? helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input, inputVariants };
export type { InputProps };

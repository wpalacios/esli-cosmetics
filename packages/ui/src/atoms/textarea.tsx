"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@esli-cosmetics/utils";

const textareaVariants = cva(
  "flex min-h-[80px] w-full rounded-xl border bg-white px-4 py-3 text-base transition-colors placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y",
  {
    variants: {
      variant: {
        default:
          "border-neutral-200 focus-visible:ring-primary-200 focus-visible:border-primary-500 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-400",
        error:
          "border-error-300 focus-visible:ring-error-200 focus-visible:border-error-500 text-error-900 placeholder:text-error-400",
        success:
          "border-success-300 focus-visible:ring-success-200 focus-visible:border-success-500 text-success-900",
      },
      size: {
        sm: "min-h-[60px] px-3 py-2 text-sm",
        md: "min-h-[80px] px-4 py-3",
        lg: "min-h-[100px] px-4 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export type TextareaProps = {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement> &
  VariantProps<typeof textareaVariants>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      containerClassName,
      variant,
      size,
      label,
      helperText,
      error,
      ...props
    },
    ref
  ) => {
    const hasError = !!error;
    const finalVariant = hasError ? "error" : variant;

    return (
      <div className={cn("w-full", containerClassName)}>
        {label && (
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {label}
            {props.required && <span className="text-error-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          className={cn(
            textareaVariants({ variant: finalVariant, size }),
            className
          )}
          ref={ref}
          {...props}
        />
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
Textarea.displayName = "Textarea";

export { Textarea, textareaVariants };

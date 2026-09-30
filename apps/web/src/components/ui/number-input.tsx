"use client";

import React, { forwardRef, useCallback } from "react";
import { Input, InputProps } from "@esli-cosmetics/ui";
import { BiPlus, BiMinus } from "react-icons/bi";
import { cn } from "@esli-cosmetics/utils";

interface NumberInputProps extends Omit<InputProps, "onChange" | "value"> {
  value?: number | string;
  onChange?: (value: number) => void;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    { value, onChange, className, step, min, max, disabled = false, ...props },
    ref
  ) => {
    const numericValue =
      typeof value === "string" ? Number.parseFloat(value) || 0 : value || 0;
    const stepValue = Number.parseFloat(step as string) || 0.01;
    const minValue =
      min !== undefined ? Number.parseFloat(min as string) : undefined;
    const maxValue =
      max !== undefined ? Number.parseFloat(max as string) : undefined;

    const handleIncrement = useCallback(() => {
      if (disabled) return;
      const newValue = numericValue + stepValue;
      const clampedValue =
        maxValue !== undefined ? Math.min(newValue, maxValue) : newValue;
      onChange?.(Number.parseFloat(clampedValue.toFixed(2)));
    }, [numericValue, stepValue, maxValue, disabled, onChange]);

    const handleDecrement = useCallback(() => {
      if (disabled) return;
      const newValue = numericValue - stepValue;
      const clampedValue =
        minValue !== undefined ? Math.max(newValue, minValue) : newValue;
      onChange?.(Number.parseFloat(clampedValue.toFixed(2)));
    }, [numericValue, stepValue, minValue, disabled, onChange]);

    const canIncrement = maxValue === undefined || numericValue < maxValue;
    const canDecrement = minValue === undefined || numericValue > minValue;

    return (
      <div className={cn("relative flex items-center", className)}>
        {/* Decrement Button */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            handleDecrement();
          }}
          disabled={disabled || !canDecrement}
          className={cn(
            "absolute left-0 z-10 flex h-full items-center justify-center px-2",
            "text-gray-600 hover:text-gray-900 active:bg-gray-100",
            "dark:text-gray-400 dark:hover:text-gray-200 dark:active:bg-gray-700",
            "transition-colors duration-150",
            "disabled:cursor-not-allowed disabled:opacity-30",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
            "rounded-l-md"
          )}
          aria-label="Decrease value"
        >
          <BiMinus className="h-4 w-4" />
        </button>

        {/* Input Field */}
        <Input
          {...props}
          ref={ref}
          type="number"
          value={value}
          onChange={e => {
            const numValue = Number(e.target.value);
            onChange?.(Number.parseFloat(numValue.toFixed(2)));
          }}
          step={step || "0.01"}
          min={min || "0"}
          max={max}
          disabled={disabled}
          onWheel={e => e.currentTarget.blur()}
          onScroll={e => e.currentTarget.blur()}
          className={cn(
            "pl-8 pr-8 text-center",
            // Hide native spinner on all browsers
            "[appearance:textfield]",
            "[&::-webkit-outer-spin-button]:appearance-none",
            "[&::-webkit-inner-spin-button]:appearance-none"
          )}
        />

        {/* Increment Button */}
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            handleIncrement();
          }}
          disabled={disabled || !canIncrement}
          className={cn(
            "absolute right-0 z-10 flex h-full items-center justify-center px-2",
            "text-gray-600 hover:text-gray-900 active:bg-gray-100",
            "dark:text-gray-400 dark:hover:text-gray-200 dark:active:bg-gray-700",
            "transition-colors duration-150",
            "disabled:cursor-not-allowed disabled:opacity-30",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1",
            "rounded-r-md"
          )}
          aria-label="Increase value"
        >
          <BiPlus className="h-4 w-4" />
        </button>
      </div>
    );
  }
);

NumberInput.displayName = "NumberInput";

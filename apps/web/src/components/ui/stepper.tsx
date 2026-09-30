"use client";

import * as React from "react";
import { CheckIcon } from "@radix-ui/react-icons";
import { cn } from "@esli-cosmetics/utils";

interface Step {
  label: string;
  icon: React.ReactNode;
}

interface StepperProps {
  currentStep: number;
  steps: Step[];
  className?: string;
  onStepClick?: (stepNumber: number) => void;
}

export function Stepper({
  currentStep,
  steps,
  className,
  onStepClick,
}: StepperProps) {
  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-between",
        className
      )}
    >
      <div className="absolute left-0 top-5 -z-0 h-[2px] w-full bg-gray-100 dark:bg-gray-800" />

      <div
        className="absolute left-0 top-5 -z-0 h-[2px] bg-pink-500 transition-all duration-500 ease-in-out"
        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
      />

      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isActive = stepNumber === currentStep;
        const isCompleted = stepNumber < currentStep;
        const isClickable = typeof onStepClick === "function";
        return (
          <div
            key={index}
            className={cn(
              "relative z-10 flex flex-col items-center gap-3",
              isClickable && "group cursor-pointer"
            )}
            onClick={() => isClickable && onStepClick?.(stepNumber)}
            tabIndex={isClickable ? 0 : -1}
            role={isClickable ? "button" : undefined}
            aria-current={isActive ? "step" : undefined}
          >
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300",
                "bg-white dark:bg-gray-950",
                isActive &&
                  "scale-110 border-pink-600 bg-pink-50 text-pink-600 shadow-md ring-4 ring-pink-50 dark:ring-pink-900/20",
                isCompleted && "border-pink-600 bg-pink-600 text-white",
                !isActive && !isCompleted && "border-gray-200 text-gray-400",
                isClickable && "hover:scale-110 hover:border-pink-400"
              )}
            >
              {isCompleted ? (
                <CheckIcon className="h-5 w-5 stroke-[3px]" />
              ) : (
                <div className="flex items-center justify-center">
                  {step.icon}
                </div>
              )}
            </div>

            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "text-xs font-black uppercase tracking-[0.18em] transition-colors duration-300",
                  isActive ? "text-pink-600" : "text-gray-400",
                  isClickable && "group-hover:text-pink-500"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

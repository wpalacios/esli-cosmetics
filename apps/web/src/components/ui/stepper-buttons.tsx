"use client";

import * as React from "react";
import { Button } from "@esli-cosmetics/ui";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import { cn } from "@esli-cosmetics/utils";

interface StepperButtonsProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  isNextDisabled?: boolean;
  isPreviousDisabled?: boolean;
  nextLabel?: string;
  previousLabel?: string;
  className?: string;
}

export function StepperButtons({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  isNextDisabled = false,
  isPreviousDisabled = false,
  nextLabel,
  previousLabel = "Anterior",
  className,
}: StepperButtonsProps) {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  const finalNextLabel = nextLabel || (isLastStep ? "Finalizar" : "Siguiente");

  return (
    <div
      className={cn(
        "flex w-full items-center gap-4",
        isFirstStep ? "justify-end" : "justify-between",
        className
      )}
    >
      {!isFirstStep && (
        <Button
          type="button"
          variant="outline"
          onClick={onPrevious}
          disabled={isPreviousDisabled}
        >
          <ChevronLeftIcon className="mr-2 h-4 w-4" />
          {previousLabel}
        </Button>
      )}

      <Button
        type="button"
        variant="secondary"
        onClick={onNext}
        disabled={isNextDisabled}
        className={cn(
          isNextDisabled && "border-gray-300 bg-gray-300 shadow-none"
        )}
      >
        {finalNextLabel}
        {!isLastStep && <ChevronRightIcon className="ml-2 h-4 w-4" />}
      </Button>
    </div>
  );
}

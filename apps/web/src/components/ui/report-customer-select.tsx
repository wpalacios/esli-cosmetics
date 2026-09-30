"use client";

import { useState, useMemo } from "react";
import { AiOutlineCheck, AiOutlineDown } from "react-icons/ai";
import { Button } from "@esli-cosmetics/ui";
import { cn } from "@esli-cosmetics/utils";

export type ReportType = {
  key: string;
  label: string;
};

interface ReportTypeSelectProps {
  value: string;
  onChange: (key: string) => void;
  options: ReportType[];
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function ReportTypeSelect({
  value,
  onChange,
  options,
  label = "Seleccionar Reporte",
  disabled = false,
  className,
}: ReportTypeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.key === value);
  }, [value, options]);

  const handleSelect = (key: string) => {
    onChange(key);
    setIsOpen(false);
  };

  const displayValue = selectedOption?.label || label;

  return (
    <div className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full justify-between text-left",
          !selectedOption && "text-gray-500"
        )}
      >
        <span className="truncate">{displayValue}</span>
        <AiOutlineDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
        />
      </Button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="max-h-60 overflow-y-auto py-1">
            {options.map(option => {
              const isSelected = option.key === value;

              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handleSelect(option.key)}
                  className={cn(
                    "flex w-full items-center justify-between px-4 py-2 text-left text-base",
                    "hover:bg-gray-100 dark:hover:bg-gray-700",
                    isSelected &&
                      "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-200"
                  )}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <AiOutlineCheck className="ml-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}

export default ReportTypeSelect;

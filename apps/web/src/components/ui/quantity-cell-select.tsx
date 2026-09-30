"use client";

import React, { useState, useEffect } from "react";
import { NumberInput } from "@/components/ui/number-input";

type QuantityCellProps = {
  variantId: string;
  initialValue: string;
  costPrice: number;
  onQuantityChange: (variantId: string, quantity: number) => void;
  setLocalQuantities: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  disabled?: boolean;
};

export function QuantityCell({
  variantId,
  initialValue,
  costPrice,
  onQuantityChange,
  setLocalQuantities,
  disabled = false,
}: QuantityCellProps) {
  const [inputValue, setInputValue] = useState(initialValue);
  const [costInput, setCostInput] = useState(costPrice);

  const prevInitialValue = React.useRef(initialValue);
  useEffect(() => {
    if (prevInitialValue.current !== initialValue) {
      setInputValue(initialValue);
      prevInitialValue.current = initialValue;
    }
  }, [initialValue]);

  useEffect(() => {
    setCostInput(costPrice);
  }, [costPrice]);

  const handleChange = (value: string | number) => {
    setInputValue(String(value ?? ""));
    const num = Number(value);
    setLocalQuantities(prev => ({
      ...prev,
      [variantId]: String(num),
    }));
    if (value !== "" && num > 0) {
      onQuantityChange(variantId, num);
    }
  };

  const handleBlur = () => {
    const num = Number(inputValue);
    if (inputValue !== "" && num > 0) {
      setLocalQuantities(prev => ({
        ...prev,
        [variantId]: String(num),
      }));
      onQuantityChange(variantId, num);
    } else {
      setInputValue(initialValue);
      setLocalQuantities(prev => ({
        ...prev,
        [variantId]: initialValue,
      }));
      onQuantityChange(variantId, Number(initialValue));
    }
  };

  return (
    <div className="flex w-full min-w-[120px] flex-col gap-2 md:w-auto">
      <label className="mb-1 text-xs font-medium text-gray-500 md:hidden">
        Cantidad
      </label>
      <NumberInput
        id={`quantity-${variantId}`}
        min={1}
        step={1}
        value={inputValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className="h-9 w-full text-right text-base"
        onClick={e => e.stopPropagation()}
        disabled={disabled}
        name={`quantity-${variantId}`}
      />
    </div>
  );
}

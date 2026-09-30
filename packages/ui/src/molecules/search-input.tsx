"use client";

import { forwardRef, useState, useEffect, useRef } from "react";
import { AiOutlineSearch, AiOutlineClose } from "react-icons/ai";
import { Input } from "../atoms/input";
import { Button } from "../atoms/button";
import { cn } from "@esli-cosmetics/utils";

export type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  minLength?: number;
  maxLength?: number;
  showClearButton?: boolean;
  autoFocus?: boolean;
  // Translation strings (optional - defaults to English)
  translations?: {
    hintPressEnter?: string;
    hintToSearch?: string;
    hintToFocus?: string;
    hintEnter?: string;
    hintCmd?: string;
    hintCtrl?: string;
  };
  // Show/hide the hint text
  showHint?: boolean;
};

const SearchIcon = AiOutlineSearch as React.ComponentType<{
  className?: string;
}>;

const CloseIcon = AiOutlineClose as React.ComponentType<{
  className?: string;
}>;

// Helper to detect if running on macOS
const isMacOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  // Use userAgent as primary method (platform is deprecated)
  const userAgent = navigator.userAgent?.toLowerCase() || "";
  // Check for macOS indicators in userAgent
  return userAgent.includes("mac") || userAgent.includes("darwin");
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onChange,
      onSearch,
      placeholder = "Search...",
      className,
      containerClassName,
      disabled = false,
      minLength = 0,
      maxLength = 250,
      showClearButton = true,
      autoFocus = false,
      translations,
      showHint = true,
    },
    ref
  ) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    const [isMac, setIsMac] = useState(false);

    // Detect OS on mount
    useEffect(() => {
      setIsMac(isMacOS());
    }, []);

    // Combine refs
    useEffect(() => {
      if (typeof ref === "function") {
        ref(inputRef.current);
      } else if (ref && inputRef.current) {
        (ref as React.RefObject<HTMLInputElement>).current = inputRef.current;
      }
    }, [ref]);

    // Auto focus if requested
    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus]);

    // Handle keyboard shortcuts
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Cmd/Ctrl + K to focus search input
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          // Only if not already focused and not typing in another input
          if (
            document.activeElement?.tagName !== "INPUT" &&
            document.activeElement?.tagName !== "TEXTAREA"
          ) {
            e.preventDefault();
            inputRef.current?.focus();
          }
        }
      };

      globalThis.addEventListener("keydown", handleKeyDown);
      return () => globalThis.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Enter key triggers search
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleSearch();
      }
      // Escape clears and blurs
      if (e.key === "Escape") {
        onChange("");
        e.stopPropagation();
        inputRef.current?.blur();
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      // Enforce maxLength constraint
      if (maxLength && newValue.length > maxLength) {
        onChange(newValue.slice(0, maxLength));
      } else {
        onChange(newValue);
      }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
      // Prevent default paste behavior
      e.preventDefault();
      e.stopPropagation();

      // Get pasted text
      const pastedText = e.clipboardData.getData("text");

      // Truncate to maxLength if needed
      const truncatedText = maxLength
        ? pastedText.slice(0, maxLength)
        : pastedText;

      // Calculate new value with pasted text
      const input = e.currentTarget;
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const currentValue = value;
      const newValue =
        currentValue.slice(0, start) + truncatedText + currentValue.slice(end);

      // Enforce maxLength on the final value
      const finalValue =
        maxLength && newValue.length > maxLength
          ? newValue.slice(0, maxLength)
          : newValue;

      onChange(finalValue);

      // Restore cursor position after state update
      setTimeout(() => {
        if (inputRef.current) {
          const newCursorPos = Math.min(
            start + truncatedText.length,
            finalValue.length
          );
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    };

    const handleSearch = () => {
      if (!disabled && value.trim().length >= minLength) {
        onSearch(value.trim());
      }
    };

    const handleClear = () => {
      onChange("");
      inputRef.current?.focus();
    };

    const canSearch = !disabled && value.trim().length >= minLength;
    const canClear = showClearButton && value.length > 0;

    // Translation strings with defaults
    const t = {
      hintPressEnter: translations?.hintPressEnter ?? "Presiona",
      hintToSearch: translations?.hintToSearch ?? "para buscar o",
      hintToFocus: translations?.hintToFocus ?? "para enfocar",
      hintEnter: translations?.hintEnter ?? "Enter",
      hintCmd: translations?.hintCmd ?? "⌘",
      hintCtrl: translations?.hintCtrl ?? "Ctrl",
    };

    const modifierKey = isMac ? t.hintCmd : t.hintCtrl;

    return (
      <div className={cn("relative w-full", containerClassName)}>
        <div className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onPaste={handlePaste}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={disabled}
              maxLength={maxLength}
              className={cn("pr-10", className)}
              leftIcon={<SearchIcon className="h-4 w-4" />}
            />
            {canClear && (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                aria-label="Clear search"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button
            type="button"
            onClick={handleSearch}
            disabled={!canSearch}
            variant="primary"
            size="md"
            className="shrink-0 hidden md:block"
            aria-label="Search"
          >
            <SearchIcon className="h-4 w-4" />
          </Button>
        </div>
        {isFocused && showHint && (
          <div className="hidden md:block absolute -bottom-6 left-0 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t.hintPressEnter}{" "}
            <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">
              {t.hintEnter}
            </kbd>{" "}
            {t.hintToSearch}{" "}
            <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">
              {modifierKey}
            </kbd>
            {" + "}
            <kbd className="px-1.5 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-xs">
              K
            </kbd>{" "}
            {t.hintToFocus}
          </div>
        )}
      </div>
    );
  }
);

SearchInput.displayName = "SearchInput";

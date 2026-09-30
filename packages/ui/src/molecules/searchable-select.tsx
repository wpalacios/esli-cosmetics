"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useState, useMemo, useEffect, useRef } from "react";
import {
  AiOutlineSearch,
  AiOutlineCheck,
  AiOutlineDown,
  AiOutlineClose,
} from "react-icons/ai";
import { cn } from "@esli-cosmetics/utils";

// Type assertion for react-icons to work with strict TypeScript
const SearchIcon = AiOutlineSearch as React.ComponentType<{
  className?: string;
}>;
const CheckIcon = AiOutlineCheck as React.ComponentType<{ className?: string }>;
const ChevronDownIcon = AiOutlineDown as React.ComponentType<{
  className?: string;
}>;
const CloseIcon = AiOutlineClose as React.ComponentType<{
  className?: string;
}>;

export type SearchableSelectOption<T = string> = {
  value: string;
  label: string;
  data?: T;
  disabled?: boolean;
};

export type SearchableSelectProps<T = string> = {
  options: SearchableSelectOption<T>[];
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowSearch?: boolean;
  getOptionLabel?: (option: SearchableSelectOption<T>) => string;
  filterOptions?: (
    options: SearchableSelectOption<T>[],
    searchTerm: string
  ) => SearchableSelectOption<T>[];
  renderOption?: (option: SearchableSelectOption<T>) => React.ReactNode;
  onSearchChange?: (searchTerm: string) => void;
  onSearchTrigger?: (searchTerm: string) => void;
  isLoading?: boolean;
  loadingMessage?: string;
  showClearButton?: boolean;
};

export function SearchableSelect<T = string>({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  disabled = false,
  className,
  error,
  searchPlaceholder = "Search...",
  emptyMessage = "No options found",
  getOptionLabel = option => option.label,
  filterOptions,
  renderOption,
  allowSearch = true,
  onSearchChange,
  onSearchTrigger,
  isLoading = false,
  loadingMessage = "Loading...",
  showClearButton = true,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Handle search term changes
  const handleSearchChange = (newSearchTerm: string) => {
    setSearchTerm(newSearchTerm);
    onSearchChange?.(newSearchTerm);
  };

  // Filter options based on search term (only used for client-side filtering)
  const filteredOptions = useMemo(() => {
    // If onSearchChange is provided, parent handles filtering via options prop
    if (onSearchChange) {
      return options;
    }

    if (filterOptions) {
      return filterOptions(options, searchTerm);
    }

    if (!searchTerm) {
      return options;
    }

    const search = searchTerm.toLowerCase();
    return options.filter(option => {
      const label = getOptionLabel(option).toLowerCase();
      return label.includes(search);
    });
  }, [options, searchTerm, filterOptions, getOptionLabel, onSearchChange]);

  // Find selected option
  const selectedOption = useMemo(() => {
    return options.find(option => option.value === value);
  }, [options, value]);

  // Reset search when dropdown closes
  useEffect(() => {
    if (!open) {
      setSearchTerm("");
    }
  }, [open]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (!open || !allowSearch) {
      return;
    }
    const id = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open, allowSearch]);

  // Handle clear button click
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange?.("");
  };

  const handleSelectOption = (optionValue: string) => {
    onValueChange?.(optionValue);
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
      <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
        <Popover.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            className={cn(
              "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-white dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "[&>span:first-child]:flex-1 [&>span:first-child]:min-w-0 [&>span:first-child]:truncate [&>span:first-child]:text-left",
              open
                ? "border-primary-500 ring-2 ring-primary-200 dark:ring-primary-800"
                : "focus:border-primary-500 focus:ring-primary-200",
              !selectedOption && "text-muted-foreground",
              error &&
                "border-red-500 focus:border-red-500 focus:ring-red-500 ring-red-500"
            )}
            aria-label={placeholder}
            aria-expanded={open}
          >
            <span className="flex-1 min-w-0 truncate text-left">
              {selectedOption ? getOptionLabel(selectedOption) : placeholder}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {showClearButton && selectedOption && !disabled && (
                <span
                  role="button"
                  onClick={handleClear}
                  className="rounded-full p-0.5 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer z-10 pointer-events-auto"
                  aria-label="Clear selection"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      handleClear(e as unknown as React.MouseEvent);
                    }
                  }}
                >
                  <CloseIcon className="h-3 w-3 text-gray-400" />
                </span>
              )}
              <ChevronDownIcon className="h-4 w-4 opacity-50 shrink-0" />
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            data-searchable-select-panel
            className="z-[10000] w-[var(--radix-popover-trigger-width)] max-h-96 flex flex-col overflow-hidden rounded-md border bg-white text-gray-900 shadow-md dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            sideOffset={4}
            align="start"
            onOpenAutoFocus={e => {
              e.preventDefault();
            }}
            onCloseAutoFocus={e => {
              e.preventDefault();
            }}
            onPointerDownOutside={e => {
              const target = e.target as HTMLElement;
              const isModal =
                target.closest("[data-radix-dialog-content]") ||
                target.closest('[role="dialog"]');
              if (isModal) {
                e.preventDefault();
              }
            }}
          >
            {allowSearch && (
              <div
                className="p-2 border-b dark:border-gray-700 shrink-0"
                onPointerDown={e => e.stopPropagation()}
                onMouseDown={e => e.stopPropagation()}
                onTouchStart={e => e.stopPropagation()}
              >
                <div className="relative">
                  <SearchIcon className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="search"
                    enterKeyHint="search"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={searchPlaceholder}
                    value={searchTerm}
                    onChange={e => handleSearchChange(e.target.value)}
                    onPointerDown={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === "Enter") {
                        e.preventDefault();
                        onSearchTrigger?.(searchTerm);
                      }
                      // Allow arrow keys to navigate options
                      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                        e.stopPropagation();
                      }
                    }}
                    className="flex w-full h-8 rounded-md border border-neutral-200 focus-visible:ring-primary-200 focus-visible:border-primary-500 bg-white dark:bg-gray-800 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 px-3 py-1.5 pl-8 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            <div
              className="p-1 overflow-y-auto max-h-[300px] overscroll-contain min-h-0"
              style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
              }}
            >
              {isLoading ? (
                <div className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {loadingMessage}
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map(option => {
                  const isSelected = value === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelectOption(option.value)}
                      disabled={option.disabled ?? false}
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none min-w-0 text-left",
                        "bg-white text-gray-900",
                        "hover:bg-gray-100 hover:text-gray-900",
                        "focus:bg-gray-100 focus:text-gray-900",
                        "disabled:pointer-events-none disabled:opacity-50 disabled:bg-gray-50",
                        "dark:bg-gray-800 dark:text-gray-100",
                        "dark:hover:bg-gray-700 dark:hover:text-gray-100",
                        "dark:focus:bg-gray-700 dark:focus:text-gray-100"
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        {isSelected && (
                          <CheckIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </span>
                      <span className="text-gray-900 dark:text-gray-100 truncate min-w-0">
                        {renderOption
                          ? renderOption(option)
                          : getOptionLabel(option)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

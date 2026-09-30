"use client";

import { cn } from "@esli-cosmetics/utils";
import * as Popover from "@radix-ui/react-popover";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AiOutlineCheck,
  AiOutlineClose,
  AiOutlineDown,
  AiOutlineSearch,
} from "react-icons/ai";
// Type assertions for react-icons
const SearchIcon = AiOutlineSearch as React.ComponentType<{
  className?: string;
}>;
const CheckIcon = AiOutlineCheck as React.ComponentType<{ className?: string }>;
const ChevronDownIcon = AiOutlineDown as React.ComponentType<{
  className?: string;
}>;
const IoClose = AiOutlineClose as React.ComponentType<{ className?: string }>;

export type SearchableMultiSelectOption<T = string> = {
  value: string;
  label: string;
  data?: T;
  disabled?: boolean;
};

export type SearchableMultiSelectProps<T = string> = {
  options: SearchableMultiSelectOption<T>[];
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  error?: string | undefined;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowSearch?: boolean;
  maxSelectedDisplay?: number;
  getOptionLabel?: (option: SearchableMultiSelectOption<T>) => string;
  filterOptions?: (
    options: SearchableMultiSelectOption<T>[],
    searchTerm: string
  ) => SearchableMultiSelectOption<T>[];
  renderOption?: (option: SearchableMultiSelectOption<T>) => React.ReactNode;
  renderSelectedBadge?: (
    option: SearchableMultiSelectOption<T>,
    onRemove: () => void
  ) => React.ReactNode;
  onSearchChange?: (searchTerm: string) => void;
  onSearchTrigger?: (searchTerm: string) => void;
  isLoading?: boolean;
  loadingMessage?: string;
};

export function SearchableMultiSelect<T = string>({
  options,
  value = [],
  onValueChange,
  placeholder = "Selecciona opciones...",
  disabled = false,
  className,
  error,
  searchPlaceholder = "Buscar...",
  emptyMessage = "No hay opciones disponibles",
  allowSearch = true,
  maxSelectedDisplay = 3,
  getOptionLabel = option => option.label,
  filterOptions,
  renderOption,
  renderSelectedBadge,
  onSearchChange,
  onSearchTrigger,
  isLoading = false,
  loadingMessage = "cargando...",
}: SearchableMultiSelectProps<T>) {
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

  // Find selected options
  const selectedOptions = useMemo(() => {
    return options.filter(option => value.includes(option.value));
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

  // Handle toggle selection
  const handleToggleOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onValueChange?.(newValue);
  };

  // Handle remove individual selection
  const handleRemoveOption = (optionValue: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newValue = value.filter(v => v !== optionValue);
    onValueChange?.(newValue);
  };

  // Handle clear all
  const handleClearAll = (_e: React.MouseEvent) => {
    onValueChange?.([]);
  };

  // Render selected badges
  const renderSelectedItems = () => {
    if (selectedOptions.length === 0) {
      return <span className="text-muted-foreground">{placeholder}</span>;
    }

    const displayOptions = selectedOptions.slice(0, maxSelectedDisplay);
    const remainingCount = selectedOptions.length - maxSelectedDisplay;

    return (
      <div className="flex flex-wrap gap-1 min-w-0">
        {displayOptions.map(option => {
          if (renderSelectedBadge) {
            return (
              <div key={option.value} className="min-w-0 max-w-full">
                {renderSelectedBadge(option, () =>
                  handleRemoveOption(option.value)
                )}
              </div>
            );
          }

          return (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 rounded-md bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900 dark:text-primary-300 max-w-full min-w-0"
            >
              <span className="truncate">{getOptionLabel(option)}</span>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Remove ${getOptionLabel(option)}`}
                onClick={e => {
                  handleRemoveOption(option.value, e);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();

                    const newValue = value.filter(v => v !== option.value);
                    onValueChange?.(newValue);
                  }
                }}
                className="inline-flex items-center justify-center hover:bg-primary-200 dark:hover:bg-primary-800 rounded-sm cursor-pointer shrink-0"
              >
                <IoClose className="h-3 w-3" />
              </span>
            </span>
          );
        })}
        {remainingCount > 0 && (
          <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 shrink-0">
            +{remainingCount} más
          </span>
        )}
      </div>
    );
  };

  return (
    <div className={cn("relative", className)}>
      <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
        <Popover.Trigger asChild>
          <button
            // variant="outline"
            ref={triggerRef}
            type="button"
            disabled={disabled}
            className={cn(
              "flex min-h-10 w-full items-center justify-between rounded-md border border-input bg-white dark:bg-gray-900 dark:text-gray-100 dark:border-gray-700 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              // Apply focus/open styles
              open
                ? "border-primary-500 ring-2 ring-primary-200"
                : "focus:border-primary-500 focus:ring-primary-200",
              error &&
                "border-red-500 focus:border-red-500 focus:ring-red-500 ring-red-500"
            )}
            aria-label={placeholder}
          >
            <div className="flex-1 min-w-0 text-left overflow-hidden">
              {renderSelectedItems()}
            </div>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              {selectedOptions.length > 0 && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => {
                    handleClearAll(e);
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();

                      onValueChange?.([]);
                    }
                  }}
                  className="rounded-full inline-flex items-center justify-center hover:bg-neutral-100 dark:hover:bg-neutral-800 p-0.5 cursor-pointer"
                  aria-label="Clear all selections"
                >
                  <IoClose className="h-3 w-3 text-gray-400" />
                </span>
              )}
              <ChevronDownIcon
                className={cn(
                  "h-4 w-4 transition-transform opacity-50",
                  open && "transform rotate-180"
                )}
              />
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            data-searchable-multi-select-panel
            className="z-[10000] w-[var(--radix-popover-trigger-width)] max-h-96 flex flex-col overflow-hidden rounded-md border bg-white text-gray-900 shadow-md dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            sideOffset={4}
            align="start"
            onOpenAutoFocus={e => {
              // Prevent auto-focus on the content
              e.preventDefault();
            }}
            onCloseAutoFocus={e => {
              // Prevent focus from returning to trigger
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
            {/* Search Input — native input avoids blur-on-scroll/wheel from shared Input */}
            {allowSearch && (
              <div
                className="p-2 border-b shrink-0"
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
                    }}
                    className="flex w-full h-8 rounded-md border border-neutral-200 focus-visible:ring-primary-200 focus-visible:border-primary-500 bg-white dark:bg-gray-800 px-3 py-1.5 pl-8 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-gray-100 dark:placeholder:text-neutral-400"
                  />
                </div>
              </div>
            )}

            {/* Options List */}
            <div
              className="p-1 overflow-y-auto max-h-[300px] overscroll-contain"
              style={{
                WebkitOverflowScrolling: "touch",
                touchAction: "pan-y",
                willChange: "scroll-position",
              }}
              onWheel={e => {
                // Stop propagation to prevent modal from scrolling
                e.stopPropagation();
                const target = e.currentTarget;
                // Manually handle scroll if needed
                if (target.scrollHeight > target.clientHeight) {
                  const delta = e.deltaY;
                  const maxScroll = target.scrollHeight - target.clientHeight;
                  const currentScroll = target.scrollTop;

                  // Check if we need to scroll
                  if (
                    (delta > 0 && currentScroll < maxScroll) ||
                    (delta < 0 && currentScroll > 0)
                  ) {
                    // Allow native scroll to work
                    return;
                  } else {
                    // Prevent scroll if at boundaries
                    e.preventDefault();
                  }
                }
              }}
              onTouchMove={e => {
                // Stop touch events from propagating to modal
                e.stopPropagation();
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
                  const isSelected = value.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={e => {
                        handleToggleOption(option.value);
                      }}
                      disabled={option.disabled ?? false}
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none text-left min-w-0",
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

            {/* Footer with count */}
            {selectedOptions.length > 0 && (
              <div className="border-t p-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 shrink-0">
                <span>{selectedOptions.length} seleccionados</span>
                <button
                  type="button"
                  onClick={e => {
                    onValueChange?.([]);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Quitar todos los seleccionados
                </button>
              </div>
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  );
}

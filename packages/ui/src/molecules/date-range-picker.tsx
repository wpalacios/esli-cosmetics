"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { useMemo, useState } from "react";
import {
  AiOutlineCalendar,
  AiOutlineLeft,
  AiOutlineRight,
  AiOutlineClose,
} from "react-icons/ai";
import { cn } from "@esli-cosmetics/utils";

const CalendarIcon = AiOutlineCalendar as React.ComponentType<{
  className?: string;
}>;
const ChevronLeftIcon = AiOutlineLeft as React.ComponentType<{
  className?: string;
}>;
const ChevronRightIcon = AiOutlineRight as React.ComponentType<{
  className?: string;
}>;
const CloseIcon = AiOutlineClose as React.ComponentType<{ className?: string }>;

export type DateRange = {
  from?: Date;
  to?: Date;
};

export type DateRangePickerLabels = {
  presets?: string;
  clear?: string;
  apply?: string;
  today?: string;
  yesterday?: string;
  last7Days?: string;
  last30Days?: string;
  thisMonth?: string;
  lastMonth?: string;
  /** 7 weekday short labels starting on Sunday. */
  weekdays?: [string, string, string, string, string, string, string];
  /** 12 month names starting in January. */
  months?: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
};

export type DateRangePickerProps = {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  align?: "start" | "center" | "end";
  minDate?: Date;
  maxDate?: Date;
  showPresets?: boolean;
  /** Override the trigger label formatting for a single date. */
  formatDate?: (date: Date) => string;
  labels?: DateRangePickerLabels;
  /** Locale used for default date formatting. */
  locale?: string;
  error?: string;
  "aria-label"?: string;
};

const DEFAULT_WEEKDAYS: NonNullable<DateRangePickerLabels["weekdays"]> = [
  "Su",
  "Mo",
  "Tu",
  "We",
  "Th",
  "Fr",
  "Sa",
];

const DEFAULT_MONTHS: NonNullable<DateRangePickerLabels["months"]> = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(a?: Date | null, b?: Date | null): boolean {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addMonths(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  return next;
}

function isAfter(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() > startOfDay(b).getTime();
}

function isBefore(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() < startOfDay(b).getTime();
}

function isWithin(day: Date, from?: Date, to?: Date): boolean {
  if (!from || !to) return false;
  const time = startOfDay(day).getTime();
  return time > startOfDay(from).getTime() && time < startOfDay(to).getTime();
}

/** Build the 6x7 day grid for the month containing `monthDate`. */
function buildCalendarDays(monthDate: Date): Date[] {
  const firstOfMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "Select date range",
  disabled = false,
  className,
  align = "start",
  minDate,
  maxDate,
  showPresets = true,
  formatDate,
  labels,
  locale,
  error,
  "aria-label": ariaLabel,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(() =>
    value?.from ? new Date(value.from) : new Date()
  );

  // Derive localized month/weekday names from the locale unless explicitly
  // provided, so the calendar matches the rest of the UI language for free.
  const localizedWeekdays = useMemo(() => {
    if (labels?.weekdays) return labels.weekdays;
    if (!locale) return DEFAULT_WEEKDAYS;
    try {
      const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
      // 2023-01-01 is a Sunday; iterate the week starting from Sunday.
      return Array.from({ length: 7 }, (_, index) =>
        formatter.format(new Date(2023, 0, 1 + index))
      ) as NonNullable<DateRangePickerLabels["weekdays"]>;
    } catch {
      return DEFAULT_WEEKDAYS;
    }
  }, [labels?.weekdays, locale]);

  const localizedMonths = useMemo(() => {
    if (labels?.months) return labels.months;
    if (!locale) return DEFAULT_MONTHS;
    try {
      const formatter = new Intl.DateTimeFormat(locale, { month: "long" });
      return Array.from({ length: 12 }, (_, index) =>
        formatter.format(new Date(2023, index, 1))
      ) as NonNullable<DateRangePickerLabels["months"]>;
    } catch {
      return DEFAULT_MONTHS;
    }
  }, [labels?.months, locale]);

  const weekdays = localizedWeekdays;
  const months = localizedMonths;

  const defaultFormat = useMemo(() => {
    return (date: Date) =>
      new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
  }, [locale]);

  const formatLabel = formatDate ?? defaultFormat;

  const from = value?.from;
  const to = value?.to;

  // Preview range while picking the second endpoint.
  const previewTo = useMemo(() => {
    if (from && !to && hoveredDate && !isBefore(hoveredDate, from)) {
      return hoveredDate;
    }
    return to;
  }, [from, to, hoveredDate]);

  const isDateDisabled = (date: Date): boolean => {
    if (minDate && isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return false;
  };

  const emit = (range: DateRange) => {
    onChange?.(range);
  };

  const handleSelectDay = (day: Date) => {
    if (isDateDisabled(day)) return;
    const picked = startOfDay(day);

    // Start a fresh range when nothing is selected or a full range exists.
    if (!from || (from && to)) {
      emit({ from: picked });
      return;
    }

    // Second click: finalize the range (auto-order the endpoints).
    if (isBefore(picked, from)) {
      emit({ from: picked, to: from });
    } else {
      emit({ from, to: picked });
    }
  };

  const handleClear = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setHoveredDate(null);
    emit({});
  };

  const applyPreset = (preset: DateRange) => {
    setHoveredDate(null);
    if (preset.from) setViewMonth(new Date(preset.from));
    emit(preset);
  };

  const presets = useMemo(() => {
    const today = startOfDay(new Date());
    const yesterday = startOfDay(new Date());
    yesterday.setDate(today.getDate() - 1);
    const last7 = startOfDay(new Date());
    last7.setDate(today.getDate() - 6);
    const last30 = startOfDay(new Date());
    last30.setDate(today.getDate() - 29);
    const startThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startLastMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1
    );
    const endLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    return [
      { label: labels?.today ?? "Today", range: { from: today, to: today } },
      {
        label: labels?.yesterday ?? "Yesterday",
        range: { from: yesterday, to: yesterday },
      },
      {
        label: labels?.last7Days ?? "Last 7 days",
        range: { from: last7, to: today },
      },
      {
        label: labels?.last30Days ?? "Last 30 days",
        range: { from: last30, to: today },
      },
      {
        label: labels?.thisMonth ?? "This month",
        range: { from: startThisMonth, to: today },
      },
      {
        label: labels?.lastMonth ?? "Last month",
        range: { from: startLastMonth, to: endLastMonth },
      },
    ];
  }, [labels]);

  const triggerLabel = useMemo(() => {
    if (from && to) return `${formatLabel(from)} – ${formatLabel(to)}`;
    if (from) return `${formatLabel(from)} – …`;
    return placeholder;
  }, [from, to, formatLabel, placeholder]);

  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);
  const today = useMemo(() => startOfDay(new Date()), []);

  return (
    <div className={cn("relative w-full", className)}>
      <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
        <Popover.Trigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label={ariaLabel ?? placeholder}
            aria-expanded={open}
            className={cn(
              "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100",
              open
                ? "border-primary-500 ring-2 ring-primary-200"
                : "focus:border-primary-500 focus:ring-primary-200",
              !from && "text-neutral-400 dark:text-neutral-500",
              error &&
                "border-error-500 focus:border-error-500 focus:ring-error-200"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <CalendarIcon className="h-4 w-4 shrink-0 text-primary-500" />
              <span className="truncate text-left">{triggerLabel}</span>
            </span>
            {from && !disabled && (
              <span
                role="button"
                tabIndex={0}
                aria-label={labels?.clear ?? "Clear"}
                onClick={handleClear}
                onKeyDown={event => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleClear();
                  }
                }}
                className="z-10 rounded-full p-0.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <CloseIcon className="h-3 w-3" />
              </span>
            )}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            align={align}
            sideOffset={6}
            className="z-[10000] w-auto rounded-xl border border-neutral-200 bg-white p-3 text-neutral-900 shadow-elevation-lg dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              {showPresets && (
                <div className="flex shrink-0 flex-col gap-1 sm:w-36 sm:border-r sm:border-neutral-100 sm:pr-3 dark:sm:border-neutral-700">
                  <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    {labels?.presets ?? "Quick ranges"}
                  </p>
                  <div className="flex flex-wrap gap-1 sm:flex-col">
                    {presets.map(preset => {
                      const active =
                        isSameDay(from, preset.range.from) &&
                        isSameDay(to, preset.range.to);
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyPreset(preset.range)}
                          className={cn(
                            "rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                            active
                              ? "bg-primary-50 font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                              : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="w-[17rem]">
                {/* Month navigation */}
                <div className="mb-2 flex items-center justify-between px-1">
                  <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => setViewMonth(prev => addMonths(prev, -1))}
                    className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-semibold capitalize">
                    {months[viewMonth.getMonth()]} {viewMonth.getFullYear()}
                  </span>
                  <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => setViewMonth(prev => addMonths(prev, 1))}
                    className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="mb-1 grid grid-cols-7">
                  {weekdays.map((weekday, index) => (
                    <div
                      key={`${weekday}-${index}`}
                      className="flex h-8 items-center justify-center text-xs font-medium capitalize text-neutral-400"
                    >
                      {weekday}
                    </div>
                  ))}
                </div>

                {/* Days grid */}
                <div
                  className="grid grid-cols-7"
                  onMouseLeave={() => setHoveredDate(null)}
                >
                  {calendarDays.map(day => {
                    const outsideMonth =
                      day.getMonth() !== viewMonth.getMonth();
                    const disabledDay = isDateDisabled(day);
                    const isStart = isSameDay(day, from);
                    const isEnd = isSameDay(day, previewTo);
                    const inRange = isWithin(day, from, previewTo);
                    const isEndpoint = isStart || isEnd;
                    const isTodayCell = isSameDay(day, today);

                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "relative flex items-center justify-center py-0.5",
                          (inRange || (isEndpoint && from && previewTo)) &&
                            "bg-primary-50 dark:bg-primary-900/20",
                          isStart && from && previewTo && "rounded-l-full",
                          isEnd && from && previewTo && "rounded-r-full",
                          isStart && isEnd && "rounded-full"
                        )}
                      >
                        <button
                          type="button"
                          disabled={disabledDay}
                          onClick={() => handleSelectDay(day)}
                          onMouseEnter={() => setHoveredDate(day)}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300",
                            outsideMonth
                              ? "text-neutral-300 dark:text-neutral-600"
                              : "text-neutral-700 dark:text-neutral-200",
                            !isEndpoint &&
                              !disabledDay &&
                              "hover:bg-primary-100 dark:hover:bg-primary-900/40",
                            isEndpoint &&
                              "bg-gradient-to-r from-primary-500 to-secondary-500 font-semibold text-white hover:from-primary-500 hover:to-primary-500",
                            !isEndpoint &&
                              isTodayCell &&
                              "font-semibold text-primary-600 ring-1 ring-inset ring-primary-300 dark:text-primary-300",
                            disabledDay &&
                              "cursor-not-allowed text-neutral-300 hover:bg-transparent dark:text-neutral-600"
                          )}
                        >
                          {day.getDate()}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* Footer actions */}
                <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2 dark:border-neutral-700">
                  <button
                    type="button"
                    onClick={() => handleClear()}
                    className="rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 transition-colors hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700"
                  >
                    {labels?.clear ?? "Clear"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-gradient-to-r from-primary-500 to-secondary-500 px-4 py-1.5 text-sm font-medium text-white transition-transform hover:scale-105 active:scale-95"
                  >
                    {labels?.apply ?? "Apply"}
                  </button>
                </div>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {error && <p className="mt-1 text-xs text-error-600">{error}</p>}
    </div>
  );
}

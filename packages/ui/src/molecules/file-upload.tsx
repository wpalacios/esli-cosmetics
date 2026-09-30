"use client";

import { useCallback, useId, useRef, useState } from "react";
import { HiOutlineCloudArrowUp } from "react-icons/hi2";
import { cn } from "@esli-cosmetics/utils";
import { Button } from "../atoms/button";
import { Label } from "../atoms/label";

export type FileUploadProps = {
  /** Associates the hidden input with the label (`htmlFor`). */
  readonly id?: string;
  /** Optional visible label above the drop zone. */
  readonly label?: React.ReactNode;
  readonly accept?: string;
  readonly multiple?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  /** Highlighted file name inside the zone when a file is chosen. */
  readonly selectedFileName?: string | null;
  /** Extra line under the zone (e.g. translated “Selected: …”). */
  readonly selectedSummary?: string | null;
  /** Main instruction inside the drop zone. */
  readonly dropzoneTitle: string;
  /** Secondary line (e.g. allowed extensions). */
  readonly dropzoneHint?: string;
  /** Accessible label for the browse control. */
  readonly browseButtonLabel: string;
  readonly onFileSelect: (file: File | null) => void;
};

export function FileUpload({
  id: idProp,
  label,
  accept,
  multiple = false,
  disabled = false,
  className,
  selectedFileName,
  selectedSummary,
  dropzoneTitle,
  dropzoneHint,
  browseButtonLabel,
  onFileSelect,
}: FileUploadProps) {
  const reactId = useId();
  const inputId = idProp ?? `file-upload-${reactId}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const openPicker = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      onFileSelect(file);
      event.target.value = "";
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
    },
    []
  );

  const handleDragEnter = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.currentTarget === event.target) {
        setIsDragging(false);
      }
    },
    []
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(false);
      if (disabled) {
        return;
      }
      const file = event.dataTransfer.files?.[0] ?? null;
      onFileSelect(file);
    },
    [disabled, onFileSelect]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={handleChange}
      />
      <div
        role="region"
        aria-label={dropzoneTitle}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all",
          "border-neutral-300 bg-gradient-to-br from-white to-neutral-50/90 dark:border-neutral-600 dark:from-neutral-900 dark:to-neutral-950/80",
          !disabled &&
            "cursor-pointer hover:border-[#ff48b0]/70 hover:shadow-md hover:shadow-primary-500/10 dark:hover:border-[#ff48b0]/60",
          isDragging &&
            "border-[#ff48b0] bg-gradient-to-br from-primary-50/90 to-secondary-50/60 ring-2 ring-[#ff48b0]/30 dark:from-primary-950/50 dark:to-secondary-950/30 dark:ring-[#ff48b0]/25",
          disabled && "cursor-not-allowed opacity-60"
        )}
        onClick={() => {
          openPicker();
        }}
        onKeyDown={event => {
          if (disabled) {
            return;
          }
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-500/10 text-[#ff48b0] dark:bg-primary-400/15">
          <HiOutlineCloudArrowUp className="h-7 w-7" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {dropzoneTitle}
          </p>
          {dropzoneHint ? (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              {dropzoneHint}
            </p>
          ) : null}
          {selectedFileName ? (
            <p className="truncate px-1 pt-1 text-xs font-semibold text-[#ff48b0] dark:text-secondary-300">
              {selectedFileName}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="pointer-events-auto"
          onClick={event => {
            event.stopPropagation();
            openPicker();
          }}
        >
          {browseButtonLabel}
        </Button>
      </div>
      {selectedSummary ? (
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {selectedSummary}
        </p>
      ) : null}
    </div>
  );
}

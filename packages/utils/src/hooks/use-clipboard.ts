"use client";

import { useState, useCallback } from "react";

/**
 * Hook for clipboard operations
 */
export function useClipboard(timeout = 2000) {
  const [hasCopied, setHasCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
        console.warn("Clipboard API not available");
        return false;
      }

      try {
        await navigator.clipboard.writeText(text);
        setHasCopied(true);

        setTimeout(() => {
          setHasCopied(false);
        }, timeout);

        return true;
      } catch (error) {
        console.warn("Failed to copy text: ", error);
        setHasCopied(false);
        return false;
      }
    },
    [timeout]
  );

  return { copy, hasCopied };
}

"use client";

import { useState } from "react";
import type { UseLocalStorageReturn } from "@esli-cosmetics/types";

/**
 * Hook for managing localStorage with React state
 */
export function useLocalStorage<T>(
  key: string,
  initialValue?: T,
  ttl?: number
): UseLocalStorageReturn<T> {
  // Get initial value from localStorage or use provided initial value
  const [storedValue, setStoredValue] = useState<T | undefined>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      if (!item) return initialValue;

      const parsed = JSON.parse(item);

      // Check TTL if provided
      if (ttl && parsed.timestamp) {
        const now = Date.now();
        if (now - parsed.timestamp > ttl) {
          window.localStorage.removeItem(key);
          return initialValue;
        }
        return parsed.value;
      }

      // Return value directly if no TTL structure
      return parsed.value !== undefined ? parsed.value : parsed;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when state changes
  const setValue = (value: T | ((prev: T | undefined) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        const storageValue = ttl
          ? { value: valueToStore, timestamp: Date.now() }
          : valueToStore;

        window.localStorage.setItem(key, JSON.stringify(storageValue));
      }
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  // Remove item from localStorage
  const removeValue = () => {
    try {
      setStoredValue(undefined);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, removeValue];
}

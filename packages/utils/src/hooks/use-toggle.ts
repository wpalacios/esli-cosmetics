"use client";

import { useState, useCallback } from "react";

/**
 * Hook for toggling boolean state
 */
export function useToggle(
  initialValue = false
): [boolean, (value?: boolean) => void] {
  const [state, setState] = useState(initialValue);

  const toggle = useCallback((value?: boolean) => {
    setState(prev => (value !== undefined ? value : !prev));
  }, []);

  return [state, toggle];
}

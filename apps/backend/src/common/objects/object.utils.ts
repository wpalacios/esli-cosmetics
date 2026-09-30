// Utility functions for object manipulation

export function deepGet(
  obj: Record<string, unknown> | null,
  path: string
): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

// Converts object keys between snake_case and camelCase
export function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
// Converts object keys between camelCase and snake_case
export function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, m => "_" + m.toLowerCase());
}

// Tries to get the value from the object using multiple key variations
export function tryKeys(
  obj: Record<string, unknown> | null,
  keys: string[]
): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    if (k in obj) return obj[k];
    const sk = camelToSnake(k);
    if (sk in obj) return obj[sk];
    const ck = snakeToCamel(k);
    if (ck in obj) return obj[ck];
  }
  return undefined;
}

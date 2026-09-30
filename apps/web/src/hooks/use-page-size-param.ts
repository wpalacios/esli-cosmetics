"use client";

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@esli-cosmetics/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

interface UsePageSizeParamOptions {
  /** Allowed page sizes. Defaults to the shared PAGE_SIZE_OPTIONS. */
  options?: number[];
  /** Fallback page size when the URL has no (or an invalid) value. */
  defaultPageSize?: number;
  /** URL search param key used to persist the page size. */
  paramKey?: string;
  /** Search param that holds the current page; reset to 1 on size change. */
  pageParamKey?: string;
}

interface UsePageSizeParamResult {
  pageSize: number;
  setPageSize: (size: number) => void;
  pageSizeOptions: number[];
}

/**
 * Reads and writes the table page size from the URL (e.g. `?pageSize=25`).
 *
 * Changing the page size resets the `page` query param back to 1 so the user
 * never lands on an out-of-range page. The selected value is validated against
 * the allowed `options`, falling back to `defaultPageSize` otherwise.
 */
export function usePageSizeParam(
  options: UsePageSizeParamOptions = {}
): UsePageSizeParamResult {
  const {
    options: pageSizeOptions = [...PAGE_SIZE_OPTIONS],
    defaultPageSize = DEFAULT_PAGE_SIZE,
    paramKey = "pageSize",
    pageParamKey = "page",
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageSize = useMemo(() => {
    const raw = searchParams.get(paramKey);
    const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
    return !Number.isNaN(parsed) && pageSizeOptions.includes(parsed)
      ? parsed
      : defaultPageSize;
  }, [searchParams, paramKey, pageSizeOptions, defaultPageSize]);

  const setPageSize = useCallback(
    (size: number) => {
      const params = new URLSearchParams(searchParams.toString());

      if (size === defaultPageSize) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, String(size));
      }

      // Reset to the first page whenever the page size changes.
      params.delete(pageParamKey);

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    },
    [searchParams, defaultPageSize, paramKey, pageParamKey, pathname, router]
  );

  return { pageSize, setPageSize, pageSizeOptions };
}

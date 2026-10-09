import { useEffect, useState } from "react";

/** Rows rendered per page on the record list screens. */
export const LIST_PAGE_SIZE = 50;

/**
 * Paginates a long list.
 *
 * Rendering every record at once mounted thousands of DOM nodes, which is what
 * froze these screens on a phone. Resetting whenever a filter changes keeps the
 * first page meaningful instead of showing a stale slice.
 */
export function useListPaging<T>(
  rows: T[],
  resetDeps: readonly unknown[],
): {
  visible: T[];
  remaining: number;
  loadMore: () => void;
  reset: () => void;
} {
  const [limit, setLimit] = useState(LIST_PAGE_SIZE);
  const resetKey = resetDeps.join("|");

  useEffect(() => {
    setLimit(LIST_PAGE_SIZE);
  }, [resetKey]);

  return {
    visible: rows.slice(0, limit),
    remaining: Math.max(0, rows.length - limit),
    loadMore: () => setLimit((n) => n + LIST_PAGE_SIZE),
    reset: () => setLimit(LIST_PAGE_SIZE),
  };
}

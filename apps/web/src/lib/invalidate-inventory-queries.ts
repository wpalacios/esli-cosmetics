import type { QueryClient } from "@tanstack/react-query";
import { stockLevelKeys } from "@/hooks/use-stock-levels";
import { stockMovementKeys } from "@/hooks/use-stock-movements";
import { productVariantKeys } from "@/hooks/use-product-variants";

/** Refreshes POS, stock pages, and movement lists after inventory mutations. */
export function invalidateInventoryQueries(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: stockLevelKeys.all });
  void queryClient.invalidateQueries({ queryKey: stockMovementKeys.all });
  void queryClient.invalidateQueries({
    queryKey: productVariantKeys.searches(),
  });
}

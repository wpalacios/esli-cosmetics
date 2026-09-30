"use client";

import { usePathname } from "next/navigation";
import { cn } from "@esli-cosmetics/utils";

type MainContentWrapperProps = {
  children: React.ReactNode;
};

export function MainContentWrapper({ children }: MainContentWrapperProps) {
  const pathname = usePathname();
  const isPOSPage = pathname.includes("/sales/pos");
  // Quote workspace: /sales/quotes/new or /sales/quotes/:id/edit (not list or view-only /:id)
  const isNewQuotePage =
    pathname === "/sales/quotes/new" || pathname.endsWith("/sales/quotes/new");
  const isEditQuotePage = /\/sales\/quotes\/[^/]+\/edit\/?$/.test(pathname);
  const isQuoteWorkspacePage = isNewQuotePage || isEditQuotePage;
  const isFullScreenPage = isPOSPage || isQuoteWorkspacePage;

  return (
    <main
      className={cn(
        "isolate mx-auto w-full",
        !isFullScreenPage &&
          "max-w-screen-2xl overflow-hidden p-4 md:p-6 2xl:p-10"
      )}
    >
      {children}
    </main>
  );
}

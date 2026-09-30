"use client";

import { Badge } from "@esli-cosmetics/ui";
import { ProductKitStep1Data } from "../forms/product-kits-form";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArchiveIcon, CalendarIcon, IdCardIcon } from "@radix-ui/react-icons";
import { useTranslation } from "react-i18next";
import { useBrands } from "@/hooks/use-brands";
import { useCategories } from "@/hooks/use-categories";
import type { BrandWithRelations } from "@esli-cosmetics/types";
import type { CategoryWithRelations } from "@esli-cosmetics/types";
import { useState, useEffect } from "react";
import * as Accordion from "@radix-ui/react-accordion";

interface ProductKitsHeaderProps {
  data: ProductKitStep1Data;
  estimatedCost: number;
  onEstimatedCostChange?: (value: number) => void;
}

export function ProductKitsHeader({
  data,
  estimatedCost,
  onEstimatedCostChange,
}: ProductKitsHeaderProps) {
  const { t } = useTranslation("products");
  const { data: brandsResponse } = useBrands();
  const { data: categoriesResponse } = useCategories();

  const brands = brandsResponse?.data ?? [];
  const categories = categoriesResponse?.data ?? [];

  const brandName = brands.find(
    (b: BrandWithRelations) => b.id === data.brandId
  )?.name;

  const categoryName = categories.find(
    (c: CategoryWithRelations) => c.id === data.categoryId
  )?.name;

  // Badge size classes
  const badgeClass =
    "font-normal text-base text-black dark:text-white px-2 py-1.5 rounded-lg sm:text-base sm:px-2 sm:py-1.5";
  const titleClass =
    "font-bold text-base sm:text-xl text-black dark:text-white break-words";
  const descriptionLabelClass =
    "font-semibold not-italic text-black dark:text-white mr-2 text-base";
  const descriptionTextClass =
    "text-base text-muted-foreground leading-relaxed italic flex-1";

  const [costInput, setCostInput] = useState<number>(estimatedCost);

  useEffect(() => {
    setCostInput(estimatedCost);
  }, [estimatedCost]);

  // Detect mobile (tailwind: <640px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:mb-6 sm:p-5">
      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:gap-2">
        <div className="flex items-center gap-2">
          <ArchiveIcon className="h-5 w-5 text-pink-500" />
          <h2 className={titleClass}>{data.name}</h2>
        </div>
      </div>

      {/* Accordion mobile only */}
      {isMobile ? (
        <Accordion.Root type="single" collapsible defaultValue="">
          <Accordion.Item value="badges">
            <Accordion.Trigger className="flex w-full items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-500 transition hover:bg-gray-100 dark:bg-gray-900">
              {t("form.showDetails", "Ver detalles del kit")}
              <span className="ml-2">
                <ArchiveIcon className="h-4 w-4" />
              </span>
            </Accordion.Trigger>
            <Accordion.Content className="pt-2">
              <div className="flex flex-col gap-2">
                {data.sku && (
                  <Badge
                    variant="outline"
                    className={`border-dashed font-mono ${badgeClass}`}
                  >
                    {t("form.sku")}: {data.sku}
                  </Badge>
                )}

                <Badge variant="secondary" className={badgeClass}>
                  <IdCardIcon className="mr-1 h-4 w-4" />
                  {t("form.barcode")}: {data.barcode}
                </Badge>

                {data.brandId && (
                  <Badge
                    variant="success"
                    className={`bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ${badgeClass}`}
                  >
                    {t("form.brand")}: {brandName || data.brandId}
                  </Badge>
                )}

                {data.categoryId && (
                  <Badge
                    variant="primary"
                    className={`border-none bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 ${badgeClass}`}
                  >
                    {t("form.category")}: {categoryName || data.categoryId}
                  </Badge>
                )}

                {data.expirationDate && (
                  <Badge
                    variant="error"
                    className={`flex items-center gap-1 ${badgeClass}`}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {t("form.expirationDate")}:{" "}
                    {format(new Date(data.expirationDate), "dd MMM yyyy", {
                      locale: es,
                    })}
                  </Badge>
                )}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        </Accordion.Root>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          {data.sku && (
            <Badge
              variant="outline"
              className={`border-dashed font-mono ${badgeClass}`}
            >
              {t("form.sku")}: {data.sku}
            </Badge>
          )}

          <Badge variant="secondary" className={badgeClass}>
            <IdCardIcon className="mr-1 h-4 w-4" />
            {t("form.barcode")}: {data.barcode}
          </Badge>

          {data.brandId && (
            <Badge
              variant="success"
              className={`bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ${badgeClass}`}
            >
              {t("form.brand")}: {brandName || data.brandId}
            </Badge>
          )}

          {data.categoryId && (
            <Badge
              variant="primary"
              className={`border-none bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 ${badgeClass}`}
            >
              {t("form.category")}: {categoryName || data.categoryId}
            </Badge>
          )}

          {data.expirationDate && (
            <Badge
              variant="error"
              className={`flex items-center gap-1 ${badgeClass}`}
            >
              <CalendarIcon className="h-4 w-4" />
              {t("form.expirationDate")}:{" "}
              {format(new Date(data.expirationDate), "dd MMM yyyy", {
                locale: es,
              })}
            </Badge>
          )}
        </div>
      )}

      {data.description && (
        <div className="mt-3 flex flex-col border-t border-gray-200 pt-3 dark:border-gray-700 sm:mt-4 sm:pt-4 md:flex-row md:items-center md:gap-6">
          <p className={descriptionTextClass}>
            <span className={descriptionLabelClass}>
              {t("form.description")}:
            </span>
            {data.description}
          </p>
        </div>
      )}
    </div>
  );
}

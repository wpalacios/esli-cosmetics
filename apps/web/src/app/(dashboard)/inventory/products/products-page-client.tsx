"use client";

import { useCallback, useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useSearchProduct,
  useProducts,
  useDeleteProduct,
} from "@/hooks/use-products";
import { ProductModal } from "@/components/modals/products-modal";
import { ProductKitsModal } from "@/components/modals/product-kits-modal";
import { ProductsTable } from "@/components/tables/products-table";
import {
  ProductWithRelations,
  ProductsResponse,
  ProductType,
} from "@esli-cosmetics/types";
import { Button, SearchInput, SearchableSelect } from "@esli-cosmetics/ui";
import { ConfirmationDialog, useConfirmationDialog } from "@/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { ProductCreationResult } from "@/components/forms/products-form";
import { useTranslation } from "react-i18next";
import { getBrands } from "@/actions/brands";
import { getCategories } from "@/actions/categories";
import { exportProductCatalogPdf } from "@/actions/reports";
import { CreateProductDropdown } from "./components/dropdown-create-product";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { usePageSizeParam } from "@/hooks/use-page-size-param";

/** Radix Select forbids `value=""` on items; reserved for clearing — use sentinel for "all" */
const PRODUCT_FILTER_ALL = "__all__";

interface ProductsPageClientProps {
  initialData: ProductsResponse;
}

function downloadBase64Pdf(fileName: string, base64String: string) {
  const byteCharacters = atob(base64String);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

export function ProductsPageClient({ initialData }: ProductsPageClientProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const { pageSize, setPageSize, pageSizeOptions } = usePageSizeParam();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSearchTerm, setActiveSearchTerm] = useState("");
  const [filterBrandId, setFilterBrandId] = useState(PRODUCT_FILTER_ALL);
  const [filterCategoryId, setFilterCategoryId] = useState(PRODUCT_FILTER_ALL);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [catalogExporting, setCatalogExporting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<
    ProductWithRelations | undefined
  >();
  const confirmationDialog = useConfirmationDialog();
  const { toast } = useToast();
  const { t } = useTranslation("products");

  const [selectedProductType, setSelectedProductType] = useState<
    ProductType | undefined
  >(undefined);
  const { t: tCommon } = useTranslation("common");

  const brandQuery =
    filterBrandId === PRODUCT_FILTER_ALL ? undefined : filterBrandId;
  const categoryQuery =
    filterCategoryId === PRODUCT_FILTER_ALL ? undefined : filterCategoryId;

  const {
    data: searchData,
    isLoading: isSearchLoading,
    error: searchError,
    refetch: refetchSearch,
  } = useSearchProduct(
    activeSearchTerm,
    currentPage,
    pageSize,
    undefined,
    brandQuery,
    categoryQuery
  );

  const {
    data: productsDataAll,
    isLoading: isProductsLoading,
    error: productsError,
    refetch: refetchProducts,
  } = useProducts({
    page: currentPage,
    limit: pageSize,
    ...(brandQuery ? { brandId: brandQuery } : {}),
    ...(categoryQuery ? { categoryId: categoryQuery } : {}),
  });

  const { data: brandsResponse } = useQuery({
    queryKey: ["brands", "product-filters"],
    queryFn: () => getBrands({ page: 1, limit: 500 }),
  });

  const { data: categoriesResponse } = useQuery({
    queryKey: ["categories", "product-filters"],
    queryFn: () => getCategories({ page: 1, limit: 500 }),
  });

  const brandOptions = useMemo(() => {
    const all = { value: PRODUCT_FILTER_ALL, label: t("filters.allBrands") };
    const rows = brandsResponse?.data ?? [];
    const sorted = [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return [all, ...sorted.map(b => ({ value: b.id, label: b.name }))];
  }, [brandsResponse?.data, t]);

  const categoryOptions = useMemo(() => {
    const all = {
      value: PRODUCT_FILTER_ALL,
      label: t("filters.allCategories"),
    };
    const rows = categoriesResponse?.data ?? [];
    const sorted = [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
    return [all, ...sorted.map(c => ({ value: c.id, label: c.name }))];
  }, [categoriesResponse?.data, t]);

  const isSearching = !!activeSearchTerm;

  const data = isSearching ? searchData : productsDataAll;
  const isLoading = isSearching ? isSearchLoading : isProductsLoading;
  const error = isSearching ? searchError : productsError;
  const refetch = isSearching ? refetchSearch : refetchProducts;

  const deleteProductMutation = useDeleteProduct();

  const handleEditProduct = useCallback((product: ProductWithRelations) => {
    const isActuallyAKit =
      product.type === ProductType.KIT ||
      (Array.isArray(product.kitItems) && product.kitItems.length > 0);

    const type = isActuallyAKit ? ProductType.KIT : ProductType.STANDARD;

    setEditingProduct(product);
    setSelectedProductType(type);
    setIsModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingProduct(undefined);
    setSelectedProductType(undefined);
  }, []);

  const handleSuccess = useCallback(
    async (
      action: "create" | "update" | "delete",
      resultOrName: ProductCreationResult | string | undefined
    ) => {
      await refetch();

      const isKit =
        editingProduct?.type === ProductType.KIT ||
        selectedProductType === ProductType.KIT ||
        (typeof resultOrName === "object" &&
          (resultOrName as { type?: ProductType })?.type === ProductType.KIT);

      if (!(action === "create" && isKit)) {
        const productName =
          typeof resultOrName === "string"
            ? resultOrName
            : (resultOrName as ProductCreationResult)?.name ||
              t("common.product");

        const messages = {
          create: {
            title: t("toast.created"),
            description: t("toast.createdDesc", { name: productName }),
          },
          update: {
            title: t("toast.updated"),
            description: t("toast.updatedDesc", {
              name: productName || t("common.product"),
            }),
          },
          delete: {
            title: t("toast.deleted"),
            description: t("toast.deletedDesc", {
              name: productName || t("common.product"),
            }),
          },
        };

        toast({
          type: "success",
          title: messages[action].title,
          description: messages[action].description,
          duration: 5000,
        });
      }
    },
    [refetch, toast, t, editingProduct, selectedProductType]
  );

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback(
    (size: number) => {
      setPageSize(size);
      setCurrentPage(1);
    },
    [setPageSize]
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setActiveSearchTerm(value);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterBrandId, filterCategoryId]);

  const productsData = data || initialData;

  const handleDeleteProduct = useCallback(
    async (id: string) => {
      const product = productsData.products?.find(p => p.id === id);
      const productName = product?.name || t("common.product");

      const confirmed = await confirmationDialog.openDialog({
        title: t("confirm.deleteTitle"),
        description: t("confirm.deleteDesc", { name: productName }),
        confirmText: t("confirm.deleteButton"),
        cancelText: t("confirm.cancel"),
        variant: "destructive",
      });

      if (confirmed) {
        try {
          await deleteProductMutation.mutateAsync(id);
          handleSuccess("delete", productName);
        } catch {
          toast({
            type: "error",
            title: t("toast.deleteFailed"),
            description: t("toast.deleteFailedDesc"),
            duration: 5000,
          });
        }
      }
    },
    [
      deleteProductMutation,
      productsData.products,
      confirmationDialog,
      handleSuccess,
      toast,
      t,
    ]
  );

  const handleSelectProductType = useCallback((type: ProductType) => {
    setEditingProduct(undefined);
    setSelectedProductType(type);
    setIsModalOpen(true);
  }, []);

  const handlePrintCatalog = useCallback(async () => {
    setCatalogExporting(true);
    try {
      const trimmedSearch = activeSearchTerm.trim();
      const catalogBrandId =
        filterBrandId === PRODUCT_FILTER_ALL ? undefined : filterBrandId;
      const catalogCategoryId =
        filterCategoryId === PRODUCT_FILTER_ALL ? undefined : filterCategoryId;
      const pdf = await exportProductCatalogPdf({
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
        ...(catalogBrandId ? { brandId: catalogBrandId } : {}),
        ...(catalogCategoryId ? { categoryId: catalogCategoryId } : {}),
      });
      downloadBase64Pdf(pdf.fileName, pdf.base64);
      toast({
        type: "success",
        title: t("catalogExport.successTitle"),
        description: t("catalogExport.successDescription"),
        duration: 5000,
      });
    } catch (err) {
      console.error(err);
      toast({
        type: "error",
        title: t("catalogExport.errorTitle"),
        description: t("catalogExport.errorDescription"),
        duration: 6000,
      });
    } finally {
      setCatalogExporting(false);
    }
  }, [activeSearchTerm, filterBrandId, filterCategoryId, t, toast]);

  const totalItems = productsData.total ?? 0;
  const totalPages = Math.ceil(totalItems / pageSize);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t("page.title")}
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {t("page.subtitle")}
            </p>
          </div>
          <CreateProductDropdown
            onSelectType={handleSelectProductType}
            onPrintCatalog={handlePrintCatalog}
            isExporting={catalogExporting}
          >
            <Button
              variant="primary"
              type="button"
              className="w-full md:w-auto"
              disabled={catalogExporting}
              rightIcon={<ChevronDownIcon className="h-4 w-4" />}
            >
              {t("page.addButton")}
            </Button>
          </CreateProductDropdown>
        </div>

        <div className="sm:p-7.5 rounded-[10px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800 dark:shadow-none">
          <div className="text-center">
            <div className="mb-4 text-red-600 dark:text-red-400">
              {t("table.error")}
            </div>
            <Button onClick={() => refetch()} variant="outline">
              {t("common.retry")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4 md:flex-row md:items-center md:justify-between md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t("page.title")}
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {t("page.subtitle")}
          </p>
        </div>
        <CreateProductDropdown
          onSelectType={handleSelectProductType}
          onPrintCatalog={handlePrintCatalog}
          isExporting={catalogExporting}
        >
          <Button
            variant="primary"
            type="button"
            className="w-full md:w-auto"
            disabled={catalogExporting}
            rightIcon={<ChevronDownIcon className="h-4 w-4" />}
          >
            {t("page.addButton")}
          </Button>
        </CreateProductDropdown>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative w-full min-w-0 flex-1 md:w-auto md:max-w-md">
          <SearchInput
            placeholder={t("page.searchPlaceholder")}
            value={searchTerm}
            onChange={handleSearchChange}
            onSearch={handleSearch}
            minLength={0}
            translations={{
              hintPressEnter: tCommon("ui.searchInput.hintPressEnter"),
              hintToSearch: tCommon("ui.searchInput.hintToSearch"),
              hintToFocus: tCommon("ui.searchInput.hintToFocus"),
              hintEnter: tCommon("ui.searchInput.hintEnter"),
              hintCmd: tCommon("ui.searchInput.hintCmd"),
              hintCtrl: tCommon("ui.searchInput.hintCtrl"),
            }}
          />
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[14rem]">
          <SearchableSelect
            options={brandOptions}
            value={filterBrandId}
            onValueChange={setFilterBrandId}
            placeholder={t("filters.brandPlaceholder")}
            searchPlaceholder={t("filters.brandSearch")}
            emptyMessage={t("filters.empty")}
            className="w-full"
          />
          <SearchableSelect
            options={categoryOptions}
            value={filterCategoryId}
            onValueChange={setFilterCategoryId}
            placeholder={t("filters.categoryPlaceholder")}
            searchPlaceholder={t("filters.categorySearch")}
            emptyMessage={t("filters.empty")}
            className="w-full"
          />
        </div>
      </div>

      <ProductsTable
        data={productsData.products ?? []}
        onEdit={handleEditProduct}
        onDelete={handleDeleteProduct}
        isLoading={isLoading}
        pagination={{
          currentPage,
          totalPages,
          onPageChange: handlePageChange,
          totalItems,
          pageSize,
          onPageSizeChange: handlePageSizeChange,
          pageSizeOptions,
        }}
      />

      {isModalOpen &&
        (selectedProductType === ProductType.KIT ? (
          <ProductKitsModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            product={editingProduct}
            onSuccess={handleSuccess}
          />
        ) : (
          <ProductModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            product={editingProduct}
            productType={selectedProductType}
            onSuccess={handleSuccess}
          />
        ))}

      <ConfirmationDialog {...confirmationDialog.dialogProps} />
    </div>
  );
}

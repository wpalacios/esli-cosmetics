"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Label,
  Input,
} from "@esli-cosmetics/ui";
import { SkeletonInput } from "@/components/ui";
import { BiPrinter, BiSave } from "react-icons/bi";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import * as Accordion from "@radix-ui/react-accordion";
import {
  type SupplierOrder,
  type Supplier,
  type ProductVariant,
  type ApiProductVariant,
  type PurchaseOrderItem as BasePurchaseOrderItem,
  type UpdateSupplierOrder,
  ProductType,
} from "@esli-cosmetics/types";
import {
  useGetVariantsByBrand,
  useExportSupplierOrderPdf,
  useUpdateSupplierOrder,
} from "@/hooks/use-supplier-order";
import { SupplierSelect } from "@/components/ui/supplier-select";
import { SupplierBrandSelect } from "@/components/ui/supplier-brand-select";
import {
  ProductVariantSelectTable,
  type TableVariant,
} from "@/components/tables/product-variant-select-table";
import { SupplierOrderSelectedTable } from "@/components/tables/supplier-order-selected-table";
import { useSupplier } from "~/hooks/use-suppliers";
import { cn, formatCurrency } from "@esli-cosmetics/utils";
import { ProductVariantBrandSelect } from "@/components/ui/product-variant-select-by-brand";

type PurchaseOrderItemDTO = BasePurchaseOrderItem & {
  productVariantId?: string;
  unitCost?: number;
  productVariantName?: string;
  productVariant?: ProductVariant;
};

const AccordionItem = ({
  children,
  value,
  ...props
}: { children: React.ReactNode; value: string } & React.ComponentProps<
  typeof Accordion.Item
>) => (
  <Accordion.Item
    value={value}
    className="rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800"
    {...props}
  >
    {children}
  </Accordion.Item>
);

const AccordionTrigger = ({
  children,
  ...props
}: { children: React.ReactNode } & React.ComponentProps<
  typeof Accordion.Trigger
>) => (
  <Accordion.Header className="flex">
    <Accordion.Trigger
      className="group flex flex-1 items-center justify-between px-4 py-3 text-left font-semibold text-gray-900 outline-none transition-colors hover:bg-gray-50/50 focus:bg-gray-50/50 dark:text-white dark:hover:bg-gray-700/50"
      {...props}
    >
      {children}
      <ChevronDownIcon className="h-5 w-5 text-gray-600 transition-transform duration-300 group-data-[state=open]:rotate-180 dark:text-gray-400" />
    </Accordion.Trigger>
  </Accordion.Header>
);

const AccordionContent = ({
  children,
  ...props
}: { children: React.ReactNode } & React.ComponentProps<
  typeof Accordion.Content
>) => (
  <Accordion.Content
    className="overflow-hidden transition-all duration-300 ease-in-out data-[state=open]:overflow-visible"
    {...props}
  >
    <div className="p-3 pt-0 sm:p-6">{children}</div>
  </Accordion.Content>
);

const downloadBase64Pdf = (fileName: string, base64String: string) => {
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
};

type VariantType = ProductVariant | ApiProductVariant;

type SelectedItem = {
  variant: ApiProductVariant;
  quantity: number;
  costPrice: number;
};

type SupplierOrderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<any>;
  editingOrder?: UpdateSupplierOrder;
  isLoading?: boolean;
  supplierOptions: Supplier[];
  productVariantOptions?: ProductVariant[];
  isEditMode?: boolean; // Flag to indicate we're editing even if data isn't loaded yet
};

export function SupplierOrderModal({
  isOpen,
  onClose,
  onSave,
  editingOrder,
  isLoading = false,
  supplierOptions,
  isEditMode = false,
}: SupplierOrderModalProps) {
  const { t } = useTranslation("supplier-order");

  const orderSchema = z.object({
    supplierId: z
      .string()
      .min(1, t("form.supplierRequired", "El proveedor es obligatorio")),
    brandId: z.string().min(1, "La marca es obligatoria"),
    expected_date: z.string().optional(),
    items: z
      .array(
        z.object({
          productVariantId: z.string(),
          quantity: z
            .number()
            .min(1, t("form.quantityRequired", "Cantidad > 0")),
          unitCost: z.number().min(0, "Costo inválido"),
        })
      )
      .min(
        1,
        t("validation.noItems", "Debes seleccionar al menos un producto")
      ),
  });

  type OrderFormData = z.infer<typeof orderSchema>;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<SupplierOrder | null>(null);

  const [variantsPage, setVariantsPage] = useState(1);
  const variantsPageSize = 6;

  const methods = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      supplierId: "",
      brandId: "",
      expected_date: "",
      items: [],
    },
    mode: "onChange",
  });

  const {
    watch,
    setValue,
    reset,
    handleSubmit: submitForm,
    formState: { errors },
  } = methods;

  const selectedSupplierId = watch("supplierId");
  const selectedBrandId = watch("brandId");

  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(
    new Map()
  );

  useEffect(() => {
    const itemsArray = Array.from(selectedItems.values()).map(item => ({
      productVariantId: item.variant.id,
      quantity: item.quantity,
      unitCost: item.costPrice,
    }));

    setValue("items", itemsArray, {
      shouldValidate: selectedItems.size > 0,
    });
  }, [selectedItems, setValue]);

  const { mutate: exportPdf, isPending: isPrinting } =
    useExportSupplierOrderPdf();

  const { data: supplierFullData, isLoading: isLoadingSupplierBrands } =
    useSupplier(
      selectedSupplierId && selectedSupplierId !== "undefined"
        ? selectedSupplierId
        : ""
    );

  const { data: stockData, isLoading: isLoadingStock } = useGetVariantsByBrand(
    selectedBrandId,
    variantsPage,
    variantsPageSize
  );

  const brandsBySupplier = useMemo(() => {
    if (!supplierFullData?.brands) return [];
    return supplierFullData.brands.map((sb: any) => ({
      id: sb.brandId,
      name: sb.brandName,
      ...sb.brand,
    }));
  }, [supplierFullData]);

  // Get current supplier from supplierOptions when editing
  const currentSupplier = useMemo(() => {
    if (!editingOrder?.supplierId || !supplierOptions) return undefined;
    return supplierOptions.find(sup => sup.id === editingOrder.supplierId);
  }, [editingOrder?.supplierId, supplierOptions]);

  // Get current brand from brandsBySupplier when editing
  const currentBrand = useMemo(() => {
    if (!editingOrder?.brandId || !brandsBySupplier.length) return undefined;
    return brandsBySupplier.find(brand => brand.id === editingOrder.brandId);
  }, [editingOrder?.brandId, brandsBySupplier]);

  const brandVariants = useMemo<ProductVariant[]>(() => {
    const list = stockData?.data || [];
    if (!selectedBrandId || !Array.isArray(list)) return [];
    return list.map((v: any) => ({
      ...v,
      id: v.id,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      costPrice: Number(v.costPrice || 0),
      product: v.product || {},
      isActive: ("isActive" in v && v.isActive) || true,
      createdAt: v.createdAt ?? new Date(),
      updatedAt: v.updatedAt ?? new Date(),
    }));
  }, [stockData, selectedBrandId]);

  const serverPagination = useMemo(() => {
    return (
      stockData?.pagination || {
        total: 0,
        totalPages: 1,
        page: 1,
        limit: variantsPageSize,
      }
    );
  }, [stockData]);

  useEffect(() => {
    setVariantsPage(1);
    setSelectedVariant(null);
  }, [selectedBrandId]);

  useEffect(() => {
    if (isOpen) {
      if (editingOrder?.supplierId != null) {
        setValue("supplierId", editingOrder.supplierId, {
          shouldValidate: true,
        });

        let brandId =
          (editingOrder as any).brandId ||
          (editingOrder as any).brand_id ||
          editingOrder.purchaseOrderItems?.[0]?.product_variant?.product?.brand;

        if (brandId && typeof brandId === "object" && "id" in brandId) {
          brandId = brandId.id;
        }

        setValue(
          "brandId",
          editingOrder.brandId ? String(editingOrder.brandId) : "",
          {
            shouldValidate: true,
          }
        );

        if (
          editingOrder.purchaseOrderItems &&
          editingOrder.purchaseOrderItems.length > 0
        ) {
          const itemsMap = new Map<string, SelectedItem>();
          const orderItems: PurchaseOrderItemDTO[] =
            editingOrder.purchaseOrderItems ?? [];

          orderItems.forEach(item => {
            const variantId = item.productVariantId || item.product_variant_id;
            if (!variantId) return;

            const rawUnitCost = item.unitCost ?? item.unit_cost;
            const unitCost =
              rawUnitCost === null || rawUnitCost === undefined
                ? 0
                : Number(rawUnitCost);

            const productVariant = item.productVariant || item.product_variant;

            let skuValue =
              productVariant?.sku ||
              (productVariant?.product && productVariant.product.sku) ||
              "";

            let stockLevel = undefined;
            let quantity = undefined;
            if (Array.isArray(brandVariants)) {
              const found = brandVariants.find(v => v.id === variantId);
              if (found) {
                skuValue =
                  found.sku || (found.product && found.product.sku) || skuValue;
                stockLevel = found.stock_levels;
                quantity = Array.isArray(found.stock_levels)
                  ? found.stock_levels.reduce(
                      (sum, sl) => sum + (sl.quantity ?? 0),
                      0
                    )
                  : undefined;
              }
            }
            if (!skuValue) {
              skuValue = "NO-SKU";
            }

            const variantData: ApiProductVariant = {
              id: String(variantId),
              name:
                productVariant?.name ||
                item.productVariantName ||
                "Producto Cargado",
              sku: skuValue,
              costPrice: unitCost,
              prices: [],
              isActive: true,
              isDeleted: false,
              createdAt: new Date(),
              updatedAt: new Date(),
              productId: productVariant?.product_id || "",
              barcode: productVariant?.barcode || "",
              ...(stockLevel ? { stockLevel } : {}),
              ...(quantity !== undefined ? { quantity } : {}),
              type: ProductType.STANDARD,
            };

            itemsMap.set(String(variantId), {
              variant: variantData,
              quantity: Number(item.quantity),
              costPrice: unitCost,
            });
          });
          setSelectedItems(itemsMap);
        } else {
          setSelectedItems(new Map());
        }
      } else {
        if (!selectedSupplierId && !selectedBrandId) {
          reset({
            supplierId: "",
            brandId: "",
            expected_date: "",
            items: [],
          });
          setSelectedItems(new Map());
          setCreatedOrder(null);
          setVariantsPage(1);
        }
      }
    }
  }, [isOpen, editingOrder, reset, setValue]);

  const handleToggleProduct = (variant: TableVariant, checked: boolean) => {
    const newMap = new Map(selectedItems);
    if (checked) {
      const apiVariant: ApiProductVariant = {
        ...variant,
        id: variant.id,
        name: variant.name,
        sku: variant.sku || (variant.product && variant.product.sku) || "",
        costPrice: Number(variant.costPrice || 0),
      } as ApiProductVariant;

      newMap.set(variant.id, {
        variant: apiVariant,
        quantity: 1,
        costPrice: Number(variant.costPrice || 0),
      });
    } else {
      newMap.delete(variant.id);
    }
    setSelectedItems(newMap);
  };

  const handleQuantityChange = (variantId: string, qty: number) => {
    const item = selectedItems.get(variantId);
    if (item) {
      const newMap = new Map(selectedItems);
      newMap.set(variantId, { ...item, quantity: qty });
      setSelectedItems(newMap);
    }
  };

  const handleCostChange = (variantId: string, cost: number) => {
    const item = selectedItems.get(variantId);
    if (item) {
      const newMap = new Map(selectedItems);
      newMap.set(variantId, { ...item, costPrice: cost });
      setSelectedItems(newMap);
    }
  };

  const handleRemoveItem = (variantId: string) => {
    const item = selectedItems.get(variantId);
    if (item) {
      const newMap = new Map(selectedItems);
      newMap.delete(variantId);
      setSelectedItems(newMap);
    }
  };

  const { mutate: updateSupplierOrder } = useUpdateSupplierOrder();

  const onSubmit = async (data: OrderFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const itemsArray = Array.from(selectedItems.values()).map(item => ({
      productVariantId: item.variant.id,
      quantity:
        localQuantities[item.variant.id] &&
        localQuantities[item.variant.id] !== ""
          ? Number(localQuantities[item.variant.id])
          : Number(item.quantity),
      unitCost: item.costPrice,
    }));

    const payload: any = {
      supplierId: data.supplierId,
      items: itemsArray,
    };
    if (data.expected_date) {
      payload.expectedDate = new Date(data.expected_date).toISOString();
    }

    try {
      if (editingOrder?.id) {
        updateSupplierOrder(
          { id: editingOrder.id, data: payload },
          {
            onSuccess: result => {
              handleClose();
              if (result.id) {
                exportPdf(result.id, {
                  onSuccess: (pdfResult: {
                    fileName: string;
                    base64: string;
                  }) => downloadBase64Pdf(pdfResult.fileName, pdfResult.base64),
                  onError: (err: any) => {
                    console.error(
                      "Error al exportar PDF después de actualizar:",
                      err
                    );
                  },
                });
              }
            },
            onError: error => {
              console.error(error);
              setIsSubmitting(false);
            },
          }
        );
      } else {
        const result = await onSave(payload);
        const orderToPrintId = result?.id;
        if (orderToPrintId) {
          handleClose();
          exportPdf(orderToPrintId, {
            onSuccess: (pdfResult: { fileName: string; base64: string }) =>
              downloadBase64Pdf(pdfResult.fileName, pdfResult.base64),
            onError: (err: any) => {
              console.error("Error al exportar PDF después de guardar:", err);
              throw new Error(
                "La orden se guardó, pero no se pudo generar el PDF."
              );
            },
          });
        } else {
          handleClose();
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isPrinting) {
      setCreatedOrder(null);
      reset();
      setSelectedItems(new Map());
      setSelectedVariant(null);
      setLocalQuantities({});
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen && !editingOrder) {
      reset({
        supplierId: "",
        brandId: "",
        expected_date: "",
        items: [],
      });
      setSelectedItems(new Map());
      setSelectedVariant(null);
      setLocalQuantities({});
      setCreatedOrder(null);
      setVariantsPage(1);
    }
  }, [isOpen, editingOrder, reset]);

  const handlePrint = () => {
    if (!createdOrder?.id) return;
    exportPdf(createdOrder.id, {
      onSuccess: (result: { fileName: string; base64: string }) =>
        downloadBase64Pdf(result.fileName, result.base64),
      onError: (err: any) => console.error(err),
    });
  };

  // Show skeleton when loading order data for editing
  const isLoadingOrderData = isEditMode && isLoading && !editingOrder;

  const [localQuantities, setLocalQuantities] = useState<
    Record<string, string>
  >({});

  const orderTotal = useMemo(() => {
    return Array.from(selectedItems.values()).reduce((acc, item) => {
      const qty =
        localQuantities[item.variant.id] &&
        localQuantities[item.variant.id] !== ""
          ? Number(localQuantities[item.variant.id])
          : Number(item.quantity) || 0;
      return acc + qty * Number(item.costPrice);
    }, 0);
  }, [selectedItems, localQuantities]);

  useEffect(() => {
    // Build the new quantities object
    const updated: Record<string, string> = {};
    Array.from(selectedItems.values()).forEach(item => {
      updated[item.variant.id] = String(item.quantity);
    });

    // Only update if the contents are different
    setLocalQuantities(prev => {
      const prevKeys = Object.keys(prev);
      const updatedKeys = Object.keys(updated);
      if (
        prevKeys.length === updatedKeys.length &&
        prevKeys.every(k => updated[k] === prev[k])
      ) {
        return prev;
      }
      return updated;
    });
  }, [
    Array.from(selectedItems.entries())
      .map(([k, v]) => `${k}:${v.quantity}`)
      .join(","),
  ]);

  const [selectedVariant, setSelectedVariant] = useState<TableVariant | null>(
    null
  );

  const handleVariantSelect = (variant: TableVariant | null) => {
    setSelectedVariant(variant);
  };

  const filterByBrand = (v: TableVariant) => {
    const brandValue = v.product?.brand;
    if (!brandValue) return false;
    if (
      typeof brandValue === "object" &&
      brandValue !== null &&
      "id" in brandValue &&
      typeof (brandValue as { id?: unknown }).id === "string"
    ) {
      return (brandValue as { id: string }).id === selectedBrandId;
    }
    return brandValue === selectedBrandId;
  };

  // centralized all variants by brand fetching
  const { data: allBrandVariantsData, isLoading: isLoadingAllBrandVariants } =
    useGetVariantsByBrand(selectedBrandId, 1, 1000);
  const allBrandVariants = allBrandVariantsData?.data || [];

  const maxVariantsToShow = 6;
  const limitedBrandVariants = allBrandVariants.slice(0, maxVariantsToShow);

  const getStockFromVariant = (variant: any): number => {
    if (!variant) return 0;

    const stockLevels =
      variant.product?.stockLevels ||
      variant.stockLevels ||
      variant.product?.stock_levels ||
      variant.stock_levels;

    if (Array.isArray(stockLevels)) {
      return stockLevels.reduce(
        (acc: number, item: any) => acc + Number(item.quantity || 0),
        0
      );
    }

    if (variant.stockLevel?.quantity !== undefined)
      return Number(variant.stockLevel.quantity);
    if (variant.stock_level?.quantity !== undefined)
      return Number(variant.stock_level.quantity);

    return Number(variant.quantity || 0);
  };

  const normalizeForTable = (items: SelectedItem[]) => {
    return items.map(item => {
      const variant: any = item.variant || {};
      const updatedVariant =
        allBrandVariants.find((v: any) => v.id === variant.id) || variant;
      const stockQty =
        typeof updatedVariant.quantity === "number"
          ? updatedVariant.quantity
          : (updatedVariant.stockLevel?.quantity ??
            getStockFromVariant(updatedVariant));

      const createdAt =
        typeof updatedVariant.createdAt === "string"
          ? updatedVariant.createdAt
          : updatedVariant.createdAt instanceof Date
            ? updatedVariant.createdAt.toISOString()
            : new Date().toISOString();

      const updatedAt =
        typeof updatedVariant.updatedAt === "string"
          ? updatedVariant.updatedAt
          : updatedVariant.updatedAt instanceof Date
            ? updatedVariant.updatedAt.toISOString()
            : new Date().toISOString();

      const variantForTable = {
        id: String(updatedVariant.id ?? ""),
        name: updatedVariant.name ?? "",
        sku: updatedVariant.sku ?? updatedVariant.product?.sku ?? "NO-SKU",
        costPrice: Number(
          updatedVariant.costPrice ?? updatedVariant.cost_price ?? 0
        ),
        quantity: Number(stockQty),
        isEmpty: false,
        createdAt,
        updatedAt,
        deletedAt: updatedVariant.deletedAt ?? null,
        stockLevel: { quantity: Number(stockQty) },
        product: updatedVariant.product ?? {},
      };

      return {
        variant: variantForTable,
        quantity: Number(item.quantity ?? 0),
        costPrice: Number(item.costPrice ?? 0),
      } as any;
    });
  };

  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && editingOrder && selectedItems.size > 0) {
      const ids = Array.from(selectedItems.keys());
      setSelectedVariantIds(ids);
    }
  }, [isOpen, editingOrder, selectedItems.size]);

  useEffect(() => {
    const ids = Array.from(selectedItems.keys());
    if (
      ids.length !== selectedVariantIds.length ||
      !ids.every((id, i) => id === selectedVariantIds[i])
    ) {
      setSelectedVariantIds(ids);
    }
  }, [selectedItems]);

  const handleBrandSelectChange = useCallback(
    (ids: string[]) => {
      const newMap = new Map(selectedItems);

      ids.forEach(id => {
        if (!newMap.has(id)) {
          const found = allBrandVariants.find((v: any) => v.id === id);
          if (found) {
            const apiVariant: ApiProductVariant = {
              ...found,
              id: found.id,
              name: found.name,
              sku: found.sku || (found.product && found.product.sku) || "",
              costPrice: Number(found.costPrice || 0),
            };
            newMap.set(found.id, {
              variant: apiVariant,
              quantity: 1,
              costPrice: Number(found.costPrice || 0),
            });
          }
        }
      });

      Array.from(selectedItems.keys()).forEach(id => {
        if (!ids.includes(id)) {
          newMap.delete(id);
        }
      });

      setSelectedItems(newMap);
      setSelectedVariantIds(ids);
    },
    [selectedItems, allBrandVariants]
  );

  const [searchTerm, setSearchTerm] = useState("");

  const filteredBrandVariants = useMemo(() => {
    if (!searchTerm) return allBrandVariants;
    const term = searchTerm.toLowerCase();
    return allBrandVariants.filter(
      (v: any) =>
        v.name?.toLowerCase().includes(term) ||
        v.sku?.toLowerCase().includes(term) ||
        v.barcode?.toLowerCase().includes(term)
    );
  }, [allBrandVariants, searchTerm]);

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent
        size="full"
        className="max-h-[95vh] max-w-full overflow-y-auto sm:max-w-9xl"
        showCloseButton={true}
      >
        <ModalHeader className="px-4 sm:px-6">
          <ModalTitle className="text-lg sm:text-xl">
            {editingOrder ? t("modal.editTitle") : t("modal.createTitle")}
          </ModalTitle>
        </ModalHeader>

        <div className="space-y-4 px-2 pb-4 sm:space-y-6 sm:px-6 sm:pb-6">
          {isLoadingOrderData ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Skeleton for form fields */}
              <div className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800 sm:space-y-4 sm:p-6">
                <div className="grid w-full grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                  <div className="flex flex-col space-y-2">
                    <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <SkeletonInput />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <div className="h-3 w-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <SkeletonInput />
                  </div>
                  <div className="flex flex-col space-y-2">
                    <div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                    <SkeletonInput />
                  </div>
                </div>
              </div>

              {/* Skeleton for tables */}
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
                <div className="h-[600px] space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800 sm:space-y-4 sm:p-6">
                  <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="h-16 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
                      />
                    ))}
                  </div>
                </div>
                <div className="h-[600px] space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800 sm:space-y-4 sm:p-6">
                  <div className="h-6 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div
                        key={i}
                        className="h-20 animate-pulse rounded bg-gray-200 dark:bg-gray-700"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : !createdOrder ? (
            <FormProvider {...methods}>
              <form
                id="order-form"
                onSubmit={submitForm(onSubmit)}
                className="flex flex-col space-y-4 sm:space-y-6"
              >
                <Accordion.Root
                  type="single"
                  collapsible
                  defaultValue="general-data"
                  className="relative z-40 w-full space-y-2"
                >
                  <AccordionItem value="general-data">
                    <AccordionTrigger>
                      {t("modal.generalData")}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="grid w-full grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-3">
                        {/* Supplier Select */}
                        <div className="relative z-30 flex w-full flex-col">
                          <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {t("form.supplier")}
                          </Label>
                          <SupplierSelect
                            value={selectedSupplierId ?? ""}
                            onChange={val => {
                              if (!!editingOrder) return;
                              setValue("supplierId", val || "", {
                                shouldValidate: true,
                              });
                              setValue("brandId", "", {
                                shouldValidate: true,
                              });
                              // Only clear selected items when creating a new order
                              if (!editingOrder) {
                                setSelectedItems(new Map());
                              }
                            }}
                            options={supplierOptions}
                            disabled={isSubmitting || isLoading}
                            lockSupplier={!!editingOrder}
                            error={errors.supplierId?.message ?? ""}
                            className="h-10 w-full text-sm shadow-sm transition-all"
                            {...(currentSupplier ? { currentSupplier } : {})}
                          />
                        </div>

                        {/* Brand Select */}
                        <div className="relative z-20 flex w-full flex-col">
                          <Label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                            {t("form.brand", "Marca")}
                          </Label>
                          {selectedSupplierId &&
                          selectedSupplierId !== "undefined" ? (
                            <div className="w-full duration-200 animate-in fade-in slide-in-from-top-1">
                              <SupplierBrandSelect
                                key={selectedSupplierId}
                                value={
                                  selectedBrandId &&
                                  selectedBrandId !== "undefined"
                                    ? selectedBrandId
                                    : undefined
                                }
                                onChange={val => {
                                  setValue("brandId", val || "", {
                                    shouldValidate: true,
                                  });
                                }}
                                brandOptions={brandsBySupplier}
                                disabled={
                                  isSubmitting ||
                                  isLoading ||
                                  isLoadingSupplierBrands
                                }
                                error={errors.brandId?.message ?? ""}
                                supplierId={selectedSupplierId}
                                className="h-10 w-full text-sm shadow-sm transition-all"
                                {...(currentBrand ? { currentBrand } : {})}
                              />
                            </div>
                          ) : (
                            <div className="flex h-10 w-full select-none items-center rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 text-xs italic text-gray-400 dark:border-gray-700 dark:bg-gray-800/50">
                              {t(
                                "form.selectSupplierFirst",
                                "Selecciona proveedor"
                              )}
                            </div>
                          )}
                        </div>

                        {/* Expected Date */}
                        <div className="relative z-10 flex w-full flex-col">
                          <Label
                            htmlFor="expected_date"
                            className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400"
                          >
                            {t("form.expectedDate")}
                          </Label>
                          <Input
                            id="expected_date"
                            type="date"
                            disabled={isSubmitting || isLoading}
                            value={watch("expected_date") || ""}
                            className={cn(
                              "h-10 w-full py-1 text-sm shadow-sm transition-all",
                              errors.expected_date?.message &&
                                "border-red-500 focus:ring-red-200"
                            )}
                            onChange={e => {
                              setValue("expected_date", e.target.value || "", {
                                shouldValidate: true,
                              });
                            }}
                          />
                          {errors.expected_date && (
                            <p className="mt-1.5 text-[10px] font-semibold text-red-500 animate-in fade-in">
                              {errors.expected_date.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion.Root>

                <div className="mb-4 w-full sm:max-w-full md:max-w-full lg:max-w-full xl:max-w-full 2xl:max-w-full">
                  <ProductVariantBrandSelect
                    key={selectedBrandId}
                    brandId={selectedBrandId}
                    onSearch={setSearchTerm}
                    disabled={!selectedBrandId || isLoadingAllBrandVariants}
                    className="h-11 w-full rounded-md text-base shadow-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[1fr_1.3fr]">
                  {/* Selected products */}
                  <div className="flex w-full flex-col space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800 sm:space-y-4 sm:p-6">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
                        {t("modal.selectProducts")}
                      </span>
                      <span className="text-sm font-normal text-gray-500">
                        {filteredBrandVariants.length}{" "}
                        {t("table.results", "results")}
                      </span>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col">
                      <ProductVariantSelectTable
                        key={selectedBrandId}
                        variants={filteredBrandVariants}
                        searchedVariant={selectedVariant || null}
                        selectedIds={Array.from(selectedItems.keys())}
                        onToggle={handleToggleProduct}
                        loading={isLoadingAllBrandVariants}
                        className="flex flex-col rounded-lg border bg-white shadow-sm dark:bg-gray-800"
                        localQuantities={localQuantities}
                        setLocalQuantities={setLocalQuantities}
                        onQuantityChange={handleQuantityChange}
                        showStockBadge={true}
                      />
                    </div>
                  </div>

                  {/* Order details */}
                  <div className="mx-auto flex w-full max-w-6xl flex-col space-y-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700 dark:bg-gray-800 sm:space-y-4 sm:p-6">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white sm:text-xl">
                        {t("modal.orderDetail")}
                      </span>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {t("table.estimatedTotal", "Costo Total")}:{" "}
                          {formatCurrency(orderTotal)}
                        </span>
                        <div className="text-right">
                          {errors.items && (
                            <span className="block text-xs font-medium text-red-500">
                              {errors.items.message}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <SupplierOrderSelectedTable
                      items={normalizeForTable(
                        Array.from(selectedItems.values())
                      )}
                      onQuantityChange={handleQuantityChange}
                      onCostPriceChange={handleCostChange}
                      onRemove={handleRemoveItem}
                      localQuantities={localQuantities}
                      setLocalQuantities={setLocalQuantities}
                      className="mx-auto flex w-full max-w-6xl flex-col rounded-lg border bg-white shadow-sm dark:bg-gray-800"
                      showStockBadge={true}
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-end gap-3 pt-4 sm:flex-row">
                  <Button
                    variant="ghost"
                    onClick={handleClose}
                    disabled={isSubmitting}
                    type="button"
                    className="w-full sm:w-auto"
                  >
                    {t("form.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    loading={isSubmitting}
                    leftIcon={<BiSave className="h-4 w-4" />}
                    className="w-full sm:w-auto"
                  >
                    {editingOrder ? t("form.update") : t("form.create")}
                  </Button>
                </div>
              </form>
            </FormProvider>
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-white p-10 dark:bg-gray-800">
              <div className="mt-6 flex gap-4">
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={handlePrint}
                  disabled={isPrinting}
                  type="button"
                >
                  <BiPrinter className="h-5 w-5" /> {t("form.printReceipt")}
                </Button>
                <Button onClick={handleClose} type="button">
                  {t("form.close")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
}

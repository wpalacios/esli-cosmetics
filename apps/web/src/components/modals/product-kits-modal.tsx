"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ProductWithRelations,
  ApiProductVariant,
  ProductType,
} from "@esli-cosmetics/types";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  Label,
  SearchInput,
} from "@esli-cosmetics/ui";
import { cn } from "@esli-cosmetics/utils";
import { Pencil1Icon, MixerHorizontalIcon } from "@radix-ui/react-icons";
import { useToast } from "@/hooks/toast/use-toast";
import {
  ProductKitStep1Form,
  ProductKitStep1Data,
} from "../forms/product-kits-form";
import { ProductKitsHeader } from "../ui/product-kits-header";
import {
  ProductVariantSelectTable,
  TableVariant,
} from "../tables/product-variant-select-table";
import {
  SupplierOrderSelectedTable,
  SelectedProduct,
  SelectedTableVariant,
} from "../tables/supplier-order-selected-table";
import { useCreateProduct, useUpdateProduct } from "@/hooks/use-products";
import { Stepper } from "../ui/stepper";
import { StepperButtons } from "../ui/stepper-buttons";
import { useAllVariantsWithStock } from "@/hooks/use-product-variants";
import { addProductImage } from "@/actions/product-images";

type SelectedItemState = {
  variant: ApiProductVariant;
  quantity: number;
  costPrice: number;
};

interface ProductKitsModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: ProductWithRelations | undefined;
  onSuccess?: (
    action: "create" | "update",
    result: any
  ) => void | Promise<void>;
}

export function ProductKitsModal({
  isOpen,
  onClose,
  product,
  onSuccess,
}: ProductKitsModalProps) {
  const { t } = useTranslation("products");
  const { toast } = useToast();

  const [kitStep, setKitStep] = useState<1 | 2>(1);
  const [parentData, setParentData] = useState<
    ProductKitStep1Data | undefined
  >();
  const [selectedItems, setSelectedItems] = useState<
    Map<string, SelectedItemState>
  >(new Map());
  const [localQuantities, setLocalQuantities] = useState<
    Record<string, string>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [isStep1Valid, setIsStep1Valid] = useState(false);
  const [pendingKitImageFiles, setPendingKitImageFiles] = useState<File[]>([]);
  const [isSavingKit, setIsSavingKit] = useState(false);
  const kitItemsLoadedRef = useRef(false);

  const step1FormRef = useRef<{ submit: () => void }>(null);
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();

  const steps = useMemo(
    () => [
      { label: "Datos Básicos", icon: <Pencil1Icon className="h-5 w-5" /> },
      {
        label: "Agregar Items",
        icon: <MixerHorizontalIcon className="h-5 w-5" />,
      },
    ],
    []
  );

  // Use server-side search with useAllVariantsWithStock
  // When activeSearchQuery is empty, fetch all variants (with a reasonable limit)
  // When activeSearchQuery has text, use it for server-side filtering
  const trimmedSearch = activeSearchQuery.trim();
  const hasSearch = trimmedSearch.length >= 2;
  const { data: response, isLoading: isFetchingAll } = useAllVariantsWithStock(
    1,
    hasSearch ? 100 : 1000, // Limit results when searching
    hasSearch ? trimmedSearch : undefined
  );

  const allSystemVariants = useMemo(() => response?.data || [], [response]);

  // No client-side filtering needed - server handles it
  const displayVariants = useMemo(() => allSystemVariants, [allSystemVariants]);

  // Handle search - update activeSearchQuery which triggers the API call
  const handleSearch = (query: string) => {
    const trimmed = query.trim();
    // If search is cleared or less than 2 chars, clear the active search
    if (trimmed.length < 2) {
      setActiveSearchQuery("");
      setSearchQuery(""); // Also clear the input
    } else {
      setActiveSearchQuery(trimmed);
    }
  };

  // Handle input change - if input is cleared, also clear active search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    // If input is cleared, immediately clear active search to show all results
    if (value.trim().length === 0) {
      setActiveSearchQuery("");
    }
  };

  // Prevent form submission from search input from bubbling up
  const handleSearchFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  const normalizeForTable = useCallback(
    (items: SelectedItemState[]): SelectedProduct[] => {
      return items.map(item => {
        const variant: any = item.variant || {};

        const updatedVariant =
          allSystemVariants.find((v: any) => v.id === variant.id) || variant;

        const variantForTable: SelectedTableVariant = {
          ...updatedVariant,
          id: updatedVariant.id,
          name: updatedVariant.name ?? "Sin nombre",
          sku: updatedVariant.sku ?? "NO-SKU",
          stockLevel: updatedVariant.stockLevel || { quantity: 0 },
          costPrice: Number(item.costPrice),
          quantity: Number(item.quantity),
          product: updatedVariant.product
            ? {
                id: updatedVariant.product.id,
                name: updatedVariant.product.name,
                sku: updatedVariant.product.sku,
                brand: updatedVariant.product.brand,
              }
            : undefined,
        } as any;

        return {
          variant: variantForTable,
          quantity: item.quantity,
          costPrice: item.costPrice,
        };
      });
    },
    [allSystemVariants]
  );

  const handleSaveAll = async () => {
    if (!parentData || selectedItems.size === 0) {
      toast({
        title: "Incompleto",
        description: "Faltan datos básicos o productos.",
        type: "error",
      });
      return;
    }
    setIsSavingKit(true);
    try {
      const kitItemsPayload = Array.from(selectedItems.values()).map(item => ({
        productVariantId: item.variant.id,
        quantity: localQuantities[item.variant.id]
          ? Number(localQuantities[item.variant.id])
          : item.quantity,
      }));
      const payload: any = {
        name: parentData.name,
        barcode: parentData.barcode,
        sku: parentData.sku || undefined,
        description: parentData.description,
        brandId: parentData.brandId || undefined,
        categoryId: parentData.categoryId || undefined,
        type: ProductType.KIT,
        defaultVariantOnly: true,
        kitItems: kitItemsPayload,
        expirationDate:
          parentData.expirationDate && parentData.expirationDate !== ""
            ? new Date(parentData.expirationDate).toISOString()
            : null,
        defaultVariant: {
          costPrice: Number((parentData as any).cost || 0),
          prices: (parentData.prices || []).map(p => ({
            priceTypeId: p.priceTypeId,
            price: Number(p.price),
            minQuantity: Number(p.minQuantity || 1),
          })),
          attributes: parentData.attributes || {},
          appliesToDiscounts:
            typeof parentData.appliesToDiscounts === "boolean"
              ? parentData.appliesToDiscounts
              : false,
        },
      };

      let result: { id: string };
      if (product?.id) {
        result = await updateProductMutation.mutateAsync({
          id: product.id,
          data: payload,
        });
      } else {
        result = await createProductMutation.mutateAsync(payload);
      }

      const kitId = result?.id;
      const KIT_UPLOAD_DELAY_MS = 120;
      const KIT_UPLOAD_RETRY_STATUSES = [502, 503];
      const KIT_UPLOAD_RETRY_DELAY_MS = 600;

      if (kitId && pendingKitImageFiles.length > 0) {
        try {
          for (let i = 0; i < pendingKitImageFiles.length; i++) {
            if (i > 0) {
              await new Promise(r => setTimeout(r, KIT_UPLOAD_DELAY_MS));
            }
            const file = pendingKitImageFiles[i];
            if (!file) continue;

            const doUpload = async (retry = true): Promise<void> => {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("productId", kitId);
              const res = await fetch("/api/products/upload-image", {
                method: "POST",
                body: formData,
                credentials: "include",
              });
              let uploadResult: { url?: string; error?: string };
              try {
                uploadResult = (await res.json()) as {
                  url?: string;
                  error?: string;
                };
              } catch {
                throw new Error(
                  res.status === 200
                    ? "Respuesta inválida del servidor"
                    : `Error ${res.status}: ${res.statusText || "subida fallida"}`
                );
              }
              if (!res.ok || uploadResult.error || !uploadResult.url) {
                if (retry && KIT_UPLOAD_RETRY_STATUSES.includes(res.status)) {
                  await new Promise(r =>
                    setTimeout(r, KIT_UPLOAD_RETRY_DELAY_MS)
                  );
                  return doUpload(false);
                }
                throw new Error(
                  uploadResult.error || `Upload failed (${res.status})`
                );
              }
              await addProductImage(kitId, {
                url: uploadResult.url,
                sortOrder: i,
                isPrimary: i === 0,
              });
            };
            await doUpload();
          }
          setPendingKitImageFiles([]);
        } catch (uploadErr: unknown) {
          const message =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Error al subir imágenes del kit";
          toast({
            title: "Error al subir imágenes",
            description: message,
            type: "error",
            duration: 6000,
          });
          return;
        }
      } else {
        setPendingKitImageFiles([]);
      }

      toast({
        title: "¡Éxito!",
        description: "Kit guardado correctamente",
        type: "success",
      });
      onClose();
      if (onSuccess) await onSuccess(product ? "update" : "create", result);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Fallo en el servidor",
        type: "error",
      });
    } finally {
      setIsSavingKit(false);
    }
  };

  const selectedVariantIds = useMemo(
    () => Array.from(selectedItems.keys()),
    [selectedItems]
  );

  const totalKitCost = useMemo(() => {
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
    const updated: Record<string, string> = {};
    Array.from(selectedItems.values()).forEach(item => {
      updated[item.variant.id] = String(item.quantity);
    });
    setLocalQuantities(prev => {
      const isSame =
        Object.keys(updated).length === Object.keys(prev).length &&
        Object.keys(updated).every(k => updated[k] === prev[k]);
      return isSame ? prev : updated;
    });
  }, [selectedItems]);

  // Load kit items when editing a product
  useEffect(() => {
    // Reset the loaded flag when modal closes
    if (!isOpen) {
      kitItemsLoadedRef.current = false;
      return;
    }

    // Only load if we're editing, have kit items, and haven't loaded them yet
    if (
      !product?.id ||
      !product?.kitItems ||
      product.kitItems.length === 0 ||
      kitItemsLoadedRef.current
    ) {
      return;
    }

    // Load kit items into selectedItems
    const newSelectedItems = new Map<string, SelectedItemState>();
    const newLocalQuantities: Record<string, string> = {};

    product.kitItems.forEach(kitItem => {
      if (!kitItem.productVariantId) return;

      // Try to find the variant in allSystemVariants first (has more complete data)
      let variant: ApiProductVariant | undefined = allSystemVariants.find(
        (v: any) => v.id === kitItem.productVariantId
      ) as ApiProductVariant | undefined;

      // Fallback to the variant from kitItem if not found in allSystemVariants
      if (!variant && kitItem.productVariant) {
        variant = kitItem.productVariant as ApiProductVariant;
      }

      if (!variant) {
        // If variant is still not found, skip this item
        console.warn(
          `Variant ${kitItem.productVariantId} not found in system variants`
        );
        return;
      }

      const quantity = kitItem.quantity || 1;
      const costPrice = Number(variant.costPrice || 0);

      newSelectedItems.set(kitItem.productVariantId, {
        variant,
        quantity,
        costPrice,
      });

      newLocalQuantities[kitItem.productVariantId] = String(quantity);
    });

    if (newSelectedItems.size > 0) {
      setSelectedItems(newSelectedItems);
      setLocalQuantities(newLocalQuantities);
      kitItemsLoadedRef.current = true;
    }
  }, [isOpen, product, allSystemVariants]);

  const handleToggleProduct = useCallback(
    (variant: TableVariant, checked: boolean) => {
      const newMap = new Map(selectedItems);
      if (checked) {
        const apiVariant: ApiProductVariant = {
          ...variant,
          id: variant.id,
          productId: variant.productId || "",
          type: (variant.type as ProductType) || ProductType.STANDARD,
          name: variant.name,
          sku: variant.sku,
          barcode: variant.barcode ?? null,
          costPrice: Number(variant.costPrice || 0),
          prices: [],
          isActive: variant.isActive ?? true,
          isDeleted: false,
          createdAt: variant.createdAt
            ? new Date(variant.createdAt)
            : new Date(),
          updatedAt: variant.updatedAt
            ? new Date(variant.updatedAt)
            : new Date(),
        } as unknown as ApiProductVariant;

        newMap.set(variant.id, {
          variant: apiVariant,
          quantity: 1,
          costPrice: Number(apiVariant.costPrice),
        });
      } else {
        newMap.delete(variant.id);
      }
      setSelectedItems(newMap);
    },
    [selectedItems]
  );

  const handleQuantityChange = useCallback(
    (variantId: string, qty: number) => {
      const item = selectedItems.get(variantId);
      if (item) {
        const newMap = new Map(selectedItems);
        newMap.set(variantId, { ...item, quantity: qty });
        setSelectedItems(newMap);
      }
    },
    [selectedItems]
  );

  const handleRemoveItem = useCallback(
    (variantId: string) => {
      const newMap = new Map(selectedItems);
      newMap.delete(variantId);
      setSelectedItems(newMap);
    },
    [selectedItems]
  );

  const handleClose = () => {
    setKitStep(1);
    setSelectedItems(new Map());
    setLocalQuantities({});
    setSearchQuery("");
    setActiveSearchQuery("");
    setPendingKitImageFiles([]);
    kitItemsLoadedRef.current = false;
    onClose();
  };

  const handleStepperClick = (targetStep: number) => {
    if (targetStep === kitStep) return;
    if (targetStep === 2 && kitStep === 1) {
      step1FormRef.current?.submit();
    } else {
      setKitStep(1);
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent
        size={kitStep === 1 ? "xl" : "full"}
        className={cn(
          "transition-all duration-500 ease-in-out",
          kitStep === 2
            ? "max-h-[95vh] max-w-full overflow-y-auto sm:max-w-9xl"
            : "max-h-[85vh] max-w-5xl overflow-y-auto"
        )}
        showCloseButton={true}
      >
        <ModalHeader className="border-none pb-0">
          <div className="flex flex-col gap-1">
            <ModalTitle className="text-left text-xl font-bold uppercase tracking-tight">
              {kitStep === 1
                ? product
                  ? "Editar Kit de Productos"
                  : t("modal.createKitTitle")
                : t("modal.selectKitItems")}
            </ModalTitle>
            <div className="mb-1 mt-3 flex w-full justify-center">
              <div className="w-full max-w-xs">
                <Stepper
                  currentStep={kitStep}
                  steps={steps}
                  onStepClick={handleStepperClick}
                />
              </div>
            </div>
          </div>
        </ModalHeader>

        <div className="px-6 py-4">
          <div className={cn(kitStep !== 1 && "hidden")}>
            <ProductKitStep1Form
              ref={step1FormRef}
              product={product}
              initialData={parentData}
              pendingKitImageFiles={pendingKitImageFiles}
              setPendingKitImageFiles={setPendingKitImageFiles}
              onNext={data => {
                setParentData(data);
                setKitStep(2);
              }}
              onCancel={handleClose}
              onValidationChange={setIsStep1Valid}
            />
          </div>

          <div className={cn("space-y-6", kitStep !== 2 && "hidden")}>
            {parentData && (
              <ProductKitsHeader
                data={parentData}
                estimatedCost={totalKitCost}
              />
            )}

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.2fr_1fr]">
              <div className="space-y-4">
                <form onSubmit={handleSearchFormSubmit} className="w-full">
                  <SearchInput
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onSearch={handleSearch}
                    placeholder={
                      t("page.searchPlaceholder") ||
                      "Buscar productos por nombre, SKU o código de barras..."
                    }
                    minLength={2}
                    showHint={false}
                  />
                </form>
                <ProductVariantSelectTable
                  variants={displayVariants}
                  selectedIds={selectedVariantIds}
                  onToggle={handleToggleProduct}
                  loading={isFetchingAll}
                  localQuantities={localQuantities}
                  setLocalQuantities={setLocalQuantities}
                  onQuantityChange={handleQuantityChange}
                  showStockBadge={false}
                />
              </div>

              <div className="sticky top-0 space-y-4 border-l pl-6">
                <div className="flex h-12 w-full items-center justify-between rounded-lg border border-pink-100 bg-pink-50 px-4">
                  <Label className="text-sm font-bold uppercase text-pink-600">
                    Items en el Kit
                  </Label>
                  <span className="rounded-full border bg-white px-2 py-1 text-xs font-bold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {selectedItems.size} productos
                  </span>
                </div>
                <SupplierOrderSelectedTable
                  items={normalizeForTable(Array.from(selectedItems.values()))}
                  onQuantityChange={handleQuantityChange}
                  onCostPriceChange={() => {}}
                  onRemove={handleRemoveItem}
                  localQuantities={localQuantities}
                  setLocalQuantities={setLocalQuantities}
                  showStockBadge={false}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 px-6 pb-6">
          <StepperButtons
            currentStep={kitStep}
            totalSteps={2}
            onPrevious={() => setKitStep(1)}
            onNext={() =>
              kitStep === 1 ? step1FormRef.current?.submit() : handleSaveAll()
            }
            isNextDisabled={
              (kitStep === 1 && !isStep1Valid) ||
              (kitStep === 2 && selectedItems.size === 0) ||
              createProductMutation.isPending ||
              updateProductMutation.isPending ||
              isSavingKit
            }
            isPreviousDisabled={
              createProductMutation.isPending ||
              updateProductMutation.isPending ||
              isSavingKit
            }
            nextLabel={
              kitStep === 2
                ? product
                  ? "Actualizar Kit"
                  : "Crear Kit"
                : "Siguiente"
            }
          />
        </div>
      </ModalContent>
    </Modal>
  );
}

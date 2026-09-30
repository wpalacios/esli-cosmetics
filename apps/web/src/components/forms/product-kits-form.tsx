"use client";

import React, {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useState, useEffect as useEffectOrig } from "react";
import { useTranslation } from "react-i18next";
import { Input, Label, Checkbox, Button } from "@esli-cosmetics/ui";
import { NumberInput } from "@/components/ui/number-input";
import { BrandSelect, ProductImageUpload } from "@/components/ui";
import { ProductWithRelations, VariantPrice } from "@esli-cosmetics/types";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { usePrices } from "@/hooks/use-prices";
import { useDropzone } from "react-dropzone";
import { FILE_UPLOAD, cn } from "@esli-cosmetics/utils";
import { BiImageAdd } from "react-icons/bi";
import { AiOutlineDelete } from "react-icons/ai";

export type ProductKitStep1Data = {
  id?: string;
  name: string;
  sku?: string;
  barcode: string;
  brandId: string;
  description?: string;
  categoryId?: string;
  expirationDate?: string | null;
  cost?: number;
  prices: VariantPrice[];
  attributes: Record<string, any>;
  appliesToDiscounts?: boolean;
};

type AttributeEntry = {
  key: string;
  value: string;
  id: number;
};

const kitStep1Schema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t("form.nameRequired")),
    sku: z.string().optional(),
    barcode: z.string().min(1, t("form.barcodeRequired")),
    brandId: z.string().optional(),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    expirationDate: z.string().optional().nullable(),
    cost: z.preprocess(
      val => (val === "" || val === undefined ? 0 : Number(val)),
      z.number().min(0).optional()
    ),
    appliesToDiscounts: z.boolean().optional().default(true),
  });

const MAX_KIT_IMAGES = 100;

interface ProductKitStep1FormProps {
  product?: ProductWithRelations | undefined;
  initialData?: Partial<ProductKitStep1Data> | undefined;
  onNext: (data: ProductKitStep1Data) => void;
  onCancel?: () => void;
  isReadOnly?: boolean;
  onValidationChange?: (isValid: boolean) => void;
  /** Imágenes pendientes al crear kit (sin productId aún). El modal las sube al guardar. */
  pendingKitImageFiles?: File[];
  setPendingKitImageFiles?: (
    files: File[] | ((prev: File[]) => File[])
  ) => void;
}

export const ProductKitStep1Form = forwardRef(function ProductKitStep1Form(
  {
    product,
    initialData,
    onNext,
    onCancel,
    isReadOnly = false,
    onValidationChange,
    pendingKitImageFiles = [],
    setPendingKitImageFiles,
  }: ProductKitStep1FormProps,
  ref
) {
  const { t } = useTranslation("products");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onPendingKitDrop = useCallback(
    (accepted: File[]) => {
      setPendingKitImageFiles?.(prev =>
        [...prev, ...accepted].slice(0, MAX_KIT_IMAGES)
      );
    },
    [setPendingKitImageFiles]
  );
  const removePendingKitImage = useCallback(
    (index: number) => {
      setPendingKitImageFiles?.(prev => prev.filter((_, i) => i !== index));
    },
    [setPendingKitImageFiles]
  );
  const {
    getRootProps: getPendingKitRootProps,
    getInputProps: getPendingKitInputProps,
    isDragActive: isPendingKitDragActive,
  } = useDropzone({
    onDrop: onPendingKitDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: FILE_UPLOAD.maxSize,
    maxFiles: MAX_KIT_IMAGES - pendingKitImageFiles.length,
    disabled: isReadOnly || isSubmitting || !!product?.id,
    multiple: true,
  });

  const { data: pricesData } = usePrices();
  const allPriceTypes = pricesData?.data || [];

  const [prices, setPrices] = useState<VariantPrice[]>([]);
  const [attributes, setAttributes] = useState<AttributeEntry[]>([
    { key: "", value: "", id: Date.now() },
  ]);
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
    reset,
    clearErrors,
  } = useForm<Omit<ProductKitStep1Data, "prices" | "attributes">>({
    mode: "onChange",
    resolver: zodResolver(kitStep1Schema(t)),
    defaultValues: {
      name: initialData?.name || product?.name || "",
      sku: initialData?.sku || product?.sku || "",
      barcode: initialData?.barcode || product?.barcode || "",
      brandId: initialData?.brandId || product?.brandId || "",
      description: initialData?.description || product?.description || "",
      categoryId: initialData?.categoryId || product?.categoryId || "",
      expirationDate:
        initialData?.expirationDate ??
        (product?.expirationDate
          ? typeof product.expirationDate === "string"
            ? (product.expirationDate as string).slice(0, 10)
            : product.expirationDate instanceof Date
              ? product.expirationDate.toISOString().slice(0, 10)
              : ""
          : ""),
      cost: initialData?.cost ?? 0,
      appliesToDiscounts:
        initialData?.appliesToDiscounts ??
        product?.variants?.[0]?.appliesToDiscounts ??
        true,
    },
  });

  useEffect(() => {
    if (initialData || product) {
      const variant = product?.variants?.[0];

      const formatDateForInput = (dateVal: any): string => {
        if (!dateVal) return "";
        const d = new Date(dateVal);
        if (isNaN(d.getTime())) return "";

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      reset({
        name: initialData?.name || product?.name || "",
        sku: initialData?.sku || product?.sku || "",
        barcode: initialData?.barcode || product?.barcode || "",
        brandId: initialData?.brandId || product?.brandId || "",
        description: initialData?.description || product?.description || "",
        categoryId: initialData?.categoryId || product?.categoryId || "",
        expirationDate: formatDateForInput(
          initialData?.expirationDate || product?.expirationDate
        ),
        cost: initialData?.cost ?? Number(variant?.costPrice ?? 0),
        appliesToDiscounts:
          initialData?.appliesToDiscounts ??
          variant?.appliesToDiscounts ??
          true,
      });
    }
  }, [initialData, product, reset]);
  useEffect(() => {
    onValidationChange?.(isValid && prices.length > 0);
  }, [isValid, prices, onValidationChange]);

  const disabled = isSubmitting || isReadOnly;

  useEffect(() => {
    if (product?.variants?.[0]) {
      const variant = product.variants[0];
      setPrices(Array.isArray(variant.prices) ? (variant.prices as any) : []);
      if (variant.attributes && Object.keys(variant.attributes).length > 0) {
        setAttributes(
          Object.entries(variant.attributes).map(([key, value], i) => ({
            key,
            value: String(value),
            id: Date.now() + i,
          }))
        );
      }
    }
  }, [product]);

  useEffect(() => {
    if (initialData?.prices) {
      setPrices(initialData.prices);
    }
    if (initialData?.attributes) {
      setAttributes(
        Object.entries(initialData.attributes).map(([key, value], i) => ({
          key,
          value: String(value),
          id: Date.now() + i,
        }))
      );
    }
  }, [initialData]);

  useEffect(() => {
    if (product?.id) setPendingKitImageFiles?.([]);
  }, [product?.id, setPendingKitImageFiles]);

  const handlePriceChange = (
    priceTypeId: string,
    value: string,
    field: "price" | "minQuantity"
  ) => {
    setPrices(prev => {
      const current = [...prev];
      const index = current.findIndex(p => p.priceTypeId === priceTypeId);
      const typeInfo = allPriceTypes.find(pt => pt.id === priceTypeId);

      const numericValue =
        field === "minQuantity"
          ? Math.max(1, parseInt(value) || 1)
          : Math.max(0, parseFloat(value) || 0);

      if (index !== -1) {
        const updatedPrice = { ...current[index] };

        if (field === "price") {
          updatedPrice.price = numericValue;
        } else {
          updatedPrice.minQuantity = numericValue;
        }

        current[index] = updatedPrice as VariantPrice;
        return current;
      }

      const newPrice: VariantPrice = {
        priceTypeId,
        price: field === "price" ? numericValue : 0,
        minQuantity:
          field === "minQuantity" ? numericValue : (typeInfo?.minQuantity ?? 1),
      };

      return [...current, newPrice];
    });
  };

  const handleAddPrice = (priceTypeId: string) => {
    const priceType = allPriceTypes.find(pt => pt.id === priceTypeId);
    if (!priceType) return;
    const defaultMinQuantity = priceType.minQuantity ?? 1;
    const newPrice: VariantPrice = {
      priceTypeId,
      price: 0,
      minQuantity: defaultMinQuantity,
    };
    setPrices(prev => {
      if (prev.some(p => p.priceTypeId === priceTypeId)) {
        return prev;
      }
      return [...prev, newPrice];
    });
  };

  const handleRemovePrice = (priceTypeId: string) => {
    setPrices(prev => prev.filter(p => p.priceTypeId !== priceTypeId));
    setPriceErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[priceTypeId];
      delete newErrors[`minQuantity-${priceTypeId}`];
      return newErrors;
    });
  };

  const validatePrices = () => {
    let hasErrors = false;
    const newErrors: Record<string, string> = {};
    if (prices.length === 0) {
      hasErrors = true;
      newErrors["atLeastOne"] =
        t("form.priceRequired") || "Debe ingresar al menos un precio";
    }
    prices.forEach(p => {
      if (p.price == null || p.price <= 0) {
        newErrors[p.priceTypeId] = t("form.priceRequired");
        hasErrors = true;
      }
      if (
        p.minQuantity != null &&
        (!Number.isInteger(p.minQuantity) || p.minQuantity < 1)
      ) {
        newErrors[`minQuantity-${p.priceTypeId}`] =
          t("form.minQuantityInvalid") || "Cantidad mínima inválida";
        hasErrors = true;
      }
    });
    setPriceErrors(newErrors);
    return !hasErrors;
  };

  const onSubmit = (data: any) => {
    if (!validatePrices()) return;

    const finalAttributes: Record<string, any> = {};
    attributes.forEach(attr => {
      if (attr.key.trim() && attr.value.trim())
        finalAttributes[attr.key.trim()] = attr.value.trim();
    });

    setIsSubmitting(true);
    onNext({
      ...data,
      prices,
      attributes: finalAttributes,
      cost: data.cost ?? 0,
    });
    setIsSubmitting(false);
  };

  useImperativeHandle(ref, () => ({
    submit: () => {
      handleSubmit(onSubmit)();
    },
  }));

  // Detect mobile (tailwind: <640px)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid w-full grid-cols-1 gap-x-16 gap-y-6 font-sans text-base md:grid-cols-2"
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="name" className="h-10 font-sans text-base">
              {t("form.name")} *
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder={t("form.namePlaceholder")}
              disabled={disabled}
              className="h-10"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="barcode" className="text-base font-normal">
              {t("form.barcode")} *
            </Label>
            <Input
              id="barcode"
              {...register("barcode")}
              placeholder={t("form.barcodePlaceholder")}
              disabled={disabled}
              className="h-10"
            />
            {errors.barcode && (
              <p className="mt-1 text-sm text-red-600">
                {errors.barcode.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="sku" className="text-base font-normal">
              {t("form.sku")}
            </Label>
            <Input
              id="sku"
              {...register("sku")}
              placeholder={t("form.skuPlaceholder")}
              disabled={disabled}
              className="h-10"
            />
          </div>
          <div>
            <Label htmlFor="brandId" className="text-base font-normal">
              {t("form.brand")}
            </Label>
            <BrandSelect
              value={watch("brandId")}
              onChange={id => setValue("brandId", id || "")}
              disabled={disabled}
              placeholder={t("form.brandPlaceholder")}
            />
          </div>
          <div>
            <Label htmlFor="description" className="text-base font-normal">
              {t("form.description")}
            </Label>
            <Input
              id="description"
              {...register("description")}
              placeholder={t("form.descriptionPlaceholder")}
              disabled={disabled}
              className="h-10"
            />
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="appliesToDiscounts"
              checked={watch("appliesToDiscounts") ?? true}
              onCheckedChange={checked =>
                setValue("appliesToDiscounts", checked as boolean)
              }
              disabled={disabled}
            />
            <Label
              htmlFor="appliesToDiscounts"
              className="cursor-pointer font-medium"
            >
              {t("form.appliesToDiscounts")}
            </Label>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-2">
            <div>
              <Label htmlFor="expirationDate" className="text-base font-normal">
                {t("form.expirationDate")}
              </Label>
              <Input
                type="date"
                id="expirationDate"
                {...register("expirationDate")}
                disabled={disabled}
                className="h-10"
              />
            </div>
            <div>
              <Label htmlFor="cost" className="text-base font-normal">
                {t("form.costPrice")}
              </Label>
              <NumberInput
                id="cost"
                value={watch("cost") ?? 0}
                onChange={v => setValue("cost", v)}
                disabled={disabled}
                className="h-10"
              />
            </div>
          </div>
          <Accordion.Root
            type="single"
            collapsible
            defaultValue={isMobile ? "" : "prices"}
            className="w-full space-y-2"
          >
            <AccordionItem value="prices">
              <AccordionTrigger>{t("form.sellingPrices")}</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-4">
                  {allPriceTypes.length > 0 ? (
                    <>
                      <div className="space-y-3">
                        {allPriceTypes.map(type => {
                          const priceConfig = prices.find(
                            p => p.priceTypeId === type.id
                          );
                          const isEnabled = !!priceConfig;
                          const priceError = priceErrors[type.id];
                          const minQtyError =
                            priceErrors[`minQuantity-${type.id}`];

                          return (
                            <div
                              key={type.id}
                              className={`rounded-lg border transition-all ${
                                isEnabled
                                  ? "border-primary-200 bg-primary-50/30 dark:border-primary-800 dark:bg-primary-900/10"
                                  : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                              }`}
                            >
                              <div className="p-4">
                                <div className="mb-3 flex items-start justify-between">
                                  <div className="flex flex-1 items-start gap-3">
                                    <Checkbox
                                      id={`toggle-${type.id}`}
                                      checked={isEnabled}
                                      onCheckedChange={checked => {
                                        if (checked) {
                                          handleAddPrice(type.id);
                                        } else {
                                          handleRemovePrice(type.id);
                                        }
                                      }}
                                      disabled={disabled}
                                      className="mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <Label
                                        htmlFor={`toggle-${type.id}`}
                                        className="flex cursor-pointer items-center gap-2 text-sm font-medium md:text-base"
                                      >
                                        {type.name}
                                        {isEnabled && (
                                          <span className="text-xs font-normal text-primary-600 dark:text-primary-400">
                                            (
                                            {t("form.configured") ||
                                              "configurado"}
                                            )
                                          </span>
                                        )}
                                      </Label>
                                      <p className="mt-1 text-xs text-gray-500">
                                        {t("form.defaultMinQty") ||
                                          "Cantidad mínima"}
                                        : {type.minQuantity}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                {isEnabled && (
                                  <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                      <div>
                                        <Label
                                          htmlFor={`price-${type.id}`}
                                          className="mb-2 block text-sm font-medium"
                                        >
                                          {t("form.priceLabel")} *
                                        </Label>
                                        <NumberInput
                                          id={`price-${type.id}`}
                                          step="0.01"
                                          min="0"
                                          value={
                                            priceConfig?.price != null
                                              ? priceConfig.price
                                              : ""
                                          }
                                          onChange={value =>
                                            handlePriceChange(
                                              type.id,
                                              String(value),
                                              "price"
                                            )
                                          }
                                          className={`${priceError ? "border-red-500" : ""}`}
                                          disabled={disabled}
                                          placeholder={t(
                                            "form.variantPricePlaceholder"
                                          )}
                                        />
                                        {priceError && (
                                          <p className="mt-1 text-xs text-red-500">
                                            {priceError}
                                          </p>
                                        )}
                                      </div>
                                      <div>
                                        <Label
                                          htmlFor={`min-qty-${type.id}`}
                                          className="mb-2 block text-sm font-medium"
                                        >
                                          {t("form.minQuantity")} *
                                        </Label>
                                        <NumberInput
                                          id={`min-qty-${type.id}`}
                                          step="1"
                                          min={1}
                                          value={
                                            priceConfig?.minQuantity ??
                                            type.minQuantity
                                          }
                                          onChange={value =>
                                            handlePriceChange(
                                              type.id,
                                              String(value),
                                              "minQuantity"
                                            )
                                          }
                                          className={`${minQtyError ? "border-red-500" : ""}`}
                                          disabled={disabled}
                                          placeholder={String(type.minQuantity)}
                                        />
                                        {minQtyError && (
                                          <p className="mt-1 text-xs text-red-500">
                                            {minQtyError}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {prices.length === 0 && (
                        <div className="rounded-lg border border-dashed border-gray-300 py-6 text-center text-gray-500 dark:border-gray-700">
                          <p className="text-sm">
                            {t("form.enablePriceTypesHint") ||
                              "Enable price types using the checkboxes above to configure prices"}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-4 text-center text-gray-500">
                      {t("form.noPriceTypesAvailable")}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion.Root>
        </div>

        <div className="col-span-full mt-6 rounded-lg border border-gray-200 p-6 dark:border-gray-700">
          <h3 className="mb-4 text-base font-semibold">
            {t("form.images", "Imágenes del kit")}
          </h3>
          {product?.id ? (
            <ProductImageUpload
              productId={product.id}
              initialImages={(product as any).images ?? []}
              maxImages={MAX_KIT_IMAGES}
              disabled={disabled}
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t(
                  "form.imagesCreateHint",
                  "Agrega imágenes aquí. Se subirán al guardar el kit."
                )}
              </p>
              <div
                {...getPendingKitRootProps()}
                className={cn(
                  "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200",
                  "border-[#f5b1cc]/60 bg-gradient-to-br from-pink-50/80 to-purple-50/80 hover:border-[#ff48b0]/60 hover:from-pink-100/80 hover:to-purple-100/80",
                  "dark:border-pink-900/50 dark:from-pink-950/50 dark:to-purple-950/50 dark:hover:border-[#ff48b0]/50",
                  (disabled || pendingKitImageFiles.length >= MAX_KIT_IMAGES) &&
                    "pointer-events-none opacity-60"
                )}
              >
                <input {...getPendingKitInputProps()} tabIndex={-1} />
                <BiImageAdd className="h-8 w-8 text-[#ff48b0]" aria-hidden />
                <span className="mt-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                  {isPendingKitDragActive
                    ? "Suelta aquí"
                    : pendingKitImageFiles.length >= MAX_KIT_IMAGES
                      ? `Máximo ${MAX_KIT_IMAGES} imágenes`
                      : t(
                          "form.imagesDropzone",
                          "Arrastra o haz clic para agregar imágenes"
                        )}
                </span>
                <span className="mt-0.5 text-center text-[10px] text-gray-500">
                  JPG, PNG o WebP · Máx. 5 MB
                </span>
              </div>
              {pendingKitImageFiles.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {pendingKitImageFiles.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="relative flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
                    >
                      <span className="max-w-[120px] truncate">
                        {file.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:bg-red-50"
                        onClick={e => {
                          e.stopPropagation();
                          removePendingKitImage(index);
                        }}
                        aria-label={t("form.removeImage", "Quitar imagen")}
                      >
                        <AiOutlineDelete className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </form>
    </div>
  );
});

function AccordionItem({
  children,
  value,
}: {
  children: React.ReactNode;
  value: string;
}) {
  return (
    <Accordion.Item
      value={value}
      className="overflow-hidden rounded-xl border border-gray-200 shadow-sm dark:border-gray-800"
    >
      {children}
    </Accordion.Item>
  );
}

function AccordionTrigger({ children }: { children: React.ReactNode }) {
  return (
    <Accordion.Header className="flex">
      <Accordion.Trigger className="group flex flex-1 items-center justify-between bg-white px-5 py-3.5 text-[11px] font-bold uppercase tracking-[0.1em] text-gray-500 transition-all hover:bg-gray-50 dark:bg-gray-900">
        {children}
        <ChevronDownIcon className="h-4 w-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
      </Accordion.Trigger>
    </Accordion.Header>
  );
}

function AccordionContent({ children }: { children: React.ReactNode }) {
  return (
    <Accordion.Content className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden bg-white dark:bg-gray-950">
      <div className="p-5 pt-0">{children}</div>
    </Accordion.Content>
  );
}

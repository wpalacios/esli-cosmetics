"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Button, Input, Label, Checkbox } from "@esli-cosmetics/ui";
import { NumberInput } from "~/components/ui/number-input";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon, PlusIcon } from "@radix-ui/react-icons";
import { AiOutlineDelete } from "react-icons/ai";
import {
  ProductWithRelations,
  CreateProductRequest,
  UpdateProductRequest,
  VariantPrice,
  ProductType,
  ApiProductImage,
} from "@esli-cosmetics/types";
import { useCreateProduct, useUpdateProduct } from "~/hooks/use-products";
import {
  BrandSelect,
  CategorySelect,
  ProductImageUpload,
} from "~/components/ui";
import { useToast } from "@/hooks/toast/use-toast";
import { usePrices } from "@/hooks/use-prices";
import { useDropzone } from "react-dropzone";
import { addProductImage } from "@/actions/product-images";
import { FILE_UPLOAD, cn } from "@esli-cosmetics/utils";
import { BiImageAdd } from "react-icons/bi";

export interface ProductFormRef {
  submit: () => void;
  validate: () => void;
  getValues: () => ProductCreationResult;
  hasChanges: () => boolean;
}

export type ProductCreationResult = {
  id: string;
  name: string;
  sku?: string | undefined | null;
  brandId?: string | undefined;
  description?: string | undefined | null;
  barcode?: string | undefined;
  categoryId?: string | undefined | null;
  defaultVariantOnly?: boolean | undefined;
};

// Create a function that returns the schema with translations
const createProductSchema = (t: (key: string) => string) =>
  z
    .object({
      name: z.string().min(1, t("form.nameRequired")),
      barcode: z.string().min(1, t("form.barcodeRequired")),
      brandId: z.string().min(1, t("form.brandRequired")),
      sku: z.preprocess(
        val => (val === "" || val === null ? undefined : val),
        z.string().nullish()
      ),
      description: z.preprocess(
        val => (val === "" || val === null ? undefined : val),
        z.string().nullish()
      ),
      categoryId: z.preprocess(
        val => (val === "" || val === null ? undefined : val),
        z.string().nullish()
      ),
      attributesJson: z.preprocess(
        val => (val === "" || val === null ? undefined : val),
        z.string().nullish()
      ),
      defaultVariantOnly: z.boolean().optional(),
      costPrice: z.preprocess(
        val =>
          val === "" || val === null || val === undefined
            ? undefined
            : Number(val),
        z.number().min(0, t("form.costPriceNegative")).optional()
      ),
      minimumStock: z.preprocess(
        val =>
          val === "" || val === null || val === undefined
            ? undefined
            : parseInt(String(val)),
        z
          .number()
          .int()
          .min(0, t("form.minimumStockNegative"))
          .optional()
          .nullable()
      ),
      maximumStock: z.preprocess(
        val =>
          val === "" || val === null || val === undefined
            ? undefined
            : parseInt(String(val)),
        z
          .number()
          .int()
          .min(0, t("form.maximumStockNegative"))
          .optional()
          .nullable()
      ),
      appliesToDiscounts: z.boolean().optional().nullable(),
      multiple: z.preprocess(
        val =>
          val === "" || val === null || val === undefined
            ? undefined
            : parseInt(String(val)),
        z.number().int().min(1, t("form.multipleMin")).optional().nullable()
      ),
    })
    .superRefine((data, ctx) => {
      if (!data.defaultVariantOnly) return;
      if (data.costPrice === undefined || data.costPrice === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("form.costPriceRequired"),
          path: ["costPrice"],
        });
      }
      if (data.minimumStock === undefined || data.minimumStock === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("form.minimumStockInvalid"),
          path: ["minimumStock"],
        });
      }
      if (data.maximumStock === undefined || data.maximumStock === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("form.maximumStockInvalid"),
          path: ["maximumStock"],
        });
      }
      if (
        data.minimumStock != null &&
        data.maximumStock != null &&
        data.minimumStock > data.maximumStock
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("form.stockRangeInvalid"),
          path: ["minimumStock"],
        });
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("form.stockRangeInvalidMax"),
          path: ["maximumStock"],
        });
      }
    });

type ProductFormData = z.infer<ReturnType<typeof createProductSchema>>;

interface ProductFormProps {
  product?: ProductWithRelations | undefined;
  /** When creating in steps: product was created in step 1; use this id for update in step 2 without resetting form defaults. */
  existingProductId?: string | undefined;
  initialData?: ProductCreationResult | undefined;
  onSuccess?: (
    action: "create" | "update",
    result: ProductCreationResult
  ) => void;
  onCancel?: () => void;
  isReadOnly?: boolean;
  onDefaultVariantOnlyChange?: (value: boolean) => void;
  onError?: (error: any) => void;
  hideActionButtons?: boolean;
  onValidationChange?: (isValid: boolean) => void;
  currentStep?: number;
  productType?: ProductType | undefined;
}

type AttributeEntry = {
  key: string;
  value: string;
  id: number;
};

export const ProductForm = forwardRef<ProductFormRef, ProductFormProps>(
  (
    {
      product,
      existingProductId,
      initialData,
      onSuccess,
      onCancel,
      isReadOnly = false,
      onDefaultVariantOnlyChange,
      onError,
      hideActionButtons = false,
      onValidationChange,
      currentStep = 1,
      productType,
    },
    ref
  ) => {
    const { t } = useTranslation("products");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProductCreated, setIsProductCreated] = useState(false);
    const [createdWithDefaultVariantOnly, setCreatedWithDefaultVariantOnly] =
      useState(false);
    const { toast } = useToast();

    const createProductMutation = useCreateProduct();
    const updateProductMutation = useUpdateProduct();

    const { data: pricesData } = usePrices();
    const allPriceTypes = pricesData?.data || [];

    const [prices, setPrices] = useState<VariantPrice[]>([]);
    const [attributes, setAttributes] = useState<
      { key: string; value: string; id: number }[]
    >([{ key: "", value: "", id: Date.now() }]);
    const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});
    const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
    const MAX_PENDING_IMAGES = 10;

    const defaultValuesSource = product || initialData;
    const initialDefaultVariantOnly =
      defaultValuesSource &&
      typeof (defaultValuesSource as { defaultVariantOnly?: boolean })
        .defaultVariantOnly === "boolean"
        ? (defaultValuesSource as { defaultVariantOnly: boolean })
            .defaultVariantOnly
        : false;

    const {
      register,
      handleSubmit,
      formState: { errors, isValid, isDirty },
      reset,
      setValue,
      watch,
      trigger,
      setError,
    } = useForm<ProductFormData>({
      resolver: zodResolver(createProductSchema(t)),
      mode: "onChange",
      defaultValues: {
        name: defaultValuesSource?.name || "",
        sku: defaultValuesSource?.sku || "",
        barcode: defaultValuesSource?.barcode || "",
        brandId: defaultValuesSource?.brandId || "",
        description: defaultValuesSource?.description || undefined,
        categoryId: defaultValuesSource?.categoryId || undefined,
        defaultVariantOnly: initialDefaultVariantOnly,
      },
    });

    useImperativeHandle(ref, () => ({
      submit: () => {
        handleSubmit(onSubmit)();
      },
      validate: async () => {
        await trigger();
      },
      getValues: () => {
        return {
          id: product?.id ?? "",
          name: watch("name"),
          sku: watch("sku"),
          brandId: watch("brandId"),
          description: watch("description"),
          barcode: watch("barcode"),
          categoryId: watch("categoryId"),
          defaultVariantOnly: watch("defaultVariantOnly"),
        };
      },
      hasChanges: () => isDirty || pendingImageFiles.length > 0,
    }));

    useEffect(() => {
      const requiredFilled =
        !!watch("name") && !!watch("barcode") && !!watch("brandId");
      onValidationChange?.(requiredFilled);
    }, [watch("name"), watch("barcode"), watch("brandId"), onValidationChange]);

    // Initialize variant fields from product's default variant when editing
    useEffect(() => {
      if (
        product &&
        product.defaultVariantOnly &&
        product.variants &&
        product.variants.length > 0
      ) {
        const defaultVariant = product.variants[0];
        if (defaultVariant) {
          setPrices(
            Array.isArray(defaultVariant.prices) ? defaultVariant.prices : []
          );

          if (
            defaultVariant.attributes &&
            Object.keys(defaultVariant.attributes).length > 0
          ) {
            const attributeEntries = Object.entries(
              defaultVariant.attributes
            ).map(([key, value], index) => ({
              key,
              value: String(value),
              id: Date.now() + index,
            }));
            setAttributes(attributeEntries);
          } else {
            setAttributes([{ key: "", value: "", id: Date.now() }]);
          }
        } else {
          setPrices([]);
          setAttributes([{ key: "", value: "", id: Date.now() }]);
        }
      } else {
        setPrices([]);
        setAttributes([{ key: "", value: "", id: Date.now() }]);
      }
    }, [product]);

    useEffect(() => {
      const source = product || initialData;
      const sourceDefaultVariantOnly =
        source &&
        typeof (source as { defaultVariantOnly?: boolean })
          .defaultVariantOnly === "boolean"
          ? (source as { defaultVariantOnly: boolean }).defaultVariantOnly
          : false;
      const defaultVariant =
        product &&
        product.defaultVariantOnly &&
        product.variants &&
        product.variants.length > 0
          ? product.variants[0]
          : null;

      // Reset form when product/initialData changes so checkbox reflects current value
      reset({
        name: source?.name || "",
        sku: source?.sku || "",
        barcode: source?.barcode || "",
        brandId: source?.brandId || "",
        description: source?.description || undefined,
        categoryId: source?.categoryId || undefined,
        defaultVariantOnly: sourceDefaultVariantOnly,
        costPrice: defaultVariant?.costPrice ?? 0,
        minimumStock: defaultVariant?.minimumStock ?? undefined,
        maximumStock: defaultVariant?.maximumStock ?? undefined,
        appliesToDiscounts: defaultVariant?.appliesToDiscounts ?? true,
        multiple: defaultVariant?.multiple ?? undefined,
      });

      // Reset created state and pending images when editing existing product
      if (product) {
        setIsProductCreated(false);
        setCreatedWithDefaultVariantOnly(false);
        setPendingImageFiles([]);
      }
    }, [product, initialData, reset]);

    // Update variant fields when variant data becomes available (for defaultVariantOnly products)
    useEffect(() => {
      if (
        product &&
        product.defaultVariantOnly &&
        product.variants &&
        product.variants.length > 0
      ) {
        const defaultVariant = product.variants[0];
        // Only update if variant has an ID (indicating it's a real variant, not just placeholder data)
        if (defaultVariant && defaultVariant.id) {
          // Update form values with variant data
          setValue("costPrice", defaultVariant.costPrice ?? 0, {
            shouldValidate: false,
          });
          setValue("minimumStock", defaultVariant.minimumStock ?? undefined, {
            shouldValidate: false,
          });
          setValue("maximumStock", defaultVariant.maximumStock ?? undefined, {
            shouldValidate: false,
          });
          setValue(
            "appliesToDiscounts",
            defaultVariant.appliesToDiscounts ?? true,
            { shouldValidate: false }
          );
          setValue("multiple", defaultVariant.multiple ?? undefined, {
            shouldValidate: false,
          });
        }
      }
    }, [product?.variants, product?.id, setValue]); // Update when variants are loaded

    const disabled = isSubmitting || isReadOnly;
    const defaultVariantOnlyWatch = watch("defaultVariantOnly") ?? false;

    // Handlers for variant fields
    const handlePriceChange = (
      priceTypeId: string,
      value: string,
      field: "price" | "minQuantity"
    ) => {
      setPrices(prev => {
        const currentPrices = prev || [];
        const existingConfig = currentPrices.find(
          p => p.priceTypeId === priceTypeId
        );
        // Find the price type to get its default minQuantity
        const priceType = allPriceTypes.find(pt => pt.id === priceTypeId);
        const defaultMinQuantity = priceType?.minQuantity ?? 1;

        const isMinQuantityField = field === "minQuantity";
        const numericValue = parseFloat(value);

        if (field === "price" && value.trim() === "") {
          return currentPrices.filter(p => p.priceTypeId !== priceTypeId);
        }

        let finalModifiedValue;

        if (isMinQuantityField) {
          const trimmedValue = value.trim();
          const parsedInt = parseInt(trimmedValue);

          if (trimmedValue === "") {
            if (!existingConfig) return currentPrices;
            finalModifiedValue =
              existingConfig.minQuantity ?? defaultMinQuantity;
          } else if (isNaN(parsedInt)) {
            finalModifiedValue =
              existingConfig?.minQuantity ?? defaultMinQuantity;
          } else {
            finalModifiedValue = Math.max(1, parsedInt);
          }
        } else {
          finalModifiedValue =
            isNaN(numericValue) || numericValue < 0 ? 0 : numericValue;
        }

        const newConfig = {
          priceTypeId,
          price: existingConfig?.price ?? 0,
          minQuantity: existingConfig?.minQuantity ?? defaultMinQuantity,
          [field]: finalModifiedValue,
        };

        if (existingConfig) {
          return currentPrices.map(p =>
            p.priceTypeId === priceTypeId ? newConfig : p
          );
        } else if (field === "price" && newConfig.price > 0) {
          return [...currentPrices, newConfig];
        }

        return currentPrices;
      });
    };

    const handleRemovePrice = (priceTypeId: string) => {
      setPrices(prev => {
        const currentPrices = prev || [];
        return currentPrices.filter(p => p.priceTypeId !== priceTypeId);
      });
      // Clear any errors for this price type
      setPriceErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[priceTypeId];
        delete newErrors[`minQuantity-${priceTypeId}`];
        return newErrors;
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
        // Check if already exists
        if (prev.some(p => p.priceTypeId === priceTypeId)) {
          return prev;
        }
        return [...prev, newPrice];
      });
    };

    const handleAttributeChange = (
      id: number,
      field: "key" | "value",
      val: string
    ) => {
      setAttributes(prev =>
        prev.map(attr => (attr.id === id ? { ...attr, [field]: val } : attr))
      );
    };

    const addAttribute = () => {
      setAttributes(prev => [...prev, { key: "", value: "", id: Date.now() }]);
    };

    const removeAttribute = (id: number) => {
      if (attributes.length === 1) {
        setAttributes([{ key: "", value: "", id: Date.now() }]);
        return;
      }
      setAttributes(prev => prev.filter(attr => attr.id !== id));
    };

    const validatePrices = () => {
      if (!defaultVariantOnlyWatch) return true;

      let hasPriceErrors = false;
      const newPriceErrors: Record<string, string> = {};

      // Validate all configured prices
      prices.forEach(priceConfig => {
        if (
          priceConfig.price === 0 ||
          priceConfig.price === null ||
          priceConfig.price === undefined
        ) {
          newPriceErrors[priceConfig.priceTypeId] =
            t("form.priceRequired") || "Price is required";
          hasPriceErrors = true;
        } else if (priceConfig.price > 0) {
          const minQty = priceConfig.minQuantity ?? 1;
          if (!Number.isInteger(minQty) || minQty < 1) {
            newPriceErrors[`minQuantity-${priceConfig.priceTypeId}`] =
              t("form.minQuantityInvalid") || "Invalid minimum quantity";
            hasPriceErrors = true;
          }
        }
      });

      setPriceErrors(newPriceErrors);
      return !hasPriceErrors;
    };

    const onSubmit = async (data: ProductFormData) => {

      if (isSubmitting) return;
      setIsSubmitting(true);
      try {
        // Validate prices if defaultVariantOnly is true
        if (defaultVariantOnlyWatch && !validatePrices()) {
          setIsSubmitting(false);
          return;
        }

        const rawData: ProductFormData = {
          name: data.name.trim(),
          barcode: data.barcode?.trim() || "",
          sku: data.sku?.trim() || undefined,
          brandId: data.brandId,
          description: data.description?.trim()
            ? data.description.trim()
            : undefined,
          categoryId: data.categoryId || undefined,
          attributesJson: data.attributesJson?.trim(),
          defaultVariantOnly: data.defaultVariantOnly,
        };


        let productAttributes: Record<string, any> | undefined;
        if (rawData.attributesJson) {
          try {
            productAttributes = JSON.parse(rawData.attributesJson);
            if (
              typeof productAttributes !== "object" ||
              Array.isArray(productAttributes)
            ) {
              throw new Error("Attributes must be a valid JSON object.");
            }
          } catch (e) {
            console.error("ERROR: Invalid attributes JSON format:", e);
            throw new Error(
              "Invalid attributes JSON format. Please check the syntax."
            );
          }
        }

        let apiResult: { id: string; name?: string };
        let action: "create" | "update";
        const productIdForUpdate = product?.id ?? existingProductId;

        if (productIdForUpdate) {
          // Validate required fields before updating payload
          if (!rawData.brandId || rawData.brandId.trim() === "") {
            toast({
              title: t("form.error") || "Error",
              description: t("form.brandRequired") || "Brand is required",
              type: "error",
              duration: 5000,
            });
            setIsSubmitting(false);
            return;
          }

          // Prepare variant attributes from the attributes state array (for defaultVariantOnly)
          const variantAttributesPayload: Record<string, any> = {};
          if (defaultVariantOnlyWatch && attributes) {
            attributes.forEach((attr: AttributeEntry) => {
              const key = attr.key.trim();
              const value = attr.value.trim();
              if (key && value) {
                variantAttributesPayload[key] = value;
              }
            });
          }
          const variantAttributesToSend =
            Object.keys(variantAttributesPayload).length > 0
              ? variantAttributesPayload
              : null;

          // Filter out prices with price === 0 or invalid prices, and clean the data
          const validPricesForUpdate = defaultVariantOnlyWatch
            ? (prices || [])
                .filter(
                  p =>
                    p.price != null &&
                    p.price > 0 &&
                    p.priceTypeId &&
                    typeof p.priceTypeId === "string" &&
                    p.priceTypeId.trim() !== ""
                )
                .map(p => {
                  const cleaned: VariantPrice = {
                    priceTypeId: p.priceTypeId,
                    price:
                      typeof p.price === "string"
                        ? Number(p.price)
                        : Number(p.price),
                  };
                  // Only include minQuantity if it exists and is valid
                  if (p.minQuantity != null) {
                    cleaned.minQuantity =
                      typeof p.minQuantity === "string"
                        ? Number(p.minQuantity)
                        : Number(p.minQuantity);
                  }
                  return cleaned;
                })
            : [];

          const updatePayload: UpdateProductRequest = {
            name: rawData.name,
            categoryId: rawData.categoryId,
            brandId: rawData.brandId.trim(),
            description:
              rawData.description === undefined ? null : rawData.description,
            ...(rawData.sku &&
              rawData.sku.trim() !== "" && { sku: rawData.sku.trim() }),
            ...(rawData.barcode &&
              rawData.barcode.trim() !== "" && {
                barcode: rawData.barcode.trim(),
              }),
            ...(productAttributes && { attributes: productAttributes }),
            // Use form value when defined (including false when user unchecks); otherwise keep existing product value
            defaultVariantOnly:
              rawData.defaultVariantOnly !== undefined &&
              rawData.defaultVariantOnly !== null
                ? rawData.defaultVariantOnly
                : (product?.defaultVariantOnly ?? false),
            // Include variant data when defaultVariantOnly is true
            ...(defaultVariantOnlyWatch && {
              defaultVariant: {
                costPrice: data.costPrice ?? 0,
                ...(validPricesForUpdate.length > 0
                  ? { prices: validPricesForUpdate }
                  : {}),
                minimumStock: data.minimumStock ?? null,
                maximumStock: data.maximumStock ?? null,
                appliesToDiscounts: data.appliesToDiscounts ?? true,
                ...(data.multiple !== null &&
                  data.multiple !== undefined && { multiple: data.multiple }),
                attributes: variantAttributesToSend ?? undefined,
              },
            }),
          } as UpdateProductRequest;

          apiResult = await updateProductMutation.mutateAsync({
            id: productIdForUpdate,
            data: updatePayload,
          });
          action = "update";
        } else {
          // Validate required fields before creating payload
          if (!rawData.barcode || rawData.barcode.trim() === "") {
            toast({
              title: t("form.error") || "Error",
              description: t("form.barcodeRequired") || "Barcode is required",
              type: "error",
              duration: 5000,
            });
            return;
          }

          if (!rawData.brandId || rawData.brandId.trim() === "") {
            toast({
              title: t("form.error") || "Error",
              description: t("form.brandRequired") || "Brand is required",
              type: "error",
              duration: 5000,
            });
            return;
          }

          // Prepare variant attributes from the attributes state array (for defaultVariantOnly)
          const variantAttributesPayload: Record<string, any> = {};
          if (defaultVariantOnlyWatch && attributes) {
            attributes.forEach((attr: AttributeEntry) => {
              const key = attr.key.trim();
              const value = attr.value.trim();
              if (key && value) {
                variantAttributesPayload[key] = value;
              }
            });
          }
          const variantAttributesToSend =
            Object.keys(variantAttributesPayload).length > 0
              ? variantAttributesPayload
              : null;

          // Filter out prices with price === 0 or invalid prices, and clean the data
          const validPricesForCreate = defaultVariantOnlyWatch
            ? (prices || [])
                .filter(
                  p =>
                    p.price != null &&
                    p.price > 0 &&
                    p.priceTypeId &&
                    typeof p.priceTypeId === "string" &&
                    p.priceTypeId.trim() !== ""
                )
                .map(p => {
                  const cleaned: VariantPrice = {
                    priceTypeId: p.priceTypeId,
                    price:
                      typeof p.price === "string"
                        ? Number(p.price)
                        : Number(p.price),
                  };
                  // Only include minQuantity if it exists and is valid
                  if (p.minQuantity != null) {
                    cleaned.minQuantity =
                      typeof p.minQuantity === "string"
                        ? Number(p.minQuantity)
                        : Number(p.minQuantity);
                  }
                  return cleaned;
                })
            : [];

          const createPayload: CreateProductRequest = {
            name: rawData.name,
            barcode: rawData.barcode.trim(),
            brandId: rawData.brandId.trim(),
            ...(rawData.categoryId &&
              rawData.categoryId.trim() !== "" && {
                categoryId: rawData.categoryId.trim(),
              }),
            ...(rawData.sku &&
              rawData.sku.trim() !== "" && { sku: rawData.sku.trim() }),
            ...(rawData.description &&
              rawData.description.trim() !== "" && {
                description: rawData.description.trim(),
              }),
            ...(productAttributes && { attributes: productAttributes }),
            ...(rawData.defaultVariantOnly !== undefined && {
              defaultVariantOnly: rawData.defaultVariantOnly,
            }),
            ...(productType && { type: productType }),
            // Include variant data when defaultVariantOnly is true
            ...(defaultVariantOnlyWatch && {
              defaultVariant: {
                costPrice: data.costPrice ?? 0,
                ...(validPricesForCreate.length > 0
                  ? { prices: validPricesForCreate }
                  : {}),
                minimumStock: data.minimumStock ?? null,
                maximumStock: data.maximumStock ?? null,
                appliesToDiscounts: data.appliesToDiscounts ?? true,
                ...(data.multiple !== null &&
                  data.multiple !== undefined && { multiple: data.multiple }),
                attributes: variantAttributesToSend ?? undefined,
              },
            }),
          } as CreateProductRequest;

          apiResult = await createProductMutation.mutateAsync(createPayload);
          action = "create";
          setIsProductCreated(true);
          setCreatedWithDefaultVariantOnly(rawData.defaultVariantOnly ?? false);

          // Upload pending images for the new product in the same submit
          if (pendingImageFiles.length > 0 && apiResult.id) {
            const UPLOAD_DELAY_MS = 120;
            const UPLOAD_RETRY_STATUSES = [502, 503];
            const UPLOAD_RETRY_DELAY_MS = 600;
            try {
              for (let i = 0; i < pendingImageFiles.length; i++) {
                if (i > 0) {
                  await new Promise(r => setTimeout(r, UPLOAD_DELAY_MS));
                }
                const file = pendingImageFiles[i];
                if (!file) continue;
                const doUpload = async (retry = true): Promise<void> => {
                  const formData = new FormData();
                  formData.append("file", file);
                  formData.append("productId", apiResult.id);
                  const res = await fetch("/api/products/upload-image", {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                  });
                  const result = (await res.json()) as {
                    url?: string;
                    error?: string;
                  };
                  if (!res.ok || result.error || !result.url) {
                    if (retry && UPLOAD_RETRY_STATUSES.includes(res.status)) {
                      await new Promise(r =>
                        setTimeout(r, UPLOAD_RETRY_DELAY_MS)
                      );
                      return doUpload(false);
                    }
                    throw new Error(
                      result.error || `Upload failed (${res.status})`
                    );
                  }
                  await addProductImage(apiResult.id, {
                    url: result.url,
                    sortOrder: i,
                    isPrimary: i === 0,
                  });
                };
                await doUpload();
              }
              setPendingImageFiles([]);
            } catch (uploadErr: unknown) {
              const msg =
                uploadErr instanceof Error
                  ? uploadErr.message
                  : "Error al subir imágenes";
              toast({
                title: t("form.error") || "Error",
                description: msg,
                type: "error",
                duration: 5000,
              });
            }
          }
        }

        // Siempre limpiar el campo de imágenes pendientes después de guardar (crear o actualizar)
        if (action === "create") {
          setPendingImageFiles([]);
        }

        // Return all rawData for the parent component to retain form state
        const successResult: ProductCreationResult = {
          id: apiResult.id,
          name: apiResult.name || rawData.name,
          sku: rawData.sku ?? undefined, // Use updated SKU from form
          barcode: product ? (product.barcode ?? undefined) : rawData.barcode, // Keep original barcode when editing
          brandId: rawData.brandId,
          description: rawData.description ?? undefined,
          categoryId: rawData.categoryId ?? undefined,
          defaultVariantOnly: rawData.defaultVariantOnly,
        };

        onSuccess?.(action, successResult);
      } catch (error: any) {
        // Extract structured error data if available
        const errorData = error?.response?.data;
        const errorMessage =
          errorData?.message || error.message || t("form.saveFailed");
        const errorField = errorData?.field;

        // 1. Delegate the extracted message to the parent component (the modal) to show a toast.
        if (onError) {
          onError(errorMessage);
        } else {
          // Fallback toast if onError is not provided
          console.error("ERROR: Failed to save product:", error);
          toast({
            title: t("form.error") || "Error",
            description: errorMessage,
            type: "error",
            duration: 5000,
          });
        }

        // 2. Set field-specific errors using the `field` property from the structured error
        if (errorField === "sku" || errorField === "barcode") {
          setError(errorField, { type: "manual", message: errorMessage });
        } else {
          // For other errors, set a root error
          setError("root.serverError", {
            type: "manual",
            message: errorMessage,
          });
        }
      } finally {
        setIsSubmitting(false);
      }
    };

    const effectiveProductId =
      product?.id ?? (initialData as { id?: string })?.id;
    const [accordionOpen, setAccordionOpen] = useState<string>("prices");

    const onPendingDrop = useCallback((accepted: File[]) => {
      setPendingImageFiles(prev => {
        const next = [...prev, ...accepted].slice(0, MAX_PENDING_IMAGES);
        return next;
      });
    }, []);
    const removePendingImage = useCallback((index: number) => {
      setPendingImageFiles(prev => prev.filter((_, i) => i !== index));
    }, []);
    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop: onPendingDrop,
      accept: {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
      },
      maxSize: FILE_UPLOAD.maxSize,
      maxFiles: MAX_PENDING_IMAGES - pendingImageFiles.length,
      disabled: disabled || !!effectiveProductId,
      multiple: true,
    });

    return (
      <div className="flex flex-col gap-4">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 gap-6">
            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <Label htmlFor="name">{t("form.name")} *</Label>
                  <Input
                    id="name"
                    {...register("name")}
                    className={`${errors.name ? "border-red-500" : ""} ${disabled ? "cursor-not-allowed bg-gray-100 dark:bg-gray-700" : ""}`}
                    placeholder={t("form.namePlaceholder")}
                    disabled={disabled}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.name.message}
                    </p>
                  )}
                </div>
                <div>
                  {/* SKU */}
                  <Label htmlFor="sku">{t("form.sku")}</Label>
                  <Input
                    id="sku"
                    {...register("sku")}
                    placeholder={t("form.skuPlaceholder")}
                    disabled={disabled}
                    value={watch("sku") ?? ""}
                    onChange={e =>
                      setValue(
                        "sku",
                        e.target.value === "" ? undefined : e.target.value
                      )
                    }
                    className={`${errors.sku ? "border-red-500" : ""} ${
                      disabled
                        ? "cursor-not-allowed bg-gray-100 dark:bg-gray-700"
                        : ""
                    }`}
                  />
                  {errors.sku && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.sku.message}
                    </p>
                  )}
                </div>
                <div>
                  {/* Barcode */}
                  <Label htmlFor="barcode">{t("form.barcode")} *</Label>
                  <Input
                    id="barcode"
                    {...register("barcode")}
                    className={`${errors.barcode ? "border-red-500" : ""} ${disabled ? "cursor-not-allowed bg-gray-100 dark:bg-gray-700" : ""}`}
                    placeholder={t("form.barcodePlaceholder")}
                    disabled={disabled}
                  />
                  {errors.barcode && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.barcode.message}
                    </p>
                  )}
                </div>
                <div>
                  {/* Brand */}
                  <Label htmlFor="brandId">{t("form.brand")} *</Label>
                  <BrandSelect
                    value={watch("brandId")}
                    onChange={id => setValue("brandId", id || "")}
                    placeholder={t("form.brandPlaceholder")}
                    disabled={disabled}
                    error={errors.brandId?.message}
                    {...(product?.brand ? { currentBrand: product.brand } : {})}
                    searchPlaceholder={t("form.searchBrands")}
                    emptyMessage={t("form.noBrandsFound")}
                    loadingMessage={t("form.loadingBrands")}
                  />
                </div>
                <div>
                  {/* Description */}
                  <Label htmlFor="description">{t("form.description")}</Label>
                  <Input
                    id="description"
                    {...register("description")}
                    placeholder={t("form.descriptionPlaceholder")}
                    value={watch("description") ?? ""}
                    onChange={e =>
                      setValue(
                        "description",
                        e.target.value === "" ? undefined : e.target.value
                      )
                    }
                    disabled={disabled}
                    className={
                      disabled
                        ? "cursor-not-allowed bg-gray-100 dark:bg-gray-700"
                        : ""
                    }
                  />
                </div>
                <div>
                  {/* Category */}
                  <Label htmlFor="categoryId">{t("form.category")}</Label>
                  <CategorySelect
                    value={watch("categoryId") ?? undefined}
                    onChange={id => setValue("categoryId", id || undefined)}
                    placeholder={t("form.categoryPlaceholder")}
                    disabled={disabled}
                    error={errors.categoryId?.message}
                    {...(product?.category
                      ? { currentCategory: product.category }
                      : {})}
                    searchPlaceholder={t("form.searchCategories")}
                    emptyMessage={t("form.noCategoriesFound")}
                    loadingMessage={t("form.loadingCategories")}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  {/* Default Variant Only */}
                  <Checkbox
                    id="defaultVariantOnly"
                    checked={defaultVariantOnlyWatch}
                    onCheckedChange={checked => {
                      setValue("defaultVariantOnly", checked as boolean);
                      onDefaultVariantOnlyChange?.(checked as boolean);
                    }}
                    disabled={disabled}
                  />
                  <Label
                    htmlFor="defaultVariantOnly"
                    className="cursor-pointer font-medium"
                  >
                    {t("form.defaultVariantOnly")}
                  </Label>
                </div>

                {/* Product images - step 1: always visible; upload only when product exists */}
                <div className="space-y-2 border-t border-gray-200 pt-6 dark:border-gray-700">
                  <h3 className="text-base font-semibold">
                    {t("form.images", "Imágenes del producto")}
                  </h3>
                  {effectiveProductId ? (
                    <ProductImageUpload
                      productId={effectiveProductId}
                      initialImages={
                        product?.images ??
                        (initialData as { images?: ApiProductImage[] })
                          ?.images ??
                        []
                      }
                      disabled={disabled}
                      maxImages={100}
                    />
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t(
                          "form.imagesCreateHint",
                          "Agrega imágenes aquí. Se subirán al guardar el producto."
                        )}
                      </p>
                      <div
                        {...getRootProps()}
                        className={cn(
                          "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200",
                          "border-[#f5b1cc]/60 bg-gradient-to-br from-pink-50/80 to-purple-50/80 hover:border-[#ff48b0]/60 hover:from-pink-100/80 hover:to-purple-100/80",
                          "dark:border-pink-900/50 dark:from-pink-950/50 dark:to-purple-950/50 dark:hover:border-[#ff48b0]/50",
                          (disabled ||
                            pendingImageFiles.length >= MAX_PENDING_IMAGES) &&
                            "pointer-events-none opacity-60"
                        )}
                      >
                        <input {...getInputProps()} tabIndex={-1} />
                        <BiImageAdd
                          className="h-8 w-8 text-[#ff48b0]"
                          aria-hidden
                        />
                        <span className="mt-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                          {isDragActive
                            ? "Suelta aquí"
                            : pendingImageFiles.length >= MAX_PENDING_IMAGES
                              ? `Máximo ${MAX_PENDING_IMAGES} imágenes`
                              : "Arrastra o haz clic para agregar imágenes"}
                        </span>
                        <span className="mt-0.5 text-center text-[10px] text-gray-500">
                          JPG, PNG o WebP · Máx. 5 MB
                        </span>
                      </div>
                      {pendingImageFiles.length > 0 && (
                        <ul className="flex flex-wrap gap-2">
                          {pendingImageFiles.map((file, index) => (
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
                                  removePendingImage(index);
                                }}
                                aria-label="Quitar imagen"
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
              </div>
            )}

            {currentStep === 2 && defaultVariantOnlyWatch === true && (
              <div className="space-y-4 pt-4 sm:space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    {/* Cost Price */}
                    <Label htmlFor="costPrice">{t("form.costPrice")} *</Label>
                    <NumberInput
                      id="costPrice"
                      step="0.01"
                      value={watch("costPrice") ?? 0}
                      onChange={value =>
                        setValue("costPrice", value, { shouldValidate: true })
                      }
                      className={`${errors.costPrice ? "border-red-500" : ""}`}
                      disabled={disabled}
                      name={register("costPrice", { valueAsNumber: true }).name}
                      onBlur={
                        register("costPrice", { valueAsNumber: true }).onBlur
                      }
                    />
                    {errors.costPrice && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.costPrice.message}
                      </p>
                    )}
                  </div>
                  <div>
                    {/* Minimum Stock */}
                    <Label htmlFor="minimumStock">
                      {t("form.minimumStock")} *
                    </Label>
                    <NumberInput
                      id="minimumStock"
                      value={watch("minimumStock") ?? ""}
                      onChange={value =>
                        setValue("minimumStock", value, {
                          shouldValidate: true,
                        })
                      }
                      className={`${errors.minimumStock ? "border-red-500" : ""}`}
                      disabled={disabled}
                      name={
                        register("minimumStock", { valueAsNumber: true }).name
                      }
                      onBlur={
                        register("minimumStock", { valueAsNumber: true }).onBlur
                      }
                    />
                    {errors.minimumStock && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.minimumStock.message}
                      </p>
                    )}
                  </div>
                  <div>
                    {/* Maximum Stock */}
                    <Label htmlFor="maximumStock">
                      {t("form.maximumStock")} *
                    </Label>
                    <NumberInput
                      id="maximumStock"
                      value={watch("maximumStock") ?? ""}
                      onChange={value =>
                        setValue("maximumStock", value, {
                          shouldValidate: true,
                        })
                      }
                      className={`${errors.maximumStock ? "border-red-500" : ""}`}
                      disabled={disabled}
                      name={
                        register("maximumStock", { valueAsNumber: true }).name
                      }
                      onBlur={
                        register("maximumStock", { valueAsNumber: true }).onBlur
                      }
                    />
                    {errors.maximumStock && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.maximumStock.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Multiple */}
                <div>
                  <Label htmlFor="multiple">{t("form.multiple")}</Label>
                  <NumberInput
                    id="multiple"
                    step="1"
                    min="1"
                    value={watch("multiple") ?? ""}
                    onChange={value =>
                      setValue("multiple", value, { shouldValidate: true })
                    }
                    className={`${errors.multiple ? "border-red-500" : ""}`}
                    disabled={disabled}
                    name={register("multiple", { valueAsNumber: true }).name}
                    onBlur={
                      register("multiple", { valueAsNumber: true }).onBlur
                    }
                    placeholder={t("form.multiplePlaceholder")}
                  />
                  {errors.multiple && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.multiple.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {t("form.multipleHint")}
                  </p>
                </div>

                {/* Applies to Discounts */}
                <div className="flex items-center space-x-2">
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
                    className="!mb-0 cursor-pointer"
                  >
                    {t("form.appliesToDiscounts")}
                  </Label>
                </div>

                {/* Prices Accordion */}
                <Accordion.Root
                  type="single"
                  value={accordionOpen}
                  onValueChange={value => setAccordionOpen(value || "")}
                  className="w-full space-y-2"
                >
                  <AccordionItem value="prices">
                    <AccordionTrigger>
                      {t("form.sellingPrices")}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {allPriceTypes.length > 0 ? (
                          <>
                            {/* Unified Price Types List */}
                            <div className="space-y-3">
                              {allPriceTypes.map(priceType => {
                                const priceConfig = prices.find(
                                  p => p.priceTypeId === priceType.id
                                );
                                const isEnabled = !!priceConfig;
                                const priceError = priceErrors[priceType.id];
                                const minQtyError =
                                  priceErrors[`minQuantity-${priceType.id}`];

                                return (
                                  <div
                                    key={priceType.id}
                                    className={`rounded-lg border transition-all ${
                                      isEnabled
                                        ? "border-primary-200 bg-primary-50/30 dark:border-primary-800 dark:bg-primary-900/10"
                                        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                                    }`}
                                  >
                                    <div className="p-4">
                                      {/* Header with Toggle */}
                                      <div className="mb-3 flex items-start justify-between">
                                        <div className="flex flex-1 items-start gap-3">
                                          <Checkbox
                                            id={`toggle-${priceType.id}`}
                                            checked={isEnabled}
                                            onCheckedChange={checked => {
                                              if (checked) {
                                                handleAddPrice(priceType.id);
                                              } else {
                                                handleRemovePrice(priceType.id);
                                              }
                                            }}
                                            disabled={disabled}
                                            className="mt-0.5"
                                          />
                                          <div className="flex-1">
                                            <Label
                                              htmlFor={`toggle-${priceType.id}`}
                                              className="flex cursor-pointer items-center gap-2 text-sm font-medium md:text-base"
                                            >
                                              {priceType.name}
                                              {isEnabled && (
                                                <span className="text-xs font-normal text-primary-600 dark:text-primary-400">
                                                  (
                                                  {t("form.configured") ||
                                                    "configured"}
                                                  )
                                                </span>
                                              )}
                                            </Label>
                                            <p className="mt-1 text-xs text-gray-500">
                                              {t("form.defaultMinQty") ||
                                                "Default min qty"}
                                              : {priceType.minQuantity}
                                            </p>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Price Configuration Fields (shown when enabled) */}
                                      {isEnabled && (
                                        <div className="mt-4 space-y-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                            <div>
                                              <Label
                                                htmlFor={`price-${priceType.id}`}
                                                className="mb-2 block text-sm font-medium"
                                              >
                                                {t("form.priceLabel")} *
                                              </Label>
                                              <NumberInput
                                                id={`price-${priceType.id}`}
                                                step="0.01"
                                                min="0"
                                                value={
                                                  priceConfig.price != null
                                                    ? priceConfig.price
                                                    : ""
                                                }
                                                onChange={value =>
                                                  handlePriceChange(
                                                    priceType.id,
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
                                                htmlFor={`min-qty-${priceType.id}`}
                                                className="mb-2 block text-sm font-medium"
                                              >
                                                {t("form.minQuantity")} *
                                              </Label>
                                              <NumberInput
                                                id={`min-qty-${priceType.id}`}
                                                step="1"
                                                min={1}
                                                value={
                                                  priceConfig.minQuantity ??
                                                  priceType.minQuantity
                                                }
                                                onChange={value =>
                                                  handlePriceChange(
                                                    priceType.id,
                                                    String(value),
                                                    "minQuantity"
                                                  )
                                                }
                                                className={`${minQtyError ? "border-red-500" : ""}`}
                                                disabled={disabled}
                                                placeholder={String(
                                                  priceType.minQuantity
                                                )}
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

                  {/* Attributes Accordion */}
                  <AccordionItem value="attributes">
                    <AccordionTrigger>{t("form.attributes")}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {attributes.map((attr, index) => (
                          <div
                            key={attr.id}
                            className="grid grid-cols-10 gap-3"
                          >
                            <div className="col-span-4">
                              <Label
                                htmlFor={`attr-key-${attr.id}`}
                                className={index !== 0 ? "sr-only" : ""}
                              >
                                {t("form.attributeName")}
                              </Label>
                              <Input
                                id={`attr-key-${attr.id}`}
                                value={attr.key}
                                onChange={e =>
                                  handleAttributeChange(
                                    attr.id,
                                    "key",
                                    e.target.value
                                  )
                                }
                                placeholder={t("form.attributeNamePlaceholder")}
                                className="h-12"
                                disabled={disabled}
                              />
                            </div>
                            <div className="col-span-5">
                              <Label
                                htmlFor={`attr-value-${attr.id}`}
                                className={index !== 0 ? "sr-only" : ""}
                              >
                                {t("form.attributeValue")}
                              </Label>
                              <Input
                                id={`attr-value-${attr.id}`}
                                value={attr.value}
                                onChange={e =>
                                  handleAttributeChange(
                                    attr.id,
                                    "value",
                                    e.target.value
                                  )
                                }
                                placeholder={t(
                                  "form.attributeValuePlaceholder"
                                )}
                                className="h-12"
                                disabled={disabled}
                              />
                            </div>
                            <div className="col-span-1 flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAttribute(attr.id)}
                                disabled={disabled || attributes.length === 1}
                                className="mb-0.5"
                              >
                                <AiOutlineDelete className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addAttribute}
                          disabled={disabled}
                          className="mt-2 w-full justify-center"
                        >
                          <PlusIcon className="mr-2 h-4 w-4" />
                          {t("form.addAttribute")}
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion.Root>
              </div>
            )}
          </div>
        </form>
      </div>
    );
  }
);

ProductForm.displayName = "ProductForm";

// Helper Components for Accordion
function AccordionItem({
  children,
  value,
  ...props
}: {
  children: React.ReactNode;
  value: string;
} & React.ComponentProps<typeof Accordion.Item>) {
  return (
    <Accordion.Item
      value={value}
      className="overflow-hidden rounded-xl border border-neutral-200"
      {...props}
    >
      {children}
    </Accordion.Item>
  );
}

function AccordionTrigger({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof Accordion.Trigger>) {
  return (
    <Accordion.Header className="flex">
      <Accordion.Trigger
        className="group flex flex-1 items-center justify-between px-4 py-3 text-left font-medium outline-none hover:bg-neutral-50 focus:bg-neutral-50"
        {...props}
      >
        {children}
        <ChevronDownIcon className="h-4 w-4 transition-transform duration-300 group-data-[state=open]:rotate-180" />
      </Accordion.Trigger>
    </Accordion.Header>
  );
}

function AccordionContent({
  children,
  ...props
}: {
  children: React.ReactNode;
} & React.ComponentProps<typeof Accordion.Content>) {
  return (
    <Accordion.Content
      className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden"
      {...props}
    >
      <div className="px-4 pb-4 text-neutral-600">{children}</div>
    </Accordion.Content>
  );
}

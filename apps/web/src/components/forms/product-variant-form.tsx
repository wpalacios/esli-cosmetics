"use client";
import {
  useCreateProductVariant,
  useUpdateProductVariant,
} from "@/hooks/use-product-variants";
import {
  ApiProductVariant,
  CreateApiProductVariantRequest,
  UpdateApiProductVariantRequest,
  PriceType,
  VariantPrice,
} from "@esli-cosmetics/types";
import { Button, Input, Label, Checkbox } from "@esli-cosmetics/ui";
import { NumberInput } from "~/components/ui/number-input";
import { ProductImageUpload } from "~/components/ui";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { zodResolver } from "@/lib/zod-resolver";
import { PlusIcon } from "@radix-ui/react-icons";
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AiOutlineDelete } from "react-icons/ai";
import { z } from "zod";
import { useDropzone } from "react-dropzone";
import { addProductVariantImage } from "@/actions/product-images";
import { FILE_UPLOAD, cn } from "@esli-cosmetics/utils";
import { BiImageAdd } from "react-icons/bi";
import { useToast } from "@/hooks/toast/use-toast";

const cleanNumber = (val: unknown) =>
  typeof val === "string" && val.trim() !== "" ? parseFloat(val) : val;

const cleanInt = (val: unknown) =>
  typeof val === "string" && val.trim() !== "" ? parseInt(val) : val;

const cleanOptional = (val: unknown): string | undefined => {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "string" && val.trim() === "") return undefined;
  if (typeof val === "number" && isNaN(val as number)) return undefined;
  if (typeof val !== "string") return undefined;
  return val;
};

type AttributeEntry = {
  key: string;
  value: string;
  id: number;
};

// Create a function that returns the schema with translations
const createVariantSchema = (
  t: (key: string) => string,
  priceTypes: PriceType[]
) =>
  z
    .object({
      name: z.string().trim().nonempty(t("form.nameRequired")),
      sku: z.string().optional(),
      barcode: z.string().optional(),
      costPrice: z.preprocess(
        cleanNumber,
        z
          .number({ invalid_type_error: t("form.costPriceInvalid") })
          .min(0, t("form.costPriceNegative"))
      ),
      minimumStock: z.preprocess(
        cleanInt,
        z
          .number({ invalid_type_error: t("form.minimumStockInvalid") })
          .int(t("form.minimumStockInvalid"))
          .min(0, t("form.minimumStockNegative"))
          .optional()
          .nullable()
      ),
      maximumStock: z.preprocess(
        cleanInt,
        z
          .number({ invalid_type_error: t("form.maximumStockInvalid") })
          .int(t("form.maximumStockInvalid"))
          .min(0, t("form.maximumStockNegative"))
          .optional()
          .nullable()
      ),
      multiple: z.preprocess(
        val =>
          typeof val === "string" && val.trim() !== "" ? parseInt(val) : val,
        z
          .number({
            invalid_type_error: t("form.multipleInvalid") || "Invalid multiple",
          })
          .int(t("form.multipleInvalid") || "Multiple must be an integer")
          .min(1, t("form.multipleMin") || "Multiple must be at least 1")
          .optional()
          .nullable()
      ),
      appliesToDiscounts: z.boolean().optional().nullable(),
    })
    .superRefine((data, ctx) => {
      const min = data.minimumStock;
      const max = data.maximumStock;

      if (
        min !== null &&
        min !== undefined &&
        max !== null &&
        max !== undefined
      ) {
        if (min > max) {
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
      }
    });

type VariantFormData = z.infer<ReturnType<typeof createVariantSchema>>;

interface ProductVariantFormProps {
  parentId: string | undefined;
  onSuccess: (newVariant: ApiProductVariant) => void;
  disabled: boolean;
  existingBarcodes?: string[];
  existingSkus?: string[];
  editingVariant?: ApiProductVariant | null;
  onCancel?: () => void;
  /** Llamado después de crear una variante para que el padre limpie editingVariant y el formulario quede vacío */
  onAfterCreate?: () => void;
  priceTypes: PriceType[];
  onError?: (error: any) => void;
  isDefaultVariant?: boolean;
  /** Optional parent product (for showing existing product images) */
  parentProduct?:
    | {
        id: string;
        images?: Array<{
          id: string;
          url: string;
          sortOrder: number;
          isPrimary: boolean;
          createdAt: Date;
        }>;
      }
    | null
    | undefined;
  /** Notify parent when create/update variant is in progress (for disabling stepper buttons) */
  onSubmittingChange?: (isSubmitting: boolean) => void;
}

type PriceErrors = Record<string, string>;

export interface ProductVariantFormRef {
  focusFirstInput: () => void;
}

export const ProductVariantForm = forwardRef<
  ProductVariantFormRef,
  ProductVariantFormProps
>(function ProductVariantForm(
  {
    parentId,
    onSuccess,
    disabled,
    editingVariant,
    onCancel,
    onAfterCreate,
    priceTypes,
    onError,
    parentProduct,
    onSubmittingChange,
  },
  ref
) {
  const { t } = useTranslation("products");
  const { toast } = useToast();
  const createVariantMutation = useCreateProductVariant();
  const updateVariantMutation = useUpdateProductVariant();
  const [priceErrors, setPriceErrors] = useState<PriceErrors>({});
  const [attributes, setAttributes] = useState<AttributeEntry[]>([
    { key: "", value: "", id: Date.now() },
  ]);
  const [pendingVariantImageFiles, setPendingVariantImageFiles] = useState<
    File[]
  >([]);
  const MAX_PENDING_VARIANT_IMAGES = 10;

  // State for managing prices - tracks configured price types
  const [prices, setPrices] = useState<VariantPrice[]>([]);

  const onPendingVariantDrop = useCallback((accepted: File[]) => {
    setPendingVariantImageFiles(prev =>
      [...prev, ...accepted].slice(0, MAX_PENDING_VARIANT_IMAGES)
    );
  }, []);
  const removePendingVariantImage = useCallback((index: number) => {
    setPendingVariantImageFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  // Ref for the first input field to enable focusing
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focusFirstInput: () => {
      // Small delay to ensure the form is enabled and rendered
      setTimeout(() => {
        firstInputRef.current?.focus();
      }, 100);
    },
  }));

  const isVariantMutationPending =
    createVariantMutation.isPending || updateVariantMutation.isPending;
  useEffect(() => {
    onSubmittingChange?.(isVariantMutationPending);
  }, [isVariantMutationPending, onSubmittingChange]);

  const isEditMode = !!editingVariant;
  const isFormDisabled = disabled || isVariantMutationPending;

  const {
    getRootProps: getPendingVariantRootProps,
    getInputProps: getPendingVariantInputProps,
    isDragActive: isPendingVariantDragActive,
  } = useDropzone({
    onDrop: onPendingVariantDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxSize: FILE_UPLOAD.maxSize,
    maxFiles: MAX_PENDING_VARIANT_IMAGES - pendingVariantImageFiles.length,
    disabled: isFormDisabled || !!editingVariant?.id,
    multiple: true,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
  } = useForm<VariantFormData>({
    resolver: zodResolver(createVariantSchema(t, priceTypes)),
    defaultValues: {
      name: editingVariant?.name || "",
      sku: editingVariant?.sku || "",
      barcode: editingVariant?.barcode || "",
      costPrice: editingVariant?.costPrice || 0,
      minimumStock: editingVariant?.minimumStock ?? undefined,
      maximumStock: editingVariant?.maximumStock ?? undefined,
      multiple: editingVariant?.multiple ?? undefined,
      // coerce to boolean explicitly (avoid undefined / null / string)
      appliesToDiscounts: editingVariant?.appliesToDiscounts ?? true,
    },
  });

  // Debug form errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
    }
  }, [errors]);

  // Initialize form with editing variant data
  useEffect(() => {
    if (editingVariant) {
      reset({
        name: editingVariant.name || "",
        sku: editingVariant.sku || "",
        barcode: editingVariant.barcode || "",
        costPrice: editingVariant.costPrice || 0,
        minimumStock: editingVariant.minimumStock || undefined,
        maximumStock: editingVariant.maximumStock || undefined,
        multiple: editingVariant.multiple || undefined,
        appliesToDiscounts: editingVariant.appliesToDiscounts ?? true,
      });

      // Initialize prices state
      setPrices(
        Array.isArray(editingVariant.prices) ? editingVariant.prices : []
      );
      // Initialize attributes
      if (
        editingVariant.attributes &&
        Object.keys(editingVariant.attributes).length > 0
      ) {
        const attributeEntries = Object.entries(editingVariant.attributes).map(
          ([key, value], index) => ({
            key,
            value: String(value),
            id: Date.now() + index,
          })
        );
        setAttributes(attributeEntries);
      } else {
        setAttributes([{ key: "", value: "", id: Date.now() }]);
      }
    } else {
      reset({
        name: "",
        sku: "",
        barcode: "",
        costPrice: 0,
        minimumStock: undefined,
        maximumStock: undefined,
        multiple: undefined,
        // default checked when creating a new variant
        appliesToDiscounts: true,
      });
      setPrices([]);
      setAttributes([{ key: "", value: "", id: Date.now() }]);
    }
    setPendingVariantImageFiles([]);
  }, [editingVariant, reset, priceTypes]);

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
      const priceType = priceTypes.find(pt => pt.id === priceTypeId);
      const defaultMinQuantity = priceType?.minQuantity ?? 1;

      const isMinQuantityField = field === "minQuantity";
      const numericValue = parseFloat(value);

      if (field === "price" && value.trim() === "") {
        // Remove price configuration if price is cleared
        return currentPrices.filter(p => p.priceTypeId !== priceTypeId);
      }

      let finalModifiedValue;

      if (isMinQuantityField) {
        const trimmedValue = value.trim();
        const parsedInt = parseInt(trimmedValue);

        if (trimmedValue === "") {
          if (!existingConfig) return currentPrices;
          finalModifiedValue = existingConfig.minQuantity ?? defaultMinQuantity;
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
        // Update existing configuration
        return currentPrices.map(p =>
          p.priceTypeId === priceTypeId ? newConfig : p
        );
      } else if (field === "price" && newConfig.price > 0) {
        // Add new configuration when price is set
        return [...currentPrices, newConfig];
      }

      return currentPrices;
    });
  };

  const handleAddPrice = (priceTypeId: string) => {
    const priceType = priceTypes.find(pt => pt.id === priceTypeId);
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

  const validatePrices = () => {
    let hasPriceErrors = false;
    const newPriceErrors: PriceErrors = {};

    // Validate all configured prices
    prices.forEach(priceConfig => {
      if (
        priceConfig.price === 0 ||
        priceConfig.price === null ||
        priceConfig.price === undefined
      ) {
        newPriceErrors[priceConfig.priceTypeId] = t("form.priceRequired");
        hasPriceErrors = true;
      } else if (priceConfig.price > 0) {
        const minQty = priceConfig.minQuantity ?? 1;
        if (!Number.isInteger(minQty) || minQty < 1) {
          newPriceErrors[`minQuantity-${priceConfig.priceTypeId}`] = t(
            "form.minQuantityInvalid"
          );
          hasPriceErrors = true;
        }
      }
    });

    setPriceErrors(newPriceErrors);

    return !hasPriceErrors;
  };

  const onSubmit = async (data: VariantFormData) => {
    clearErrors();

    if (isEditMode) {
      if (!editingVariant?.id) {
        console.error("ERROR: Cannot update. Variant ID is missing.");
        return;
      }
    } else {
      if (!parentId) {
        console.error("ERROR: Cannot create. Parent ID is missing.");
        return;
      }
    }

    if (!validatePrices()) {
      return;
    }
    clearErrors("root");

    const attributesPayload: Record<string, any> = {};
    attributes.forEach(attr => {
      const key = attr.key.trim();
      const value = attr.value.trim();
      if (key && value) {
        attributesPayload[key] = value;
      }
    });

    const attributesToSend =
      Object.keys(attributesPayload).length > 0 ? attributesPayload : undefined;

    const getOptionalNumber = (val: unknown) => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === "number" && isNaN(val)) return undefined;
      return val as number | undefined;
    };

    const extractedCostPrice = getOptionalNumber(data.costPrice);
    const costPriceValue: number = extractedCostPrice ?? 0;

    try {
      if (isEditMode) {
        // Filter out prices with price === 0 or invalid prices, and clean the data
        const validPrices: VariantPrice[] = (prices || [])
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
                typeof p.price === "string" ? Number(p.price) : Number(p.price),
            };
            // Only include minQuantity if it exists and is valid
            if (p.minQuantity != null) {
              cleaned.minQuantity =
                typeof p.minQuantity === "string"
                  ? Number(p.minQuantity)
                  : Number(p.minQuantity);
            }
            return cleaned;
          });

        const updatePayload: UpdateApiProductVariantRequest = {
          name: data.name,
          sku: cleanOptional(data.sku),
          barcode: cleanOptional(data.barcode),
          // Only include prices if there are valid prices
          ...(validPrices.length > 0 ? { prices: validPrices } : {}),
          costPrice: costPriceValue,
          minimumStock: getOptionalNumber(data.minimumStock),
          maximumStock: getOptionalNumber(data.maximumStock),
          multiple: getOptionalNumber(data.multiple),
          appliesToDiscounts: data.appliesToDiscounts ?? true,
          attributes: attributesToSend,
        };

        const variables = {
          productId: editingVariant.productId,
          variantId: editingVariant!.id,
          data: updatePayload,
        };

        const updatedVariant = (await updateVariantMutation.mutateAsync(
          variables as any
        )) as ApiProductVariant;

        onSuccess(updatedVariant);
        reset({
          name: updatedVariant.name || "",
          sku: updatedVariant.sku || "",
          barcode: updatedVariant.barcode || "",
          costPrice: updatedVariant.costPrice || 0,
          minimumStock: 0,
          maximumStock: 0,
          multiple: updatedVariant.multiple || undefined,
          appliesToDiscounts: !!updatedVariant.appliesToDiscounts,
        });
      } else {
        // Filter out prices with price === 0 or invalid prices, and clean the data
        const validPrices: VariantPrice[] = (prices || [])
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
                typeof p.price === "string" ? Number(p.price) : Number(p.price),
            };
            // Only include minQuantity if it exists and is valid
            if (p.minQuantity != null) {
              cleaned.minQuantity =
                typeof p.minQuantity === "string"
                  ? Number(p.minQuantity)
                  : Number(p.minQuantity);
            }
            return cleaned;
          });

        const createPayload: CreateApiProductVariantRequest = {
          name: data.name,
          sku: cleanOptional(data.sku),
          barcode: cleanOptional(data.barcode),
          // prices is required, so always include it (even if empty)
          prices: validPrices,
          costPrice: costPriceValue,
          minimumStock: getOptionalNumber(data.minimumStock),
          maximumStock: getOptionalNumber(data.maximumStock),
          multiple: getOptionalNumber(data.multiple),
          // default checked on create unless user explicitly unchecks it
          appliesToDiscounts: data.appliesToDiscounts ?? true,
          attributes: attributesToSend,
        };

        const variables = { productId: parentId!, data: createPayload };

        const newVariant = (await createVariantMutation.mutateAsync(
          variables as any
        )) as ApiProductVariant;

        // Upload pending variant images in the same action
        if (pendingVariantImageFiles.length > 0 && newVariant.id && parentId) {
          const UPLOAD_DELAY_MS = 120;
          const UPLOAD_RETRY_STATUSES = [502, 503];
          const UPLOAD_RETRY_DELAY_MS = 600;
          try {
            for (let i = 0; i < pendingVariantImageFiles.length; i++) {
              if (i > 0) {
                await new Promise(r => setTimeout(r, UPLOAD_DELAY_MS));
              }
              const file = pendingVariantImageFiles[i];
              if (!file) continue;
              const doUpload = async (retry = true): Promise<void> => {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("variantId", newVariant.id);
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
                await addProductVariantImage(newVariant.id, {
                  url: result.url,
                  sortOrder: i,
                  isPrimary: i === 0,
                });
              };
              await doUpload();
            }
            setPendingVariantImageFiles([]);
          } catch (uploadErr: unknown) {
            const msg =
              uploadErr instanceof Error
                ? uploadErr.message
                : t("form.imagesUploadError", "Error al subir imágenes");
            toast({
              title: t("form.error", "Error"),
              description: msg,
              type: "error",
              duration: 5000,
            });
          }
        }

        // Siempre limpiar el campo de imágenes pendientes después de crear la variante
        setPendingVariantImageFiles([]);

        onSuccess(newVariant);
        // Pedir al padre que limpie editingVariant para que el formulario se resetee y quede vacío (no en modo edición de la variante recién creada)
        onAfterCreate?.();
        reset({
          name: "",
          sku: "",
          barcode: "",
          costPrice: 0,
          minimumStock: 0,
          maximumStock: 0,
          multiple: undefined,
          appliesToDiscounts: false,
        });
        setAttributes([{ key: "", value: "", id: Date.now() }]);
        setPrices([]);
      }
    } catch (error: unknown) {
      console.error(
        `ERROR: Failed to ${isEditMode ? "update" : "create"} variant:`,
        error
      );

      // Extract structured error data if available from the response
      const errorData = (error as any)?.response?.data;
      const errorMessage =
        errorData?.message ||
        (error as any)?.message ||
        t("validation.genericConflict");
      const errorField = errorData?.field; // e.g., "sku" or "barcode"

      // Propagate the error message to the parent modal for the toast notification
      if (onError) {
        onError(errorMessage);
      }

      // Set field-specific error using the structured response
      if (errorField === "sku") {
        setError(
          "sku",
          { type: "server", message: t("validation.duplicateSku") },
          { shouldFocus: true }
        );
      } else if (errorField === "barcode") {
        setError(
          "barcode",
          { type: "server", message: t("validation.duplicateBarcode") },
          { shouldFocus: true }
        );
      } else {
        // Fallback for generic or non-field-specific errors
        setError("root", {
          type: "server",
          message: errorMessage,
        });
      }
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <form
        onSubmit={e => {
          handleSubmit(onSubmit)(e);
        }}
        className="space-y-3 sm:space-y-4"
      >
        {errors.root && (
          <div className="rounded border border-red-400 bg-red-100 p-3 text-red-700">
            <p className="text-sm font-medium">{errors.root.message}</p>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="variant-name">{t("form.variantName")}</Label>
            <Input
              id="variant-name"
              {...(() => {
                const registration = register("name");
                const { ref: registerRef, ...rest } = registration;
                return {
                  ...rest,
                  ref: (e: HTMLInputElement | null) => {
                    firstInputRef.current = e;
                    if (typeof registerRef === "function") {
                      registerRef(e);
                    } else if (
                      registerRef &&
                      typeof registerRef === "object" &&
                      "current" in registerRef
                    ) {
                      const refObject =
                        registerRef as React.MutableRefObject<HTMLInputElement | null>;
                      refObject.current = e;
                    }
                  },
                };
              })()}
              className={`h-12 ${errors.name ? "border-red-500" : ""}`}
              disabled={isFormDisabled}
              placeholder={t("form.variantNamePlaceholder")}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="variant-cost">{t("form.costPrice")}</Label>
            <Input
              id="variant-cost"
              type="number"
              step="0.01"
              {...register("costPrice", { valueAsNumber: true })}
              className={`h-12 ${errors.costPrice ? "border-red-500" : ""}`}
              disabled={isFormDisabled}
            />
            {errors.costPrice && (
              <p className="text-xs text-red-500">{errors.costPrice.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="variant-sku">{t("form.variantSku")}</Label>
            <Input
              id="variant-sku"
              {...register("sku")}
              className={`h-12 ${errors.sku ? "border-red-500" : ""}`}
              disabled={isFormDisabled}
              placeholder={t("form.variantSkuPlaceholder")}
            />
            {errors.sku && (
              <p className="text-xs text-red-500">{errors.sku.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="variant-barcode">{t("form.variantBarcode")}</Label>
            <Input
              id="variant-barcode"
              {...register("barcode")}
              className={`h-12 ${errors.barcode ? "border-red-500" : ""}`}
              disabled={isFormDisabled}
              placeholder={t("form.variantBarcodePlaceholder")}
            />
            {errors.barcode && (
              <p className="text-xs text-red-500">{errors.barcode.message}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="variant-min-stock">{t("form.minimumStock")}</Label>
            <Input
              id="variant-min-stock"
              type="number"
              {...register("minimumStock", { valueAsNumber: true })}
              className={`h-12 ${errors.minimumStock ? "border-red-500" : ""}`}
              disabled={isFormDisabled}
            />
            {errors.minimumStock && (
              <p className="text-xs text-red-500">
                {errors.minimumStock.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="variant-max-stock">{t("form.maximumStock")}</Label>
            <Input
              id="variant-max-stock"
              type="number"
              {...register("maximumStock", { valueAsNumber: true })}
              className={`h-12 ${errors.maximumStock ? "border-red-500" : ""}`}
              disabled={isFormDisabled}
            />
            {errors.maximumStock && (
              <p className="text-xs text-red-500">
                {errors.maximumStock.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="variant-multiple">{t("form.multiple")}</Label>
            <NumberInput
              id="variant-multiple"
              step="1"
              min={1}
              value={watch("multiple") ?? ""}
              onChange={value =>
                setValue("multiple", value, { shouldValidate: true })
              }
              className={`${errors.multiple ? "border-red-500" : ""}`}
              disabled={isFormDisabled}
              name={register("multiple", { valueAsNumber: true }).name}
              onBlur={register("multiple", { valueAsNumber: true }).onBlur}
              placeholder={t("form.multiplePlaceholder")}
            />
            {errors.multiple && (
              <p className="mt-1 text-xs text-red-500">
                {errors.multiple.message}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {t("form.multipleHint")}
            </p>
          </div>
        </div>
        {/* Applies to discounts: placed with pricing fields for clarity */}
        <div className="!my-6 flex items-center space-x-2">
          <Checkbox
            id="applies-to-discounts"
            checked={watch("appliesToDiscounts") ?? true}
            onCheckedChange={checked =>
              setValue("appliesToDiscounts", checked as boolean)
            }
            disabled={isFormDisabled}
          />
          <Label
            htmlFor="applies-to-discounts"
            className="!mb-0 cursor-pointer"
          >
            {t("form.appliesToDiscounts")}
          </Label>
        </div>
        <Accordion.Root
          type="multiple"
          defaultValue={["prices"]}
          className="w-full space-y-2"
        >
          <AccordionItem value="prices">
            <AccordionTrigger>{t("form.sellingPrices")}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {priceTypes.length > 0 ? (
                  <>
                    {/* Unified Price Types List */}
                    <div className="space-y-3">
                      {priceTypes.map(priceType => {
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
                                    disabled={isFormDisabled}
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
                                          {t("form.configured") || "configured"}
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
                                      <Input
                                        id={`price-${priceType.id}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={
                                          priceConfig.price == null
                                            ? ""
                                            : String(priceConfig.price)
                                        }
                                        onChange={e =>
                                          handlePriceChange(
                                            priceType.id,
                                            e.target.value,
                                            "price"
                                          )
                                        }
                                        className={`h-12 ${priceError ? "border-red-500" : ""}`}
                                        disabled={isFormDisabled}
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
                                      <Input
                                        id={`min-qty-${priceType.id}`}
                                        type="number"
                                        step="1"
                                        min="1"
                                        value={String(
                                          priceConfig.minQuantity ??
                                            priceType.minQuantity
                                        )}
                                        onChange={e =>
                                          handlePriceChange(
                                            priceType.id,
                                            e.target.value,
                                            "minQuantity"
                                          )
                                        }
                                        className={`h-12 ${minQtyError ? "border-red-500" : ""}`}
                                        disabled={isFormDisabled}
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

          <AccordionItem value="attributes">
            <AccordionTrigger>{t("form.attributes")}</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                {attributes.map((attr, index) => (
                  <div key={attr.id} className="grid grid-cols-10 gap-3">
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
                          handleAttributeChange(attr.id, "key", e.target.value)
                        }
                        placeholder={t("form.attributeNamePlaceholder")}
                        className={`h-12`}
                        disabled={isFormDisabled}
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
                        placeholder={t("form.attributeValuePlaceholder")}
                        className={`h-12`}
                        disabled={isFormDisabled}
                      />
                    </div>
                    <div className="col-span-1 flex items-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttribute(attr.id)}
                        disabled={isFormDisabled || attributes.length === 1}
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
                  disabled={isFormDisabled}
                  className="mt-2 w-full justify-center"
                >
                  <PlusIcon className="mr-2 h-4 w-4" />
                  {t("form.addAttribute")}
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion.Root>

        <div className="rounded-lg border border-gray-200 p-6 dark:border-gray-700">
          <h3 className="mb-4 text-base font-semibold">
            {t("form.variantImages", "Imágenes de la variante")}
          </h3>
          {editingVariant?.id && parentId ? (
            <>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                {t(
                  "form.variantImagesHelp",
                  "Si agregas imágenes aquí, se usarán para esta variante. Si no, se usarán las imágenes del producto."
                )}
              </p>
              <ProductImageUpload
                productId={parentId}
                variantId={editingVariant.id}
                initialImages={editingVariant?.images ?? []}
                maxImages={100}
                disabled={isFormDisabled}
              />
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t(
                  "form.variantImagesCreateHint",
                  "Agrega imágenes aquí. Se subirán al guardar la variante."
                )}
              </p>
              <div
                {...getPendingVariantRootProps()}
                className={cn(
                  "flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200",
                  "border-[#f5b1cc]/60 bg-gradient-to-br from-pink-50/80 to-purple-50/80 hover:border-[#ff48b0]/60 hover:from-pink-100/80 hover:to-purple-100/80",
                  "dark:border-pink-900/50 dark:from-pink-950/50 dark:to-purple-950/50 dark:hover:border-[#ff48b0]/50",
                  (isFormDisabled ||
                    pendingVariantImageFiles.length >=
                      MAX_PENDING_VARIANT_IMAGES) &&
                    "pointer-events-none opacity-60"
                )}
              >
                <input {...getPendingVariantInputProps()} tabIndex={-1} />
                <BiImageAdd className="h-8 w-8 text-[#ff48b0]" aria-hidden />
                <span className="mt-2 text-center text-xs font-medium text-gray-600 dark:text-gray-400">
                  {(() => {
                    if (isPendingVariantDragActive) return "Suelta aquí";
                    if (
                      pendingVariantImageFiles.length >=
                      MAX_PENDING_VARIANT_IMAGES
                    )
                      return `Máximo ${MAX_PENDING_VARIANT_IMAGES} imágenes`;
                    return t(
                      "form.variantImagesDropzone",
                      "Arrastra o haz clic para agregar imágenes"
                    );
                  })()}
                </span>
                <span className="mt-0.5 text-center text-[10px] text-gray-500">
                  JPG, PNG o WebP · Máx. 5 MB
                </span>
              </div>
              {pendingVariantImageFiles.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {pendingVariantImageFiles.map((file, index) => (
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
                          removePendingVariantImage(index);
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

        <div className="flex flex-col justify-end space-y-2 pt-2 sm:flex-row sm:space-x-3 sm:space-y-0">
          {isEditMode && onCancel && (
            <Button
              type="button"
              variant="outline"
              onClickCapture={() => {
                reset({
                  name: "",
                  sku: "",
                  barcode: "",
                  costPrice: 0,
                  minimumStock: 0,
                  maximumStock: 0,
                  multiple: undefined,
                  appliesToDiscounts: true,
                });
              }}
              onClick={onCancel}
              disabled={isFormDisabled}
              className="w-full sm:w-auto"
            >
              {t("form.cancel")}
            </Button>
          )}
          <Button
            type="submit"
            disabled={isFormDisabled || isSubmitting}
            variant="secondary"
            className="w-full sm:w-auto"
          >
            {isSubmitting
              ? isEditMode
                ? t("form.updatingVariant")
                : t("form.creatingVariant")
              : isEditMode
                ? t("form.updateVariant")
                : t("form.createVariant")}
          </Button>
        </div>
      </form>
    </div>
  );
});

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

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button, Input, Label } from "@esli-cosmetics/ui";
import {
  StockMovementType,
  ApiProductVariant,
  ProductVariant,
  ProductWithRelations,
  ProductType,
} from "@esli-cosmetics/types";
import { useCreateStockMovement } from "@/hooks/use-stock-movements";
import { useProduct } from "@/hooks/use-products";
import { useStockLevelByLocationAndProduct } from "@/hooks/use-stock-levels";
import { ProductSelect } from "@/components/ui/product-select";
import { ProductVariantSelect } from "@/components/ui/product-variant-select";
import { LocationSelect } from "@/components/ui/location-select";
import { NumberInput } from "@/components/ui/number-input";
import { MovementTypeConfig } from "@/app/(dashboard)/stock/stock-movements/components/create-stock-movement-dropdown";
import { useProductVariant } from "@/hooks/use-product-variants";

type StockMovementFormData = {
  productVariantId: string | undefined;
  productId?: string | undefined;
  fromLocationId?: string | undefined;
  toLocationId?: string | undefined;
  movementType: StockMovementType;
  quantity: string;
  reference?: string | undefined;
  note?: string | undefined;
};

// Props to create stock movement form
interface StockMovementFormProps {
  onSuccess: (action: "create") => void;
  onCancel: () => void;
  movementType: StockMovementType;
  config: MovementTypeConfig;
}

// Validation schema factory
const createValidationSchema = (
  config: MovementTypeConfig,
  movementType: StockMovementType,
  t: (key: string) => string
) => {
  return z
    .object({
      productVariantId: z.string().min(1, t("movements.form.variantRequired")),
      productId: z.string().optional(),
      fromLocationId: config.fromLocation.required
        ? z.string().min(1, t("movements.form.fromLocationRequired"))
        : z.string().optional().or(z.literal("")),
      toLocationId: config.toLocation.required
        ? z.string().min(1, t("movements.form.toLocationRequired"))
        : z.string().optional().or(z.literal("")),
      movementType: z.nativeEnum(StockMovementType),
      quantity: z
        .string()
        .refine(
          val => !isNaN(Number(val)) && Number(val) >= 0.01,
          t("movements.form.quantityMin")
        ),
      reference: config.reference.required
        ? z.string().min(1, t("movements.form.referenceRequired"))
        : z.string().optional().or(z.literal("")),
      note: config.note.required
        ? z.string().min(1, t("movements.form.noteRequired"))
        : z.string().optional().or(z.literal("")),
    })
    .refine(
      data => {
        if (movementType === StockMovementType.TRANSFER) {
          return data.fromLocationId !== data.toLocationId;
        }
        return true;
      },
      {
        message: t("movements.form.transferSameLocationError"),
        path: ["toLocationId"],
      }
    );
};

export function StockMovementForm({
  onSuccess,
  onCancel,
  movementType,
  config,
}: StockMovementFormProps) {
  const { t } = useTranslation(["stock", "stock-movements"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationSchema = useMemo(
    () => createValidationSchema(config, movementType, t),
    [config, movementType, t]
  );

  const form = useForm<StockMovementFormData>({
    resolver: zodResolver(validationSchema),
    mode: "onChange",
    defaultValues: {
      movementType: movementType,
      quantity: "",
      productVariantId: "",
      productId: "",
      fromLocationId: "",
      toLocationId: "",
      reference: "",
      note: "",
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
    setValue,
    watch,
    setError,
    clearErrors,
  } = form;

  const handleProductChange = useCallback(
    (id: string | undefined) => {
      setValue("productId", id || undefined, { shouldValidate: true });
      setValue("productVariantId", undefined, { shouldValidate: true });
    },
    [setValue]
  );

  const handleVariantChange = useCallback(
    (id: string | undefined) => {
      setValue("productVariantId", id, { shouldValidate: true });
    },
    [setValue]
  );

  const createMutation = useCreateStockMovement();

  const onSubmit = async (data: StockMovementFormData) => {
    setIsSubmitting(true);
    const quantityNumber = Number(data.quantity);
    if (isNaN(quantityNumber) || quantityNumber <= 0) {
      setError("quantity", {
        type: "manual",
        message: t("movements.form.quantityMin"),
      });
      return;
    }
    try {
      const payload = {
        movementType: data.movementType,
        quantity: quantityNumber,
        productVariantId: data.productVariantId!,
        ...(data.productId && { productId: data.productId }),
        ...(data.fromLocationId && { fromLocationId: data.fromLocationId }),
        ...(data.toLocationId && { toLocationId: data.toLocationId }),
        ...(data.reference && { reference: data.reference }),
        ...(data.note && { note: data.note }),
      };

      await createMutation.mutateAsync(payload);
      onSuccess("create");
      reset();
    } catch (error) {
      console.error("❌ Error al crear el movimiento de stock:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hooks and form watchers
  const selectedProductId = watch("productId");
  const selectedProductVariantId = watch("productVariantId");
  const selectedFromLocationId = watch("fromLocationId");
  const selectedToLocationId = watch("toLocationId");
  const watchedQuantity = watch("quantity");

  const { data: selectedProduct } = useProduct(selectedProductId!);

  const { data: selectedProductVariant } = useProductVariant(
    selectedProductVariantId!
  );
  // Effect to auto-select default variant if product is defaultVariantOnly
  useEffect(() => {
    if (selectedProduct && selectedProduct.defaultVariantOnly) {
      const defaultVariantId = selectedProduct.variants?.[0]?.id;
      if (defaultVariantId && selectedProductVariantId !== defaultVariantId) {
        setValue("productVariantId", defaultVariantId, {
          shouldValidate: true,
        });
      }
    }
  }, [selectedProduct, setValue, selectedProductVariantId]);

  const hasVariantConfigurationError = useMemo(() => {
    if (!selectedProduct) return false;
    return (
      !selectedProduct.defaultVariantOnly &&
      (!selectedProduct.variants || selectedProduct.variants.length === 0)
    );
  }, [selectedProduct]);

  const needsStockCheck = useMemo(
    () =>
      [
        StockMovementType.NEGATIVE_ADJUSTMENT,
        StockMovementType.TRANSFER,
        StockMovementType.DAMAGE,
      ].includes(movementType),
    [movementType]
  );

  // Fetch stock level for fromLocation when applicable
  // Clean up empty strings and convert to null/undefined for the hook

  const cleanVariantId =
    selectedProductVariantId && selectedProductVariantId.trim() !== ""
      ? selectedProductVariantId
      : null;
  const cleanProductId =
    selectedProductId && selectedProductId.trim() !== ""
      ? selectedProductId
      : null;

  const { data: fromLocationStockLevel, isLoading: isLoadingStockLevel } =
    useStockLevelByLocationAndProduct(
      config.fromLocation.show && selectedFromLocationId
        ? selectedFromLocationId
        : null,
      cleanVariantId,
      cleanProductId
    );


  const { data: toLocationStockLevel, isLoading: isLoadingToStockLevel } =
    useStockLevelByLocationAndProduct(
      config.toLocation.show && selectedToLocationId
        ? selectedToLocationId
        : null,
      cleanVariantId,
      cleanProductId
    );

  // Available = quantity - reserved (must match backend validation)
  const availableQuantity = useMemo(() => {
    if (!fromLocationStockLevel) return 0;
    const qty = Number(fromLocationStockLevel.quantity);
    const reserved = Number(fromLocationStockLevel.reserved ?? 0);
    const available = qty - reserved;
    return isNaN(available) || available < 0 ? 0 : available;
  }, [fromLocationStockLevel]);

  const availableToQuantity = useMemo(() => {
    if (!toLocationStockLevel) return 0;
    const qty = Number(toLocationStockLevel.quantity);
    const reserved = Number(toLocationStockLevel.reserved ?? 0);
    const available = qty - reserved;
    return isNaN(available) || available < 0 ? 0 : available;
  }, [toLocationStockLevel]);

  useEffect(() => {
    const shouldShowErrorForMovementType = [
      StockMovementType.NEGATIVE_ADJUSTMENT,
      StockMovementType.TRANSFER,
      StockMovementType.DAMAGE,
    ].includes(movementType);

    const quantityNum = Number(watchedQuantity);

    if (
      shouldShowErrorForMovementType &&
      watchedQuantity !== "" &&
      quantityNum > availableQuantity
    ) {
      setError("quantity", {
        type: "manual",
        message: t("movements.form.quantityMax", { count: availableQuantity }),
      });
    } else if (
      shouldShowErrorForMovementType &&
      watchedQuantity !== "" &&
      quantityNum <= availableQuantity &&
      errors.quantity?.type === "manual"
    ) {
      clearErrors("quantity");
    }
  }, [
    watchedQuantity,
    availableQuantity,
    movementType,
    setError,
    clearErrors,
    t,
    errors.quantity?.type,
  ]);
  const hasProductPriceError = useMemo(() => {
    if (
      movementType !== StockMovementType.SALE ||
      !selectedProduct ||
      !selectedProduct.defaultVariantOnly
    ) {
      return false;
    }
    const variant = selectedProduct.variants?.[0];
    return !variant || !variant.prices || variant.prices.length === 0;
  }, [movementType, selectedProduct]);

  const hasVariantPriceError = useMemo(() => {
    if (
      movementType !== StockMovementType.SALE ||
      !selectedProductVariant ||
      selectedProduct?.defaultVariantOnly
    ) {
      return false;
    }
    return (
      !selectedProductVariant.prices ||
      selectedProductVariant.prices.length === 0
    );
  }, [movementType, selectedProductVariant, selectedProduct]);

  useEffect(() => {
    if (hasProductPriceError) {
      setError("productId", {
        type: "manual",
        message: t("movements.form.noProductPriceConfig"),
      });
    } else if (errors.productId?.type === "manual") {
      clearErrors("productId");
    }

    if (hasVariantPriceError) {
      setError("productVariantId", {
        type: "manual",
        message: t("movements.form.noVariantPriceConfig"),
      });
    } else if (errors.productVariantId?.type === "manual") {
      clearErrors("productVariantId");
    }
  }, [
    hasProductPriceError,
    hasVariantPriceError,
    setError,
    clearErrors,
    t,
    errors.productId?.type,
    errors.productVariantId?.type,
  ]);

  const isButtonDisabled = useMemo(() => {
    const hasInsufficientStock =
      needsStockCheck &&
      (isLoadingStockLevel ||
        availableQuantity === null ||
        availableQuantity <= 0 ||
        (typeof watchedQuantity === "string" && watchedQuantity === "") ||
        (typeof watchedQuantity === "number" &&
          watchedQuantity > availableQuantity));

    return (
      !isValid ||
      isSubmitting ||
      hasVariantConfigurationError ||
      hasInsufficientStock ||
      hasProductPriceError ||
      hasVariantPriceError
    );
  }, [
    isValid,
    isSubmitting,
    hasVariantConfigurationError,
    needsStockCheck,
    availableQuantity,
    watchedQuantity,
    isLoadingStockLevel,
    hasProductPriceError,
    hasVariantPriceError,
  ]);

  const movementTypeName = t(`movements.types.${movementType}`, {
    ns: "stock",
  });

  const movementTypeBadgeClasses: Record<StockMovementType, string> = {
    [StockMovementType.PURCHASE]:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    [StockMovementType.SALE]:
      "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    [StockMovementType.POSITIVE_ADJUSTMENT]:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    [StockMovementType.NEGATIVE_ADJUSTMENT]:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    [StockMovementType.TRANSFER]:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    [StockMovementType.DAMAGE]:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
    [StockMovementType.RETURN]:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
    [StockMovementType.RESTOCK]:
      "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
    [StockMovementType.ANNULMENT]:
      "bg-gray-200 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300",
  };

  const badgeClass = movementTypeBadgeClasses[movementType];

  function handleQuantityChange(val: string | number | undefined) {
    let safeValue = "";
    if (typeof val === "number") {
      safeValue = String(val);
    } else if (typeof val === "string") {
      safeValue = val;
    }
    setValue("quantity", safeValue, { shouldValidate: true });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div>
        <h2 className="text-2xl text-gray-900 dark:text-white">
          <span
            className={`inline-block rounded-md px-3 py-1 align-middle text-xl font-medium ${badgeClass}`}
          >
            {movementTypeName}
          </span>
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t(`movements.form.typeDescriptions.${movementType}`)}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t("movements.form.detailsHeading")}
          </h3>

          <div>
            <Label htmlFor="product-select">
              {t("movements.form.product")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <ProductSelect
              value={selectedProductId}
              onChange={handleProductChange}
              excludeTypes={[ProductType.KIT]}
              error={
                hasVariantConfigurationError
                  ? t("movements.form.missingVariantConfig")
                  : hasProductPriceError
                    ? t("movements.form.noProductPriceConfig")
                    : errors.productId?.message
              }
            />
          </div>

          {selectedProductId && !hasVariantConfigurationError && (
            <div>
              <Label htmlFor="product-variant-select">
                {t("movements.form.variant")}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <ProductVariantSelect
                variants={selectedProduct?.variants || []}
                value={selectedProductVariantId}
                onChange={handleVariantChange}
                error={
                  hasVariantPriceError
                    ? t("movements.form.noVariantPriceConfig")
                    : errors.productVariantId?.message
                }
                placeholder={t("movements.form.variantPlaceholder")}
                disabled={!!selectedProduct?.defaultVariantOnly}
              />
            </div>
          )}

          {config.fromLocation.show && (
            <div>
              <Label htmlFor="fromLocationId">
                {t(config.fromLocation.label)}
                {config.fromLocation.required && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
              <LocationSelect
                value={selectedFromLocationId}
                onChange={id =>
                  setValue("fromLocationId", id, { shouldValidate: true })
                }
                error={errors.fromLocationId?.message}
                excludeLocationId={selectedToLocationId}
              />
              {selectedFromLocationId && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {isLoadingStockLevel ? (
                    <span className="text-primary-600 dark:text-primary-400">
                      {t("movements.form.loadingStockLevel")}
                    </span>
                  ) : availableQuantity !== null ? (
                    <>
                      {t("movements.form.available")}:{" "}
                      <span
                        className={`font-medium ${
                          availableQuantity > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {availableQuantity.toFixed(2)}
                      </span>
                    </>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">
                      {t("movements.form.noStockAvailable")}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          {config.toLocation.show && (
            <div>
              <Label htmlFor="toLocationId">
                {t(config.toLocation.label)}
                {config.toLocation.required && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
              <LocationSelect
                value={selectedToLocationId}
                onChange={id =>
                  setValue("toLocationId", id, { shouldValidate: true })
                }
                error={errors.toLocationId?.message}
                excludeLocationId={selectedFromLocationId}
              />
              {selectedToLocationId && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {isLoadingToStockLevel ? (
                    <span className="text-primary-600 dark:text-primary-400">
                      {t("movements.form.loadingStockLevel")}
                    </span>
                  ) : (
                    <>
                      {t("movements.form.available")}:{" "}
                      <span
                        className={`font-medium ${
                          availableToQuantity > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {availableToQuantity.toFixed(2)}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {t("movements.form.additionalInfoHeading")}
          </h3>

          <div>
            <Label htmlFor="quantity">
              {t("movements.form.quantityRequired")}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <NumberInput
              id="quantity"
              value={watchedQuantity}
              min={1}
              step={1}
              max={availableQuantity || 999999}
              onChange={handleQuantityChange}
              error={errors.quantity?.message || ""}
            />
          </div>

          {config.reference.show && (
            <div>
              <Label htmlFor="reference">
                {t(config.reference.label)}
                {config.reference.required && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
              <Input
                id="reference"
                {...register("reference")}
                placeholder={t(config.reference.placeholder || "")}
                error={errors.reference?.message || ""}
              />
            </div>
          )}

          {config.note.show && (
            <div>
              <Label htmlFor="note">
                {t(config.note.label)}
                {config.note.required && (
                  <span className="text-red-500"> *</span>
                )}
              </Label>
              <textarea
                id="note"
                {...register("note")}
                rows={4}
                placeholder={t(config.note.placeholder || "")}
                className={`focus:border-primary active:border-primary dark:focus:border-primary w-full rounded-lg border bg-transparent px-4 py-3 text-black outline-none transition disabled:cursor-default disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${
                  errors.note ? "border-red-500" : "border-gray-200"
                }`}
              />
              {errors.note?.message && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.note.message}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {t("movements.form.cancel")}
        </Button>
        <Button type="submit" variant="primary" disabled={isButtonDisabled}>
          {isSubmitting
            ? t("movements.form.creating")
            : t("movements.form.create")}
        </Button>
      </div>
    </form>
  );
}

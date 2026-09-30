"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Label,
  Textarea,
  SearchableSelect,
  type SearchableSelectOption,
} from "@esli-cosmetics/ui";
import { useCreateTransfer } from "@/hooks/use-stock-transfers";
import { useToast } from "@/hooks/toast/use-toast";
import { LocationSelect } from "@/components/ui/location-select";
import { ProductSelect } from "@/components/ui/product-select";
import { ProductVariantSelect } from "@/components/ui/product-variant-select";
import { NumberInput } from "@/components/ui/number-input";
import { BiPlus, BiTrash } from "react-icons/bi";
import { useEmployees } from "@/hooks/use-employees";
import { useProduct } from "@/hooks/use-products";
import { useStockLevelByLocationAndProduct } from "@/hooks/use-stock-levels";
import { useCurrentUser } from "@/hooks/use-auth";
import { ProductType } from "@esli-cosmetics/types";

const createTransferSchema = (t: (key: string) => string) =>
  z
    .object({
      fromLocationId: z
        .string()
        .min(1, t("transfers.form.fromLocationRequired")),
      toLocationId: z.string().min(1, t("transfers.form.toLocationRequired")),
      senderId: z.string().min(1, t("transfers.form.senderRequired")),
      receiverId: z.string().min(1, t("transfers.form.receiverRequired")),
      items: z
        .array(
          z.object({
            productId: z.string().min(1, t("transfers.form.productRequired")),
            productVariantId: z
              .string()
              .min(1, t("transfers.form.productVariantRequired")),
            quantityRequested: z
              .number()
              .min(1, t("transfers.form.quantityMin")),
          })
        )
        .min(1, t("transfers.form.itemsRequired")),
      note: z.string().min(1, t("transfers.form.noteRequired")),
    })
    .refine(data => data.fromLocationId !== data.toLocationId, {
      message: t("transfers.form.sameLocationError"),
      path: ["toLocationId"],
    })
    .refine(
      data => {
        // Check for duplicate product variants
        const variantIds = data.items
          .map(item => item.productVariantId)
          .filter(id => id && id.trim() !== "");
        const uniqueVariantIds = new Set(variantIds);
        return variantIds.length === uniqueVariantIds.size;
      },
      {
        message: t("transfers.form.duplicateVariantError"),
        path: ["items"],
      }
    );

type TransferFormData = z.infer<ReturnType<typeof createTransferSchema>>;

// Component for variant selection that can use hooks
function VariantSelectField({
  productId,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  productId: string;
  value?: string;
  onChange: (variantId: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const { data: productData } = useProduct(productId || "");
  const variants = productData?.variants || [];

  return (
    <ProductVariantSelect
      variants={variants}
      {...(value ? { value } : {})}
      onChange={onChange}
      {...(placeholder ? { placeholder } : {})}
      disabled={disabled || !productId || variants.length === 0}
      allowNone={true}
    />
  );
}

// Component for item row with stock validation
function TransferItemRow({
  index,
  control,
  watch,
  setValue,
  errors,
  fromLocationId,
  t,
  onStockStatusChange,
  allItems,
}: {
  index: number;
  control: any;
  watch: any;
  setValue: any;
  errors: any;
  fromLocationId: string;
  t: (key: string) => string;
  onStockStatusChange?: (index: number, hasNoStock: boolean) => void;
  allItems?: Array<{ productVariantId?: string }>;
}) {
  const productId = watch(`items.${index}.productId`);
  const productVariantId = watch(`items.${index}.productVariantId`);
  const quantityRequested = watch(`items.${index}.quantityRequested`);

  // Check for duplicate product variants
  const duplicateError = useMemo(() => {
    if (!productVariantId || !allItems) return null;

    const duplicateCount = allItems.filter(
      (item, idx) =>
        item.productVariantId &&
        item.productVariantId === productVariantId &&
        idx !== index
    ).length;

    if (duplicateCount > 0) {
      return t("transfers.form.duplicateVariantError");
    }

    return null;
  }, [productVariantId, allItems, index, t]);

  // Clean up empty strings for the hook
  const cleanVariantId =
    productVariantId && productVariantId.trim() !== ""
      ? productVariantId
      : null;
  const cleanProductId =
    productId && productId.trim() !== "" ? productId : null;

  // Fetch stock level for the fromLocation
  const { data: stockLevel, isLoading: isLoadingStock } =
    useStockLevelByLocationAndProduct(
      fromLocationId && cleanVariantId ? fromLocationId : null,
      cleanVariantId,
      cleanProductId
    );

  // Calculate available stock
  const availableStock = useMemo(() => {
    if (!stockLevel) return 0;
    return Math.max(
      0,
      Number(stockLevel.quantity || 0) - Number(stockLevel.reserved || 0)
    );
  }, [stockLevel]);

  // Update quantity when availableStock is fetched and is less than current quantity
  useEffect(() => {
    if (
      !isLoadingStock &&
      fromLocationId &&
      productVariantId &&
      availableStock > 0
    ) {
      const currentQuantity = quantityRequested || 1;

      // If current quantity exceeds available stock, set it to available stock
      if (currentQuantity > availableStock) {
        setValue(`items.${index}.quantityRequested`, availableStock, {
          shouldValidate: true,
        });
      } else if (currentQuantity < 1) {
        // If current quantity is 0 or less, set it to 1 (minimum)
        setValue(`items.${index}.quantityRequested`, 1, {
          shouldValidate: true,
        });
      }
    }
    // Note: When availableStock is 0, we don't change the quantity value
    // The validation error will prevent submission, and the UI will show the error message
  }, [
    availableStock,
    isLoadingStock,
    fromLocationId,
    productVariantId,
    quantityRequested,
    setValue,
    index,
  ]);

  // Validation messages
  const quantityError = useMemo(() => {
    if (!fromLocationId || !productVariantId) return null;
    if (isLoadingStock) return null;

    if (availableStock === 0) {
      return t("transfers.form.noStockAvailable");
    }

    if (quantityRequested > availableStock) {
      return t("transfers.form.quantityExceedsAvailable").replace(
        "{{available}}",
        availableStock.toString()
      );
    }

    return null;
  }, [
    fromLocationId,
    productVariantId,
    isLoadingStock,
    availableStock,
    quantityRequested,
    t,
  ]);

  // Notify parent about stock status
  useEffect(() => {
    if (onStockStatusChange) {
      const hasNoStock =
        !isLoadingStock &&
        fromLocationId &&
        productVariantId &&
        availableStock === 0;
      onStockStatusChange(index, hasNoStock);
    }
  }, [
    index,
    isLoadingStock,
    fromLocationId,
    productVariantId,
    availableStock,
    onStockStatusChange,
  ]);

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/50">
      <div className="flex items-start justify-between">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("transfers.form.item")} {index + 1}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t("transfers.form.product")} *</Label>
          <Controller
            name={`items.${index}.productId`}
            control={control}
            render={({ field }) => (
              <ProductSelect
                value={field.value}
                onChange={productId => {
                  field.onChange(productId || "");
                  // Reset variant when product changes
                  setValue(`items.${index}.productVariantId`, "");
                }}
                placeholder={t("transfers.form.productPlaceholder")}
                error={errors.items?.[index]?.productId?.message}
                excludeTypes={[ProductType.KIT]}
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>{t("transfers.form.variant")} *</Label>
          <Controller
            name={`items.${index}.productVariantId`}
            control={control}
            render={({ field }) => {
              return (
                <VariantSelectField
                  productId={productId || ""}
                  {...(field.value ? { value: field.value } : {})}
                  onChange={variantId => field.onChange(variantId || "")}
                  placeholder={t("transfers.form.variantPlaceholder")}
                  disabled={!productId}
                />
              );
            }}
          />
          {errors.items?.[index]?.productVariantId && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {errors.items[index]?.productVariantId?.message}
            </p>
          )}
          {duplicateError && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {duplicateError}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("transfers.form.quantity")} *</Label>
        <Controller
          name={`items.${index}.quantityRequested`}
          control={control}
          render={({ field }) => (
            <>
              <NumberInput
                min={1}
                max={availableStock > 0 ? availableStock : 1}
                step="1"
                value={field.value}
                onChange={value => {
                  // Prevent setting value if stock is 0
                  if (availableStock === 0) {
                    // Keep value at 1 (minimum required by schema)
                    // The validation error will show that stock is unavailable
                    return;
                  }
                  // Ensure value is within bounds
                  const roundedValue = Math.round(value);
                  const finalValue = Math.max(
                    1,
                    Math.min(roundedValue, availableStock)
                  );
                  field.onChange(finalValue);
                }}
                className="w-full"
                disabled={
                  !fromLocationId || !productVariantId || availableStock === 0
                }
              />
              {fromLocationId && productVariantId && (
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {isLoadingStock ? (
                    <span className="text-primary-600 dark:text-primary-400">
                      {t("transfers.form.loadingStock")}
                    </span>
                  ) : (
                    <>
                      {t("transfers.form.available")}:{" "}
                      <span
                        className={`font-medium ${
                          availableStock > 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {availableStock.toFixed(0)}
                      </span>
                    </>
                  )}
                </p>
              )}
            </>
          )}
        />
        {errors.items?.[index]?.quantityRequested && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {errors.items[index]?.quantityRequested?.message}
          </p>
        )}
        {quantityError && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {quantityError}
          </p>
        )}
      </div>
    </div>
  );
}

interface CreateTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTransferModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTransferModalProps) {
  const { t } = useTranslation("stock");
  const { toast } = useToast();
  const createTransferMutation = useCreateTransfer();
  const { data: employeesData } = useEmployees({ page: 1, limit: 200 });
  const { data: currentUser } = useCurrentUser();

  // Track items with no stock
  const [itemsWithNoStock, setItemsWithNoStock] = useState<Set<number>>(
    new Set()
  );

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<TransferFormData>({
    resolver: zodResolver(createTransferSchema(t)),
    defaultValues: {
      fromLocationId: "",
      toLocationId: "",
      senderId: "",
      receiverId: "",
      items: [
        {
          productId: "",
          productVariantId: "",
          quantityRequested: 1,
        },
      ],
      note: "",
    },
  });

  const { fields, prepend, remove } = useFieldArray({
    control,
    name: "items",
  });

  const fromLocationId = watch("fromLocationId");
  const toLocationId = watch("toLocationId");
  const allItems = watch("items");

  // Get default receiver and location from current user
  const defaultReceiverId = currentUser?.employee?.id || "";
  const defaultToLocationId = currentUser?.location?.id || "";

  // Check for duplicate product variants
  const hasDuplicateVariants = useMemo(() => {
    if (!allItems || allItems.length < 2) return false;

    const variantIds = allItems
      .map(item => item.productVariantId)
      .filter(id => id && id.trim() !== "");
    const uniqueVariantIds = new Set(variantIds);

    return variantIds.length !== uniqueVariantIds.size;
  }, [allItems]);

  useEffect(() => {
    if (isOpen) {
      // Reset items with no stock tracking
      setItemsWithNoStock(new Set());

      reset({
        fromLocationId: "",
        toLocationId: defaultToLocationId || "",
        senderId: "",
        receiverId: defaultReceiverId || "",
        items: [
          {
            productId: "",
            productVariantId: "",
            quantityRequested: 1,
          },
        ],
        note: "",
      });
    }
  }, [isOpen, reset, defaultReceiverId, defaultToLocationId]);

  // Handle stock status changes from TransferItemRow
  const handleStockStatusChange = useCallback(
    (index: number, hasNoStock: boolean) => {
      setItemsWithNoStock(prev => {
        const newSet = new Set(prev);
        if (hasNoStock) {
          newSet.add(index);
        } else {
          newSet.delete(index);
        }
        return newSet;
      });
    },
    []
  );

  // Only employees linked to a user can be sender/receiver (backend enforces this)
  const employeesWithUser =
    employeesData?.employees?.filter(emp => !!emp.userId || !!emp.user) ?? [];
  const employeeOptions: SearchableSelectOption[] =
    employeesWithUser.map(emp => ({
      value: emp.id,
      label:
        `${emp.person?.firstName || ""} ${emp.person?.lastName || ""}`.trim() ||
        emp.person?.email ||
        "Unknown",
    })) || [];

  const handleAddItem = () => {
    prepend({
      productId: "",
      productVariantId: "",
      quantityRequested: 1,
    });
  };

  const handleRemoveItem = (index: number) => {
    if (fields.length > 1) {
      remove(index);
      // Clean up tracking for removed item
      setItemsWithNoStock(prev => {
        const newSet = new Set<number>();
        prev.forEach(itemIndex => {
          if (itemIndex < index) {
            // Items before removed index stay the same
            newSet.add(itemIndex);
          } else if (itemIndex > index) {
            // Items after removed index shift down by 1
            newSet.add(itemIndex - 1);
          }
          // itemIndex === index is removed, so don't add it
        });
        return newSet;
      });
    }
  };

  const onSubmit = async (data: TransferFormData) => {
    try {
      await createTransferMutation.mutateAsync({
        fromLocationId: data.fromLocationId,
        toLocationId: data.toLocationId,
        ...(data.senderId && { senderId: data.senderId }),
        ...(data.receiverId && { receiverId: data.receiverId }),
        items: data.items.map(item => ({
          productId: item.productId,
          ...(item.productVariantId && {
            productVariantId: item.productVariantId,
          }),
          quantityRequested: item.quantityRequested,
        })),
        ...(data.note && { note: data.note }),
      });

      toast({
        title: t("transfers.toast.success"),
        description:
          t("transfers.toast.created") || "Transfer created successfully",
        type: "success",
      });

      reset();
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        title: t("transfers.toast.error"),
        description:
          error?.message ||
          t("transfers.toast.createFailed") ||
          "Failed to create transfer",
        type: "error",
      });
    }
  };

  const handleClose = () => {
    if (!createTransferMutation.isPending) {
      reset();
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <ModalContent
        size="2xl"
        className="max-h-[90vh] overflow-y-auto sm:max-w-[800px]"
      >
        <ModalHeader>
          <ModalTitle>{t("transfers.page.addButton")}</ModalTitle>
          <ModalDescription>{t("transfers.page.subtitle")}</ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
          {/* Locations */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromLocationId">
                {t("transfers.form.fromLocation")} *
              </Label>
              <Controller
                name="fromLocationId"
                control={control}
                render={({ field }) => (
                  <LocationSelect
                    value={field.value}
                    onChange={locationId => {
                      field.onChange(locationId);
                      setValue("fromLocationId", locationId || "");
                    }}
                    placeholder={t("transfers.form.fromLocationPlaceholder")}
                    error={errors.fromLocationId?.message}
                    excludeLocationId={toLocationId}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toLocationId">
                {t("transfers.form.toLocation")} *
              </Label>
              <Controller
                name="toLocationId"
                control={control}
                render={({ field }) => (
                  <LocationSelect
                    value={field.value}
                    onChange={locationId => {
                      field.onChange(locationId);
                      setValue("toLocationId", locationId || "");
                    }}
                    placeholder={t("transfers.form.toLocationPlaceholder")}
                    error={errors.toLocationId?.message}
                    excludeLocationId={fromLocationId}
                  />
                )}
              />
            </div>
          </div>

          {/* Employees */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senderId">{t("transfers.form.sender")} *</Label>
              <Controller
                name="senderId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={employeeOptions}
                    value={field.value || ""}
                    onValueChange={value => field.onChange(value || undefined)}
                    placeholder={t("transfers.form.senderPlaceholder")}
                    allowSearch={true}
                    showClearButton={true}
                    error={errors.senderId?.message}
                  />
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receiverId">
                {t("transfers.form.receiver")} *
              </Label>
              <Controller
                name="receiverId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    options={employeeOptions}
                    value={field.value || ""}
                    onValueChange={value => field.onChange(value || undefined)}
                    placeholder={t("transfers.form.receiverPlaceholder")}
                    allowSearch={true}
                    showClearButton={true}
                    error={errors.receiverId?.message}
                  />
                )}
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t("transfers.form.items")}</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                leftIcon={<BiPlus className="h-4 w-4" />}
              >
                {t("transfers.form.addItem")}
              </Button>
            </div>

            <div className="max-h-[300px] space-y-3 overflow-y-auto pr-2">
              {fields.map((field, index) => (
                <div key={field.id} className="relative">
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(index)}
                      className="absolute right-2 top-2 z-10 h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                    >
                      <BiTrash className="h-4 w-4" />
                    </Button>
                  )}
                  <TransferItemRow
                    index={index}
                    control={control}
                    watch={watch}
                    setValue={setValue}
                    errors={errors}
                    fromLocationId={fromLocationId}
                    t={t}
                    onStockStatusChange={handleStockStatusChange}
                    allItems={allItems}
                  />
                </div>
              ))}
            </div>

            {errors.items && errors.items.root && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {errors.items.root.message}
              </p>
            )}
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">{t("transfers.form.note")} *</Label>
            <Textarea
              id="note"
              {...register("note")}
              placeholder={t("transfers.form.notePlaceholder")}
              rows={3}
              className={errors.note ? "border-red-500" : ""}
            />
            {errors.note && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {errors.note.message}
              </p>
            )}
          </div>

          <ModalFooter>
            <Button
              type="submit"
              disabled={
                createTransferMutation.isPending ||
                itemsWithNoStock.size > 0 ||
                hasDuplicateVariants
              }
              className="min-w-[140px]"
            >
              {createTransferMutation.isPending
                ? t("transfers.modal.processing")
                : t("transfers.page.addButton")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createTransferMutation.isPending}
            >
              {t("transfers.modal.cancel")}
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

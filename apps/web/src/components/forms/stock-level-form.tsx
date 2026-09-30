"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@/lib/zod-resolver";
import { z } from "zod";
import { useState, useEffect } from "react";
import { Button, Input, Label } from "@esli-cosmetics/ui";
import { StockLevelWithRelations, ProductType } from "@esli-cosmetics/types";
import {
  useCreateStockLevel,
  useUpdateStockLevel,
} from "~/hooks/use-stock-levels";
import { useProducts } from "~/hooks/use-products";
import { useLocations } from "~/hooks/use-locations";

export const stockLevelSchema = z
  .object({
    productVariantId: z.string().optional(),
    productId: z.string().optional(),
    locationId: z.string().min(1, "Location is required"),
    quantity: z.number().min(0, "Quantity must be positive"),
    reserved: z.number().min(0, "Reserved must be positive"),
  })
  .refine(data => data.productVariantId || data.productId, {
    message: "Either product or product variant must be selected",
    path: ["productId"],
  });

type StockLevelFormData = z.infer<typeof stockLevelSchema>;

interface StockLevelFormProps {
  stockLevel?: StockLevelWithRelations | undefined;
  onSuccess?: (action: "create" | "update") => void;
  onCancel?: () => void;
}

export function StockLevelForm({
  stockLevel,
  onSuccess,
  onCancel,
}: StockLevelFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createMutation = useCreateStockLevel();
  const updateMutation = useUpdateStockLevel();

  const { data: productsData } = useProducts({
    page: 1,
    limit: 100,
    excludeTypes: [ProductType.KIT],
  });
  const { data: locationsData } = useLocations({ page: 1, limit: 100 });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<StockLevelFormData>({
    resolver: zodResolver(stockLevelSchema),
    defaultValues: {
      productVariantId: stockLevel?.productVariantId || undefined,
      productId: stockLevel?.productId || undefined,
      locationId: stockLevel?.locationId || "",
      quantity: stockLevel ? Number(stockLevel.quantity) : 0,
      reserved: stockLevel ? Number(stockLevel.reserved) : 0,
    },
  });

  useEffect(() => {
    if (stockLevel) {
      reset({
        productVariantId: stockLevel.productVariantId || undefined,
        productId: stockLevel.productId || undefined,
        locationId: stockLevel.locationId || "",
        quantity: Number(stockLevel.quantity),
        reserved: Number(stockLevel.reserved),
      });
    }
  }, [stockLevel, reset]);

  const onSubmit = async (data: StockLevelFormData) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        ...(data.productVariantId && {
          productVariantId: data.productVariantId,
        }),
        ...(data.productId && { productId: data.productId }),
        locationId: data.locationId,
        quantity: data.quantity,
        reserved: data.reserved,
      };

      if (stockLevel) {
        await updateMutation.mutateAsync({
          id: stockLevel.id,
          data: {
            quantity: data.quantity,
            reserved: data.reserved,
          },
        });
        onSuccess?.("update");
      } else {
        await createMutation.mutateAsync(payload);
        onSuccess?.("create");
      }

      reset();
    } catch (error) {
      console.error("❌ Failed to save stock level:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const products = productsData?.products || [];
  const locations = locationsData?.locations || [];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 gap-6">
        {/* Product Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Stock Level Information
          </h3>

          {/* Product */}
          <div>
            <Label htmlFor="productId">Product *</Label>
            <select
              id="productId"
              {...register("productId")}
              disabled={!!stockLevel}
              className="focus:border-primary active:border-primary dark:focus:border-primary w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-black outline-none transition disabled:cursor-default disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select a product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku || "No SKU"})
                </option>
              ))}
            </select>
            {errors.productId && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.productId.message}
              </p>
            )}
          </div>

          {/* Location */}
          <div>
            <Label htmlFor="locationId">Location *</Label>
            <select
              id="locationId"
              {...register("locationId")}
              disabled={!!stockLevel}
              className="focus:border-primary active:border-primary dark:focus:border-primary w-full rounded-lg border border-gray-200 bg-transparent px-4 py-3 text-black outline-none transition disabled:cursor-default disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">Select a location</option>
              {locations.map(location => (
                <option key={location.id} value={location.id}>
                  {location.name} - {location.locationType}
                </option>
              ))}
            </select>
            {errors.locationId && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.locationId.message}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div>
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              id="quantity"
              type="number"
              step="1"
              min="0"
              onWheel={e => e.currentTarget.blur()}
              onScroll={e => e.currentTarget.blur()}
              {...register("quantity", { valueAsNumber: true })}
              className={errors.quantity ? "border-red-500" : ""}
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.quantity.message}
              </p>
            )}
          </div>

          {/* Reserved */}
          <div>
            <Label htmlFor="reserved">Reserved *</Label>
            <Input
              id="reserved"
              type="number"
              step="1"
              min="0"
              onWheel={e => e.currentTarget.blur()}
              onScroll={e => e.currentTarget.blur()}
              {...register("reserved", { valueAsNumber: true })}
              className={errors.reserved ? "border-red-500" : ""}
            />
            {errors.reserved && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                {errors.reserved.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting
            ? stockLevel
              ? "Updating..."
              : "Creating..."
            : stockLevel
              ? "Update Stock Level"
              : "Create Stock Level"}
        </Button>
      </div>
    </form>
  );
}

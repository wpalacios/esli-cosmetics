import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NotificationService } from "../notifications/notification.service";

interface CheckLowStockParams {
  productVariantId: string;
  locationId: string;
  currentQuantity: number;
}

@Injectable()
export class StockLevelNotificationService {
  private readonly logger = new Logger(StockLevelNotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Check if stock is low and send notifications to relevant users
   * This is the centralized method that should be called whenever stock levels change
   *
   * @param productVariantId - The product variant ID to check
   * @param locationId - The location ID to check
   * @param currentQuantity - The current quantity at this location (optional, will fetch if not provided)
   * @returns Promise<boolean> - Returns true if notification was sent, false otherwise
   */
  async checkAndNotifyLowStock(
    productVariantId: string,
    locationId: string,
    currentQuantity?: number
  ): Promise<boolean> {
    if (!locationId || !productVariantId) {
      return false;
    }

    try {
      // Get the product variant with minimum stock
      const productVariant = await this.prisma.productVariant.findUnique({
        where: { id: productVariantId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!productVariant || !productVariant.minimumStock) {
        return false; // No minimum stock configured, skip check
      }

      // Get current stock level if not provided
      let quantity = currentQuantity;
      if (quantity === undefined) {
        const stockLevel = await this.prisma.stockLevel.findFirst({
          where: {
            productVariantId,
            locationId,
          },
        });

        if (!stockLevel) {
          return false; // No stock level found
        }

        quantity = Number(stockLevel.quantity);
      }

      const minimumStock = productVariant.minimumStock;

      // Check if stock is at or below minimum
      if (quantity <= minimumStock) {
        this.logger.warn(
          `⚠️ Low stock detected: Product Variant ${productVariantId} at location ${locationId}. Current: ${quantity}, Minimum: ${minimumStock}`
        );

        // Get location name
        const location = await this.prisma.location.findUnique({
          where: { id: locationId },
          select: { name: true },
        });

        const productName =
          productVariant.name ||
          productVariant.product?.name ||
          "Producto desconocido";
        const locationName = location?.name || "Ubicación desconocida";
        const variantSku = productVariant.sku || "N/A";

        // Create notifications for admin, store_manager, and inventory_manager
        const skuSuffix = variantSku === "N/A" ? "" : ` (SKU: ${variantSku})`;
        const notificationBody = `${productName}${skuSuffix} está bajo de stock en ${locationName}. Stock actual: ${quantity}, Mínimo: ${minimumStock}`;

        await this.notificationService.createForRoles(
          ["admin", "store_manager", "inventory_manager"],
          {
            channel: "system",
            title: "Inventario bajo",
            body: notificationBody,
            payload: {
              type: "low_stock",
              productVariantId,
              productId: productVariant.productId,
              locationId,
              currentQuantity: quantity,
              minimumStock,
              productName,
              sku: productVariant.sku,
              locationName,
              variantSku,
            },
          }
        );

        return true; // Notification was sent
      }

      return false; // Stock is above minimum, no notification needed
    } catch (error) {
      this.logger.error(
        `❌ Error checking low stock for variant ${productVariantId} at location ${locationId}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't throw - we don't want to fail the operation if notification fails
      return false;
    }
  }

  /**
   * Check multiple stock levels and notify for any that are low
   * Optimized for batch operations - uses batch queries instead of loops
   *
   * @param checks - Array of stock level checks to perform
   * @returns Promise<number> - Number of notifications sent
   */
  async checkAndNotifyMultiple(checks: CheckLowStockParams[]): Promise<number> {
    if (checks.length === 0) {
      return 0;
    }

    try {
      // Extract unique product variant IDs and location IDs
      const productVariantIds = [
        ...new Set(checks.map(check => check.productVariantId)),
      ];
      const locationIds = [...new Set(checks.map(check => check.locationId))];

      // Batch fetch all product variants with their minimum stock
      const productVariants = await this.prisma.productVariant.findMany({
        where: {
          id: { in: productVariantIds },
          minimumStock: { not: null },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      // Create a map for quick lookup
      const productVariantMap = new Map(productVariants.map(pv => [pv.id, pv]));

      // Batch fetch all locations
      const locations = await this.prisma.location.findMany({
        where: {
          id: { in: locationIds },
        },
        select: {
          id: true,
          name: true,
        },
      });

      // Create a map for quick lookup
      const locationMap = new Map(locations.map(loc => [loc.id, loc]));

      // Filter checks that need notifications
      const lowStockItems: Array<{
        productVariant: (typeof productVariants)[0];
        location: (typeof locations)[0];
        quantity: number;
        productVariantId: string;
        locationId: string;
      }> = [];

      for (const check of checks) {
        const productVariant = productVariantMap.get(check.productVariantId);
        if (!productVariant || !productVariant.minimumStock) {
          continue; // Skip if no minimum stock configured
        }

        const quantity = check.currentQuantity;
        const minimumStock = productVariant.minimumStock;

        // Check if stock is at or below minimum
        if (quantity <= minimumStock) {
          const location = locationMap.get(check.locationId);
          if (location) {
            lowStockItems.push({
              productVariant,
              location,
              quantity,
              productVariantId: check.productVariantId,
              locationId: check.locationId,
            });
          }
        }
      }

      if (lowStockItems.length === 0) {
        return 0;
      }

      // Group notifications by product variant to avoid duplicate notifications
      // for the same product variant at different locations
      const notificationMap = new Map<
        string,
        {
          productVariant: (typeof productVariants)[0];
          items: Array<{
            location: (typeof locations)[0];
            quantity: number;
            locationId: string;
          }>;
        }
      >();

      for (const item of lowStockItems) {
        const existing = notificationMap.get(item.productVariantId);
        if (existing) {
          existing.items.push({
            location: item.location,
            quantity: item.quantity,
            locationId: item.locationId,
          });
        } else {
          notificationMap.set(item.productVariantId, {
            productVariant: item.productVariant,
            items: [
              {
                location: item.location,
                quantity: item.quantity,
                locationId: item.locationId,
              },
            ],
          });
        }
      }

      // Prepare all notification data for batch creation
      const notificationsData = Array.from(notificationMap.entries()).flatMap(
        ([productVariantId, { productVariant, items }]) => {
          const minimumStock = productVariant.minimumStock;
          if (!minimumStock) {
            return []; // Skip if no minimum stock configured
          }
          const productName =
            productVariant.name ||
            productVariant.product?.name ||
            "Producto desconocido";
          const variantSku = productVariant.sku || "N/A";
          const skuSuffix = variantSku === "N/A" ? "" : ` (SKU: ${variantSku})`;

          return items.map(item => {
            const locationName = item.location.name || "Ubicación desconocida";

            this.logger.warn(
              `⚠️ Low stock detected: Product Variant ${productVariantId} at location ${item.locationId}. Current: ${item.quantity}, Minimum: ${minimumStock}`
            );

            const notificationBody = `${productName}${skuSuffix} está bajo de stock en ${locationName}. Stock actual: ${item.quantity}, Mínimo: ${minimumStock}`;

            return {
              channel: "inventory" as const,
              title: "Inventario bajo",
              body: notificationBody,
              payload: {
                type: "low_stock",
                productVariantId,
                productId: productVariant.productId,
                locationId: item.locationId,
                currentQuantity: item.quantity,
                sku: productVariant.sku,
                minimumStock,
                productName,
                locationName,
                variantSku,
              },
            };
          });
        }
      );

      // Batch create all notifications in a single operation
      if (notificationsData.length > 0) {
        await this.notificationService.batchCreateForRoles(
          ["admin", "store_manager", "inventory_manager"],
          notificationsData
        );
      }

      return notificationsData.length;
    } catch (error) {
      this.logger.error(
        `❌ Error checking low stock for batch: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      // Don't throw - we don't want to fail the operation if notification fails
      return 0;
    }
  }
}

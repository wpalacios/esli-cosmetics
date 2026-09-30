export interface NotificationPayload {
  type?: string;
  productVariantId?: string;
  productId?: string;
  locationId?: string;
  currentQuantity?: number;
  minimumStock?: number;
  productName?: string;
  locationName?: string;
  variantSku?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LowStockNotificationPayload extends NotificationPayload {
  type: "low_stock";
  productVariantId: string;
  productId: string;
  locationId: string;
  currentQuantity: number;
  minimumStock: number;
  productName: string;
  locationName: string;
  variantSku: string;
}

export interface BroadcastNotificationPayload {
  notification: {
    channel?: string;
    title?: string;
    body?: string;
    payload?: NotificationPayload;
  };
}

export interface UserNotificationPayload {
  notification: {
    id: string;
    userId?: string | null;
    channel?: string | null;
    title?: string | null;
    body?: string | null;
    payload?: NotificationPayload | null;
    read: boolean;
    createdAt: Date;
  };
}

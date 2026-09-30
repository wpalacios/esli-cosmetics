import { UUID, BaseEntity } from "./index";

export interface NotificationPayload {
  type?: string;
  productVariantId?: UUID;
  productId?: UUID;
  locationId?: UUID;
  currentQuantity?: number;
  minimumStock?: number;
  productName?: string;
  locationName?: string;
  variantSku?: string;
  [key: string]: string | number | UUID | boolean | undefined;
}

export interface Notification extends BaseEntity {
  userId?: UUID | null;
  channel?: string | null;
  title?: string | null;
  body?: string | null;
  payload?: NotificationPayload | null;
  read: boolean;
  createdAt: string;
}

export interface CreateNotificationRequest {
  userId?: UUID;
  channel?: string;
  title?: string;
  body?: string;
  payload?: NotificationPayload;
  read?: boolean;
}

export interface UpdateNotificationRequest {
  read?: boolean;
}

export interface NotificationsResponse {
  data: Notification[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface UnreadCountResponse {
  count: number;
}

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { Prisma, Notification } from "@prisma/client";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { NotificationDto } from "./dto/notification.dto";
import { PaginatedNotificationDto } from "./dto/paginated-notification.dto";
import { NotificationPayload } from "./types/notification-payload.types";

/** DB column limit for notifications.channel/title/body (VarChar(255)). */
const NOTIFICATION_TEXT_MAX_LENGTH = 255;

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Truncate a value to fit the notification VarChar(255) columns. Prevents
   * "value too long for the column's type" errors when product/location names
   * make the generated body exceed the limit.
   */
  private clampText<T extends string | null | undefined>(value: T): T {
    if (
      typeof value !== "string" ||
      value.length <= NOTIFICATION_TEXT_MAX_LENGTH
    ) {
      return value;
    }
    return value.slice(0, NOTIFICATION_TEXT_MAX_LENGTH) as T;
  }

  private mapToDto(n: Notification): NotificationDto {
    return {
      id: n.id,
      userId: n.userId,
      channel: n.channel,
      title: n.title,
      body: n.body,
      payload: n.payload as NotificationPayload | null,
      read: n.read,
      createdAt: n.createdAt,
    };
  }

  async create(createDto: CreateNotificationDto): Promise<NotificationDto> {
    this.logger.log(
      `📝 Creating notification for user: ${createDto.userId || "GLOBAL"} | Channel: ${createDto.channel}`
    );

    const notification = await this.prisma.notification.create({
      data: {
        userId: createDto.userId,
        channel: this.clampText(createDto.channel || "system"),
        title: this.clampText(createDto.title),
        body: this.clampText(createDto.body),
        payload: createDto.payload ?? Prisma.JsonNull,
        read: createDto.read ?? false,
      },
    });

    this.logger.log(`✅ Notification saved to DB with ID: ${notification.id}`);

    // Note: Real-time notifications are handled by Supabase on the frontend
    // The frontend will listen to Supabase channels for new notifications

    return this.mapToDto(notification);
  }

  /**
   * Get user IDs by role keys
   */
  async getUserIdsByRoles(roleKeys: string[]): Promise<string[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        isDeleted: false,
        userRoles: {
          some: {
            isDeleted: false,
            role: {
              key: {
                in: roleKeys,
              },
              isDeleted: false,
            },
          },
        },
      },
      select: {
        id: true,
      },
    });

    return users.map(user => user.id);
  }

  /**
   * Batch create multiple notifications for users with specific roles
   * Optimized version that creates all notifications in a single batch operation
   *
   * @param roleKeys - Array of role keys to send notifications to
   * @param notificationsData - Array of notification data (each can have different body/payload)
   * @returns Promise<NotificationDto[]> - Array of created notifications
   */
  async batchCreateForRoles(
    roleKeys: string[],
    notificationsData: Array<Omit<CreateNotificationDto, "userId">>
  ): Promise<NotificationDto[]> {
    if (notificationsData.length === 0) {
      return [];
    }

    this.logger.log(
      `📝 Batch creating ${notificationsData.length} notifications for roles: ${roleKeys.join(", ")}`
    );

    // Get user IDs once for all notifications
    const userIds = await this.getUserIdsByRoles(roleKeys);
    if (userIds.length === 0) {
      this.logger.warn(`No users found with roles: ${roleKeys.join(", ")}`);
      return [];
    }

    // Prepare all notification data for batch insert
    const notificationData = notificationsData.flatMap(notificationDto =>
      userIds.map(userId => ({
        userId,
        channel: this.clampText(notificationDto.channel || "system"),
        title: this.clampText(notificationDto.title),
        body: this.clampText(notificationDto.body),
        payload: notificationDto.payload ?? Prisma.JsonNull,
        read: false,
      }))
    );

    // Single-statement bulk insert. We intentionally avoid wrapping this in an
    // interactive $transaction + re-fetch: createMany is already atomic, the
    // re-query was slow (large IN clauses) and held a pooled connection long
    // enough to time out under load, which starved the Prisma connection pool.
    // Callers only use the count, and delivery is handled by Supabase realtime.
    const { count } = await this.prisma.notification.createMany({
      data: notificationData,
    });

    this.logger.log(`✅ Batch created ${count} notifications`);

    return [];
  }

  /**
   * Create notifications for users with specific roles
   */
  async createForRoles(
    roleKeys: string[],
    createDto: Omit<CreateNotificationDto, "userId">
  ): Promise<NotificationDto[]> {
    this.logger.log(
      `📝 Creating notifications for roles: ${roleKeys.join(", ")} | Channel: ${createDto.channel}`
    );

    const userIds = await this.getUserIdsByRoles(roleKeys);
    this.logger.log(
      `Found ${userIds.length} users with roles: ${roleKeys.join(", ")}`
    );

    if (userIds.length === 0) {
      this.logger.warn(`No users found with roles: ${roleKeys.join(", ")}`);
      return [];
    }

    // Batch create notifications using createMany for better performance
    const channel = this.clampText(createDto.channel || "system");
    const payload = createDto.payload ?? Prisma.JsonNull;
    const title = this.clampText(createDto.title);
    const body = this.clampText(createDto.body);

    // Single-statement bulk insert (createMany is atomic on its own). We avoid
    // the previous $transaction + re-fetch, which held a pooled connection
    // longer than necessary and contributed to connection-pool exhaustion.
    // Callers ignore the return; delivery is handled by Supabase realtime.
    const { count } = await this.prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        channel,
        title,
        body,
        payload,
        read: false,
      })),
    });

    this.logger.log(`✅ Created ${count} notifications`);

    return [];
  }

  async findAll(
    page = 1,
    limit = 10,
    filters?: { channel?: string; read?: boolean }
  ): Promise<PaginatedNotificationDto> {
    this.logger.log(
      `🔍 Finding all notifications. Page: ${page}, Limit: ${limit}, Filters: ${JSON.stringify(filters)}`
    );

    const skip = (page - 1) * limit;
    const where: Prisma.NotificationWhereInput = {};

    if (filters?.channel) where.channel = filters.channel;
    if (filters?.read !== undefined) where.read = filters.read;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notification.count({ where }),
    ]);

    this.logger.log(
      `✅ Found ${notifications.length} notifications (Total: ${total})`
    );

    return {
      data: notifications.map(n => this.mapToDto(n)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findByUser(
    userId: string,
    page = 1,
    limit = 10,
    filters?: { channel?: string; read?: boolean; search?: string }
  ): Promise<PaginatedNotificationDto> {
    this.logger.log(`👤 Finding notifications for user: ${userId}`);

    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      OR: [{ userId: userId }, { userId: null }],
    };

    if (filters?.channel) where.channel = filters.channel;
    if (filters?.read !== undefined) where.read = filters.read;
    if (filters?.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: filters.search, mode: "insensitive" } },
            { body: { contains: filters.search, mode: "insensitive" } },
          ],
        },
      ];
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications.map(n => this.mapToDto(n)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async countUnreadByUser(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        OR: [{ userId }, { userId: null }],
        read: false,
      },
    });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationDto> {
    this.logger.log(` User ${userId} marking notification ${id} as read...`);

    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      this.logger.warn(`❌ Notification ${id} not found`);
      throw new NotFoundException("Notification not found");
    }

    if (notification.userId && notification.userId !== userId) {
      this.logger.warn(
        `⛔ Forbidden access by user ${userId} on notification ${id}`
      );
      throw new ForbiddenException("Not your notification");
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    this.logger.log(`✅ Notification ${id} marked as read`);
    return this.mapToDto(updated);
  }

  async markAllAsRead(userId: string): Promise<number> {
    this.logger.log(` Marking ALL notifications as read for user ${userId}`);

    const { count } = await this.prisma.notification.updateMany({
      where: {
        OR: [{ userId }, { userId: null }],
        read: false,
      },
      data: { read: true },
    });

    this.logger.log(`✅ ${count} notifications marked as read`);
    return count;
  }
}

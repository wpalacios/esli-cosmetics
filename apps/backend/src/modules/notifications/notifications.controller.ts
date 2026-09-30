import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { NotificationService } from "./notification.service";
import { CreateNotificationDto } from "./dto/create-notification.dto";
import { PaginatedNotificationDto } from "./dto/paginated-notification.dto";
import { NotificationDto } from "./dto/notification.dto";
import { HybridAuthGuard } from "../auth/guards/hybrid-auth.guard";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(HybridAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: "Get all notifications (paginated)" })
  @ApiResponse({
    status: 200,
    description: "Returns paginated notifications",
    type: PaginatedNotificationDto,
  })
  async findAll(
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("channel") channel?: string,
    @Query("read") read?: string
  ): Promise<PaginatedNotificationDto> {
    let readFilter: boolean | undefined;
    if (read === "true") {
      readFilter = true;
    } else if (read === "false") {
      readFilter = false;
    }

    return this.notificationService.findAll(
      page ? Number.parseInt(page, 10) : 1,
      limit ? Number.parseInt(limit, 10) : 10,
      {
        channel,
        read: readFilter,
      }
    );
  }

  @Get("me")
  @ApiOperation({ summary: "Get current user's notifications" })
  @ApiResponse({
    status: 200,
    description: "Returns user's notifications",
    type: PaginatedNotificationDto,
  })
  async findMyNotifications(
    @Request() req: AuthenticatedRequest,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
    @Query("channel") channel?: string,
    @Query("read") read?: string,
    @Query("search") search?: string
  ): Promise<PaginatedNotificationDto> {
    const userId = req.user.id;
    let readFilter: boolean | undefined;
    if (read === "true") {
      readFilter = true;
    } else if (read === "false") {
      readFilter = false;
    }

    return this.notificationService.findByUser(
      userId,
      page ? Number.parseInt(page, 10) : 1,
      limit ? Number.parseInt(limit, 10) : 10,
      {
        channel,
        read: readFilter,
        search,
      }
    );
  }

  @Get("unread-count")
  @ApiOperation({
    summary: "Get count of unread notifications for current user",
  })
  @ApiResponse({
    status: 200,
    description: "Returns unread count",
    schema: {
      type: "object",
      properties: {
        count: { type: "number" },
      },
    },
  })
  async getUnreadCount(
    @Request() req: AuthenticatedRequest
  ): Promise<{ count: number }> {
    const userId = req.user.id;
    const count = await this.notificationService.countUnreadByUser(userId);
    return { count };
  }

  @Post()
  @ApiOperation({ summary: "Create a notification" })
  @ApiResponse({
    status: 201,
    description: "Notification created",
    type: NotificationDto,
  })
  async create(
    @Body() createDto: CreateNotificationDto
  ): Promise<NotificationDto> {
    return this.notificationService.create(createDto);
  }

  @Patch(":id/read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark notification as read" })
  @ApiResponse({
    status: 200,
    description: "Notification marked as read",
    type: NotificationDto,
  })
  async markAsRead(
    @Param("id") id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<NotificationDto> {
    const userId = req.user.id;

    return this.notificationService.markAsRead(id, userId);
  }

  @Patch("mark-all-read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark all notifications as read for current user" })
  @ApiResponse({
    status: 200,
    description: "All notifications marked as read",
    schema: {
      type: "object",
      properties: {
        count: { type: "number" },
      },
    },
  })
  async markAllAsRead(
    @Request() req: AuthenticatedRequest
  ): Promise<{ count: number }> {
    const userId = req.user.id;

    const count = await this.notificationService.markAllAsRead(userId);
    return { count };
  }
}

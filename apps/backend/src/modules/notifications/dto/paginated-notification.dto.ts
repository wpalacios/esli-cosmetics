import { ApiProperty } from "@nestjs/swagger";
import { NotificationDto } from "./notification.dto";

export class PaginatedNotificationDto {
  @ApiProperty({ type: [NotificationDto] })
  data: NotificationDto[];

  @ApiProperty({
    type: "object",
    properties: {
      page: { type: "number", example: 1 },
      limit: { type: "number", example: 10 },
      total: { type: "number", example: 100 },
      totalPages: { type: "number", example: 10 },
      hasNext: { type: "boolean", example: true },
      hasPrev: { type: "boolean", example: false },
    },
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

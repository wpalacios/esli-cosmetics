import { ApiProperty } from "@nestjs/swagger";
import { NotificationPayload } from "../types/notification-payload.types";

export class NotificationDto {
  @ApiProperty({
    description: "Notification ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "User ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  userId?: string;

  @ApiProperty({
    description: "Channel",
    example: "inventory",
    required: false,
  })
  channel?: string;

  @ApiProperty({
    description: "Title",
    example: "Inventario bajo",
    required: false,
  })
  title?: string;

  @ApiProperty({
    description: "Body",
    example: "El producto X está bajo de stock",
    required: false,
  })
  body?: string;

  @ApiProperty({
    description: "Payload",
    example: { productId: "...", current: 2, min: 5 },
    required: false,
    type: Object,
  })
  payload?: NotificationPayload | null;

  @ApiProperty({ description: "Read status", example: false })
  read: boolean;

  @ApiProperty({
    description: "Created at",
    example: "2024-06-01T12:00:00.000Z",
  })
  createdAt: Date;
}

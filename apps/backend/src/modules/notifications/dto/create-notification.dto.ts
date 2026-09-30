import { ApiProperty } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsUUID,
  IsBoolean,
  IsObject,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { NotificationPayload } from "../types/notification-payload.types";

export class CreateNotificationDto {
  @ApiProperty({
    description: "User ID (recipient)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({
    description: "Notification channel (e.g. inventory, system, etc.)",
    example: "inventory",
    required: false,
  })
  @IsOptional()
  @IsString()
  channel?: string;

  @ApiProperty({
    description: "Notification title",
    example: "Inventario bajo",
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    description: "Notification body/message",
    example: "El producto X está bajo de stock",
    required: false,
  })
  @IsOptional()
  @IsString()
  body?: string;

  @ApiProperty({
    description: "Payload (extra data, JSON)",
    example: { productId: "...", current: 2, min: 5 },
    required: false,
    type: Object,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  payload?: NotificationPayload;

  @ApiProperty({
    description: "Read status",
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}

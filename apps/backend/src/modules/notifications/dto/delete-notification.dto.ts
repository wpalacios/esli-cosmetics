import { ApiProperty } from "@nestjs/swagger";

export class DeleteNotificationDto {
  @ApiProperty({
    description: "Notification ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({ description: "Success", example: true })
  success: boolean;

  @ApiProperty({ description: "Message", example: "Notification deleted" })
  message: string;
}

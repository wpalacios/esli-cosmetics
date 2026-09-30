import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsBoolean } from "class-validator";

export class UpdateNotificationDto {
  @ApiProperty({
    description: "Read status",
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  read?: boolean;
}

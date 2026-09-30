import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, MaxLength, Matches } from "class-validator";
import { Transform } from "class-transformer";
import { sanitizeString } from "../../../common/utils/sanitize.util";

export class CheckPermissionDto {
  @ApiProperty({
    description: "Permission key to check",
    example: "cash_registers.view",
  })
  @IsString({ message: "Permission must be a string" })
  @IsNotEmpty({ message: "Permission is required" })
  @MaxLength(100, { message: "Permission key must not exceed 100 characters" })
  @Matches(/^[a-z0-9._-]+$/, {
    message:
      "Permission key can only contain lowercase letters, numbers, dots, underscores, and hyphens",
  })
  @Transform(({ value }) => sanitizeString(value))
  permission: string;
}

export class CheckPermissionResponseDto {
  @ApiProperty({ description: "Whether the user has the permission" })
  hasPermission: boolean;
}

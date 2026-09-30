import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { TransferStatus } from "@prisma/client";

export class UpdateTransferStatusDto {
  @ApiProperty({
    description: "New status",
    enum: TransferStatus,
    example: TransferStatus.ACCEPTED,
  })
  @IsEnum(TransferStatus)
  status: TransferStatus;

  @ApiPropertyOptional({
    description: "Note for status change (required for discrepancies)",
    example: "Transfer accepted and ready for dispatch",
  })
  @IsOptional()
  @IsString()
  note?: string;
}

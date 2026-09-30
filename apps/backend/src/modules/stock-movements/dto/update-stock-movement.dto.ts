import { IsOptional, IsString } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateStockMovementDto {
  @ApiPropertyOptional({
    description: "Reference number or code",
    example: "PO-2024-001",
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({
    description: "Additional notes",
    example: "Updated: Restocking from supplier",
  })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({
    description: "Additional metadata",
    example: { reason: "damage", approved: true },
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

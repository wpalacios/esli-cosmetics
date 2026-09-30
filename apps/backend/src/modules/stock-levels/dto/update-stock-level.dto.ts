import { IsOptional, IsNumber, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";

export class UpdateStockLevelDto {
  @ApiPropertyOptional({
    description: "Quantity in stock",
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity?: number;

  @ApiPropertyOptional({
    description: "Reserved quantity",
    example: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reserved?: number;
}

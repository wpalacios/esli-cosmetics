import { IsNotEmpty, IsString, IsOptional, IsUUID } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateWarehouseDto {
  @ApiProperty({
    description: "Warehouse name",
    example: "Main Warehouse",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: "Branch ID this warehouse belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiPropertyOptional({
    description: "Warehouse address",
    example: "456 Industrial Ave, Warehouse District",
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: "Warehouse contact information",
    example: "warehouse@eslicosmetics.com",
  })
  @IsString()
  @IsOptional()
  contact?: string;
}

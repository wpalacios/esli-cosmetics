import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  IsString,
} from "class-validator";
import { Type } from "class-transformer";

export class DispatchItemDto {
  @ApiProperty({
    description: "Transfer item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  itemId: string;

  @ApiProperty({
    description: "Quantity actually sent (can be less than requested)",
    example: 15,
  })
  @IsNumber()
  @Min(0)
  quantitySent: number;
}

export class DispatchTransferDto {
  @ApiProperty({
    description: "Items with quantities sent",
    type: [DispatchItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispatchItemDto)
  items: DispatchItemDto[];

  @ApiPropertyOptional({
    description: "Note for dispatch",
    example: "All items packed and ready for shipment",
  })
  @IsOptional()
  @IsString()
  note?: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  ValidateNested,
  IsUUID,
  IsNumber,
  Min,
  IsOptional,
  IsString,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";

export enum DiscrepancyType {
  DAMAGE = "DAMAGE",
  NOT_RECEIVED = "NOT_RECEIVED",
}

export class ReceiveItemDto {
  @ApiProperty({
    description: "Transfer item ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  itemId: string;

  @ApiProperty({
    description: "Quantity actually received",
    example: 10,
  })
  @IsNumber()
  @Min(0)
  quantityReceived: number;

  @ApiPropertyOptional({
    description: "Discrepancy type if quantity differs from sent",
    enum: DiscrepancyType,
    example: DiscrepancyType.DAMAGE,
  })
  @IsOptional()
  @IsEnum(DiscrepancyType)
  discrepancyType?: DiscrepancyType;
}

export class ReceiveTransferDto {
  @ApiProperty({
    description: "Items with quantities received",
    type: [ReceiveItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];

  @ApiPropertyOptional({
    description: "Note for receiving (required if discrepancies exist)",
    example: "Received with 5 damaged items",
  })
  @IsOptional()
  @IsString()
  note?: string;
}

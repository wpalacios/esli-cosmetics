import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsOptional,
} from "class-validator";
import { Type } from "class-transformer";

export class CreateTransferItemDto {
  @ApiProperty({
    description: "Product ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: "Product variant ID (optional for standard products)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  productVariantId?: string;

  @ApiProperty({
    description: "Quantity requested",
    example: 10,
  })
  @IsNumber()
  @Min(0.01)
  quantityRequested: number;
}

export class CreateTransferDto {
  @ApiProperty({
    description: "Source location ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  fromLocationId: string;

  @ApiProperty({
    description: "Destination location ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  toLocationId: string;

  @ApiPropertyOptional({
    description: "Assigned sender ID (user who will dispatch)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  senderId?: string;

  @ApiPropertyOptional({
    description: "Assigned receiver ID (user who will receive)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  receiverId?: string;

  @ApiProperty({
    description: "Transfer items",
    type: [CreateTransferItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransferItemDto)
  items: CreateTransferItemDto[];

  @ApiProperty({
    description: "Optional note for the transfer request",
    example: "Urgent restock for new store opening",
  })
  @IsString()
  note: string;
}

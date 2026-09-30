import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";

export class CreateQuoteItemDto {
  @ApiProperty({
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  productVariantId: string;

  @ApiProperty({
    description: "Price type ID (identifies which price type was selected)",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  priceTypeId?: string;

  @ApiProperty({
    description: "Quantity",
    example: 2,
  })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({
    description: "Unit price",
    example: 25.99,
  })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiProperty({
    description: "Discount amount for this item",
    example: 2.5,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}

export class CreateQuoteDto {
  @ApiProperty({
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({
    description: "Branch ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    description: "Location ID (store/warehouse)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  locationId: string;

  @ApiProperty({
    description: "Seller (employee) ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  sellerId: string;

  @ApiProperty({
    description: "Cashier (employee) ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  cashierId: string;

  @ApiProperty({
    description: "Discount code ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
    required: false,
  })
  @IsOptional()
  @IsUUID()
  discountCodeId?: string;

  @ApiProperty({
    description: "Discount code calculated value (actual discount amount)",
    example: 5.85,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountCodeValue?: number;

  @ApiProperty({
    description: "Manual order discount amount",
    example: 10.0,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  manualDiscount?: number;

  @ApiProperty({
    description: "Total of all item-level discounts",
    example: 3.9,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  itemsDiscountTotal?: number;

  @ApiProperty({
    description: "Total discount amount (sum of all discounts)",
    example: 19.75,
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiProperty({
    description: "Include tax in total",
    example: true,
    default: true,
  })
  @IsBoolean()
  includeTax: boolean = true;

  @ApiProperty({
    description: "Quote status",
    example: "DRAFT",
    enum: ["DRAFT", "APPROVED", "EXPIRED", "CONVERTED", "ANNULLED"],
    default: "DRAFT",
  })
  @IsOptional()
  @IsEnum(["DRAFT", "APPROVED", "EXPIRED", "CONVERTED", "ANNULLED"])
  status?: "DRAFT" | "APPROVED" | "EXPIRED" | "CONVERTED" | "ANNULLED";

  @ApiProperty({
    description: "Valid until date",
    example: "2024-12-31T23:59:59Z",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiProperty({
    description: "Quote items",
    type: [CreateQuoteItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteItemDto)
  items: CreateQuoteItemDto[];

  @ApiProperty({
    description: "Additional metadata for the quote",
    required: false,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

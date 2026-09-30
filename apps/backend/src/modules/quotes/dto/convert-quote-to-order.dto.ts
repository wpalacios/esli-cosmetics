import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum,
  IsDateString,
  IsBoolean,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import { ProductType } from "@prisma/client";

export class KitItemDto {
  @ApiProperty({ description: "Product variant ID of the component" })
  @IsUUID()
  productVariantId: string;

  @ApiProperty({ description: "Quantity of this component in the kit" })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class ConvertQuoteToOrderItemDto {
  @ApiProperty({ description: "Product variant ID" })
  @IsUUID()
  productVariantId: string;

  @ApiProperty({ description: "Quantity to order" })
  @IsNumber()
  @Min(1)
  quantity: number;

  @ApiProperty({ description: "Unit price at time of conversion" })
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({
    description: "Discount amount for this specific line",
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @ApiPropertyOptional({ enum: ProductType, description: "Standard or Kit" })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({
    type: [KitItemDto],
    description: "Components if it is a kit",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KitItemDto)
  kitItems?: KitItemDto[];

  @ApiPropertyOptional({ description: "Specific price type selected" })
  @IsOptional()
  @IsUUID()
  priceTypeId?: string;

  @ApiPropertyOptional({ description: "Traceability metadata" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class CreatePaymentDto {
  @ApiProperty({
    description: "Payment type",
    example: "CASH",
    enum: ["CASH", "CARD", "TRANSFER"],
  })
  @IsString()
  paymentType: string;

  @ApiPropertyOptional({ description: "Payment provider", example: "VISA" })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({ description: "Payment amount", example: 100.0 })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({ description: "Reference number", example: "TXN123" })
  @IsOptional()
  @IsString()
  transactionReference?: string;
}

export class ConvertQuoteToOrderDto {
  @ApiPropertyOptional({ description: "Cash session ID for cashier" })
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ApiPropertyOptional({
    description: "Final payment method",
    enum: ["CASH", "CREDIT"],
    default: "CASH",
  })
  @IsEnum(["CASH", "CREDIT"])
  @IsOptional()
  paymentMethod?: "CASH" | "CREDIT";

  @ApiProperty({
    description: "List of payments made",
    type: [CreatePaymentDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentDto)
  payments: CreatePaymentDto[];

  @ApiPropertyOptional({
    enum: ["SHORT_TERM", "EMPLOYEE_CREDIT", "PROMOTIONAL"],
  })
  @IsOptional()
  @IsEnum(["SHORT_TERM", "EMPLOYEE_CREDIT", "PROMOTIONAL"])
  creditType?: "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL";

  @ApiPropertyOptional({ enum: ["WEEKLY", "BI_WEEKLY", "MONTHLY"] })
  @IsOptional()
  @IsEnum(["WEEKLY", "BI_WEEKLY", "MONTHLY"])
  paymentFrequency?: "WEEKLY" | "BI_WEEKLY" | "MONTHLY";

  @ApiPropertyOptional({ description: "Total credit duration" })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional({ description: "Date of first payment" })
  @IsOptional()
  @IsDateString()
  firstDueDate?: string;

  @ApiPropertyOptional({ description: "Down payment amount" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPayment?: number;

  @ApiPropertyOptional({
    description: "Updated items with Kit support",
    type: [ConvertQuoteToOrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConvertQuoteToOrderItemDto)
  items?: ConvertQuoteToOrderItemDto[];

  @ApiPropertyOptional({ description: "Override discount code value" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountCodeValue?: number;

  @ApiPropertyOptional({ description: "Override manual discount" })
  @IsOptional()
  @IsNumber()
  @Min(0)
  manualDiscount?: number;

  @ApiPropertyOptional({ description: "Override tax inclusion" })
  @IsOptional()
  @IsBoolean()
  includeTax?: boolean;
}

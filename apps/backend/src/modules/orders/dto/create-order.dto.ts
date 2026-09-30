import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import { ProductType } from "@prisma/client";
import { ProductKitItemDto } from "../../products/dto/create-product.dto";

export class CreateOrderItemDto {
  @ApiProperty({
    description: "Product variant ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  productVariantId: string;

  @ApiPropertyOptional({
    description: "Price type ID (identifies which price type was selected)",
    example: "123e4567-e89b-12d3-a456-426614174000",
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

  @ApiPropertyOptional({
    description: "Discount amount for this item",
    example: 2.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  // --- KIT LOGIC (From Local) ---
  @ApiPropertyOptional({
    description: "Product type (Standard or Kit)",
    enum: ProductType,
  })
  @IsOptional()
  @IsEnum(ProductType)
  type?: ProductType;

  @ApiPropertyOptional({
    description: "Decomposed items if this product is a Kit",
    type: [ProductKitItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductKitItemDto)
  kitItems?: ProductKitItemDto[];

  @ApiPropertyOptional({
    description: "Additional metadata for traceability (e.g., fromQuoteId)",
  })
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

  @ApiPropertyOptional({
    description: "Payment provider (for cards)",
    example: "VISA",
  })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiProperty({
    description: "Payment amount",
    example: 100.0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiPropertyOptional({
    description: "Transaction reference",
    example: "TXN123456",
  })
  @IsOptional()
  @IsString()
  transactionReference?: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional({
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({
    description: "Branch ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
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

  @ApiPropertyOptional({
    description: "Seller (employee) ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @ApiProperty({
    description: "Cashier (employee) ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  cashierId: string;

  @ApiPropertyOptional({
    description: "Cash session ID (required for cash payments)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ApiPropertyOptional({
    description: "Discount code ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsUUID()
  discountCodeId?: string;

  @ApiPropertyOptional({
    description: "Discount code calculated value (actual discount amount)",
    example: 5.85,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountCodeValue?: number;

  @ApiPropertyOptional({
    description: "Manual order discount amount",
    example: 10.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  manualDiscount?: number;

  @ApiPropertyOptional({
    description: "Total of all item-level discounts",
    example: 3.9,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  itemsDiscountTotal?: number;

  @ApiPropertyOptional({
    description: "Total discount amount (sum of all discounts)",
    example: 19.75,
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
    description: "Order items",
    type: [CreateOrderItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiProperty({
    description: "Payments",
    type: [CreatePaymentDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePaymentDto)
  payments: CreatePaymentDto[];

  @ApiPropertyOptional({
    description: "Payment method for the order",
    example: "CASH",
    enum: ["CASH", "CREDIT"],
    default: "CASH",
  })
  @IsEnum(["CASH", "CREDIT"])
  @IsOptional()
  paymentMethod?: "CASH" | "CREDIT";

  // Credit-related fields (only used when paymentMethod is CREDIT)
  @ApiPropertyOptional({
    description: "Credit type",
    example: "SHORT_TERM",
    enum: ["SHORT_TERM", "EMPLOYEE_CREDIT", "PROMOTIONAL"],
  })
  @IsOptional()
  @IsEnum(["SHORT_TERM", "EMPLOYEE_CREDIT", "PROMOTIONAL"])
  creditType?: "SHORT_TERM" | "EMPLOYEE_CREDIT" | "PROMOTIONAL";

  @ApiPropertyOptional({
    description: "Payment frequency for credit installments",
    example: "WEEKLY",
    enum: ["WEEKLY", "BI_WEEKLY", "MONTHLY"],
  })
  @IsOptional()
  @IsEnum(["WEEKLY", "BI_WEEKLY", "MONTHLY"])
  paymentFrequency?: "WEEKLY" | "BI_WEEKLY" | "MONTHLY";

  @ApiPropertyOptional({
    description: "Duration in days for credit",
    example: 30,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional({
    description: "First due date for credit installments",
    example: "2024-01-15T00:00:00Z",
  })
  @IsOptional()
  @IsDateString()
  firstDueDate?: string;

  @ApiPropertyOptional({
    description: "Initial payment (down payment) for credit order",
    example: 100.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  initialPayment?: number;

  @ApiPropertyOptional({
    description:
      "Quote total amount (used when converting from quote to honor locked-in price)",
    example: 4412.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quoteTotalAmount?: number;

  @ApiPropertyOptional({
    description:
      "Additional metadata for internal logic (e.g., consumeReservation flag)",
    example: { consumeReservation: true, fromQuoteId: "uuid" },
  })
  @IsOptional()
  @IsObject()
  metadata?: {
    fromQuoteId?: string;
    quoteWasApproved?: boolean;
    consumeReservation?: boolean;
    /** Set when a PENDING credit order releases quote reservation at convert time */
    quoteReservationReleasedOnConvert?: boolean;
    [key: string]: any;
  };
}

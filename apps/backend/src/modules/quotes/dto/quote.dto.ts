import { ApiProperty } from "@nestjs/swagger";

export class QuoteItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  quoteId: string;

  @ApiProperty({ required: false })
  productId?: string;

  @ApiProperty({ required: false })
  productVariantId?: string;

  @ApiProperty({ required: false })
  priceTypeId?: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty({ required: false })
  discountAmount?: number;

  @ApiProperty({ required: false })
  taxAmount?: number;

  @ApiProperty()
  lineTotal: number;

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty({ required: false })
  product?: any;

  @ApiProperty({ required: false })
  productVariant?: any;
}

export class QuoteDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ required: false })
  quoteNumber?: string;

  @ApiProperty({ required: false })
  customerId?: string;

  @ApiProperty({ required: false })
  branchId?: string;

  @ApiProperty({ required: false })
  locationId?: string;

  @ApiProperty({ required: false })
  sellerId?: string;

  @ApiProperty({ required: false })
  cashierId?: string;

  @ApiProperty({ required: false })
  createdBy?: string;

  @ApiProperty({ required: false })
  approvedBy?: string;

  @ApiProperty({ required: false })
  annulledBy?: string;

  @ApiProperty({
    enum: ["DRAFT", "APPROVED", "EXPIRED", "CONVERTED", "ANNULLED"],
  })
  status: "DRAFT" | "APPROVED" | "EXPIRED" | "CONVERTED" | "ANNULLED";

  @ApiProperty({ required: false })
  validUntil?: Date;

  @ApiProperty({ required: false })
  approvedAt?: Date;

  @ApiProperty({ required: false })
  annulledAt?: Date;

  @ApiProperty({ required: false })
  discountCodeId?: string;

  @ApiProperty({ required: false })
  discountCodeValue?: number;

  @ApiProperty({ required: false })
  manualDiscount?: number;

  @ApiProperty({ required: false })
  itemsDiscountTotal?: number;

  @ApiProperty({ required: false })
  discountAmount?: number;

  @ApiProperty({ required: false })
  subtotal?: number;

  @ApiProperty({ required: false })
  taxes?: number;

  @ApiProperty({ required: false })
  totalAmount?: number;

  @ApiProperty()
  includeTax: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty({ required: false, isArray: true, type: QuoteItemDto })
  items?: QuoteItemDto[];

  @ApiProperty({ required: false })
  customer?: any;

  @ApiProperty({ required: false })
  seller?: any;

  @ApiProperty({ required: false })
  cashier?: any;

  @ApiProperty({ required: false })
  location?: any;

  @ApiProperty({ required: false })
  branch?: any;

  @ApiProperty({ required: false })
  creator?: any;

  @ApiProperty({ required: false })
  discountCode?: any;

  @ApiProperty({ required: false })
  orderId?: string;
}

export class PaginatedQuotesDto {
  @ApiProperty({ type: [QuoteDto] })
  data: QuoteDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}

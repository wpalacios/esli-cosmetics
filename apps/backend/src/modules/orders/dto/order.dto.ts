import { ApiProperty } from "@nestjs/swagger";

export class OrderDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  orderNumber: string;

  @ApiProperty({ required: false })
  customerId?: string;

  @ApiProperty()
  branchId: string;

  @ApiProperty()
  locationId: string;

  @ApiProperty({ required: false })
  sellerId?: string;

  @ApiProperty({ required: false })
  cashierId?: string;

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

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty()
  subtotal: number;

  @ApiProperty({ required: false })
  taxes?: number;

  @ApiProperty()
  includeTax: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty({ required: false, isArray: true })
  items?: any[];

  @ApiProperty({ required: false, isArray: true })
  payments?: any[];

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
  cashSession?: {
    id: string;
    status: string;
    closedAt?: Date | null;
  };

  @ApiProperty({ required: false, enum: ["CASH", "CREDIT"], default: "CASH" })
  paymentMethod?: "CASH" | "CREDIT";

  @ApiProperty({ required: false })
  credit?: {
    id: string;
    creditType: string;
    paymentFrequency: string;
    durationDays: number | null;
    installmentCount: number;
    principalAmount: number;
    outstandingAmount: number;
    firstDueDate: Date;
    lastDueDate: Date;
    status: string;
    installments?: Array<{
      id: string;
      installmentNo: number;
      dueDate: Date;
      amount: number;
      paidAmount: number;
      status: string;
    }>;
  };

  @ApiProperty({ required: false, isArray: true })
  adjustments?: Array<{
    id: string;
    type: string;
    amount: number;
    reason?: string | null;
    createdAt: Date;
    createdBy: string;
    creator?: {
      id: string;
      name: string;
    } | null;
  }>;
}

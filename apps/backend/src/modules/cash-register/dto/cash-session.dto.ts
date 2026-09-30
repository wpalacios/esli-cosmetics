import { ApiProperty } from "@nestjs/swagger";

export class CashSessionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  cashRegisterId: string;

  @ApiProperty()
  employeeId: string;

  @ApiProperty()
  openedAt: Date;

  @ApiProperty({ required: false, nullable: true })
  closedById?: string | null;

  @ApiProperty({ required: false, nullable: true })
  closedAt?: Date | null;

  @ApiProperty()
  openingBalance: number;

  @ApiProperty({ required: false, nullable: true })
  closingBalance?: number | null;

  @ApiProperty({ required: false, nullable: true })
  systemTotal?: number | null;

  @ApiProperty({ required: false, nullable: true })
  difference?: number | null;

  @ApiProperty({ enum: ["open", "closed"] })
  status: string;

  @ApiProperty({ required: false, nullable: true })
  notes?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  cashRegister?: {
    id: string;
    name: string;
    code?: string | null;
  };

  @ApiProperty({ required: false })
  employee?: {
    id: string;
    person?: {
      firstName: string;
      lastName?: string | null;
    } | null;
  };

  @ApiProperty({ required: false })
  orders?: Array<{
    id: string;
    orderNumber?: string | null;
    totalAmount?: number | null;
    paymentMethod?: string;
    createdAt?: Date;
    payments?: Array<{
      id: string;
      paymentType: string;
      provider?: string | null;
      amount: number;
      transactionReference?: string | null;
      paidAt: Date;
    }>;
    credit?: {
      id: string;
      principalAmount: number;
    } | null;
  }>;

  @ApiProperty({ required: false })
  creditInstallmentPayments?: Array<{
    id: string;
    orderId: string;
    orderNumber?: string | null;
    installmentNo?: number | null;
    paymentType: string;
    provider?: string | null;
    amount: number;
    transactionReference?: string | null;
    paidAt: Date;
  }>;

  @ApiProperty({ required: false })
  movements?: Array<{
    id: string;
    cashSessionId: string;
    type: string;
    amount: number;
    reason?: string | null;
    referenceOrderId?: string | null;
    createdBy?: string | null;
    createdAt: Date;
    referenceOrder?: {
      id: string;
      orderNumber?: string | null;
    } | null;
    creator?: {
      id: string;
      email: string;
    } | null;
  }>;

  @ApiProperty({ required: false })
  closedBy?: {
    id: string;
    person?: {
      firstName: string;
      lastName?: string | null;
    } | null;
  };
}

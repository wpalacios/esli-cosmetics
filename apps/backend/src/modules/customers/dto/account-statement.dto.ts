import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class AccountStatementTransactionDto {
  @ApiProperty({
    description: "Transaction ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Transaction type",
    example: "ORDER",
    enum: [
      "ORDER",
      "CREDIT_INSTALLMENT",
      "PAYMENT",
      "REFUND",
      "INITIAL_BALANCE",
      "CREDIT_NOTE",
    ],
  })
  type:
    | "ORDER"
    | "CREDIT_INSTALLMENT"
    | "PAYMENT"
    | "REFUND"
    | "INITIAL_BALANCE"
    | "CREDIT_NOTE";

  @ApiProperty({
    description: "Transaction date",
    example: "2025-01-15T10:30:00Z",
  })
  date: string;

  @ApiProperty({
    description: "Transaction description",
    example: "Order #ORD-2025-001",
  })
  description: string;

  @ApiProperty({
    description: "Reference number (order number, installment number, etc.)",
    example: "ORD-2025-001",
  })
  reference: string;

  @ApiPropertyOptional({
    description: "Debit amount (charges)",
    example: 1500.0,
  })
  debit: number | null;

  @ApiPropertyOptional({
    description: "Credit amount (payments)",
    example: 500.0,
  })
  credit: number | null;

  @ApiProperty({
    description: "Running balance after this transaction",
    example: 1000.0,
  })
  balance: number;

  @ApiPropertyOptional({
    description: "Additional metadata",
  })
  metadata?: {
    orderId?: string;
    creditId?: string;
    installmentId?: string;
    paymentId?: string;
    creditNoteId?: string;
    reversed?: boolean;
    legacyType?: "PAYMENT";
    legacyGroupId?: string;
  };
}

export class AccountStatementCreditDto {
  @ApiProperty({
    description: "Credit ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Order number associated with this credit",
    example: "ORD-2025-001",
  })
  orderNumber: string;

  @ApiProperty({
    description: "Principal amount of the credit",
    example: 2000.0,
  })
  principalAmount: number;

  @ApiProperty({
    description: "Outstanding amount remaining",
    example: 1500.0,
  })
  outstandingAmount: number;

  @ApiProperty({
    description: "Credit status",
    example: "ACTIVE",
  })
  status: string;

  @ApiProperty({
    description: "Credit installments",
    type: [Object],
  })
  installments: Array<{
    id: string;
    installmentNo: number;
    dueDate: string;
    amount: number;
    paidAmount: number;
    status: string;
  }>;
}

export class AccountStatementSummaryDto {
  @ApiProperty({
    description: "Opening balance at start of period",
    example: 0.0,
  })
  openingBalance: number;

  @ApiProperty({
    description: "Total charges (orders, installments)",
    example: 5000.0,
  })
  totalCharges: number;

  @ApiProperty({
    description: "Total payments",
    example: 2000.0,
  })
  totalPayments: number;

  @ApiProperty({
    description: "Closing balance at end of period",
    example: 3000.0,
  })
  closingBalance: number;

  @ApiPropertyOptional({
    description: "Credit limit (if applicable)",
    example: 10000.0,
  })
  creditLimit: number | null;

  @ApiPropertyOptional({
    description: "Available credit (credit limit - outstanding)",
    example: 7000.0,
  })
  availableCredit: number | null;

  @ApiProperty({
    description: "Current outstanding amount across all credits",
    example: 3000.0,
  })
  outstandingAmount: number;
}

export class AccountStatementResponseDto {
  @ApiProperty({
    description: "Customer information",
  })
  customer: {
    id: string;
    person: {
      firstName: string;
      lastName?: string;
      email?: string;
      phone?: string;
    };
    creditAllowed: boolean;
    creditLimit: number | null;
    initialOpeningBalance: number;
  };

  @ApiProperty({
    description: "Account summary",
    type: AccountStatementSummaryDto,
  })
  summary: AccountStatementSummaryDto;

  @ApiProperty({
    description: "Transaction list",
    type: [AccountStatementTransactionDto],
  })
  transactions: AccountStatementTransactionDto[];

  @ApiPropertyOptional({
    description: "Active credits with installments",
    type: [AccountStatementCreditDto],
  })
  credits?: AccountStatementCreditDto[];

  @ApiPropertyOptional({
    description: "Pagination information",
  })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

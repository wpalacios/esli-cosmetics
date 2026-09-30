import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { PriceDto } from "../../prices/dto/prices.dto";
export class CustomerDto {
  @ApiProperty({
    description: "Customer ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Person ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  personId: string;

  @ApiPropertyOptional({
    description: "User ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  userId?: string;

  @ApiPropertyOptional({
    description: "External ID",
    example: "EXT123456",
  })
  externalId?: string;

  @ApiPropertyOptional({
    description: "Default billing address ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  defaultBillingAddressId?: string;

  @ApiPropertyOptional({
    description: "Assigned price type IDs",
    example: [
      "123e4567-123e4567-426614174000",
      "987fcdeb-51a2-43d7-8f9e-123456789abc",
    ],
    type: [String],
  })
  priceTypeIds?: string[];

  @ApiPropertyOptional({
    description: "Price types assigned to a client",
    type: [PriceDto],
  })
  priceTypes?: PriceDto[];

  @ApiProperty({
    description: "Customer deleted status",
    example: false,
  })
  isDeleted: boolean;

  @ApiProperty({
    description: "Creation date",
    example: "2024-01-15T10:30:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update date",
    example: "2024-01-15T10:30:00Z",
  })
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Deletion date",
    example: null,
  })
  deletedAt?: Date;

  @ApiPropertyOptional({
    description: "Additional metadata",
    example: {},
  })
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description: "Person information",
  })
  person: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    docType?: string;
    docNumber?: string;
  };

  @ApiPropertyOptional({
    description: "User information",
  })
  user?: {
    id: string;
    email: string;
    isActive: boolean;
  };

  @ApiPropertyOptional({
    description: "Default billing address",
  })
  defaultBillingAddress?: {
    id: string;
    address: string;
    city?: string;
    postalCode?: string;
  };

  @ApiPropertyOptional({
    description: "Customer orders",
    type: [Object],
  })
  orders?: Array<{
    id: string;
    status: string;
    totalAmount: number;
    createdAt: Date;
  }>;

  @ApiPropertyOptional({
    description: "Assigned discount codes",
    type: [Object],
  })
  discountCodes?: Array<{
    id: string;
    code: string;
    name?: string;
    discountType: string;
    value: number;
    isActive: boolean;
    isRedeemed: boolean;
    assignedAt: Date;
  }>;

  @ApiPropertyOptional({
    description: "Customer Type relation",
    type: Object,
    example: {
      id: "a1b2c3d4-e5f6-7890-1234-567890ab",
      name: "Guest",
      description: "Guest customer type",
      isActive: true,
      isDeleted: false,
    },
  })
  customerType?: {
    id: string;
    name: string;
    description?: string | null;
    isActive: boolean;
    isDeleted: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date | null;
  };

  @ApiPropertyOptional({
    description: "Whether credit is allowed for this customer",
    example: false,
  })
  creditAllowed?: boolean;

  @ApiPropertyOptional({
    description: "Credit limit for this customer",
    example: 1000.0,
  })
  creditLimit?: number;

  @ApiPropertyOptional({
    description:
      "Initial opening balance as of December 31, 2025 (migration date)",
    example: 0.0,
  })
  initialOpeningBalance?: number;
}

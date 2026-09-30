import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class SupplierBrandDto {
  @ApiProperty({
    description: "Supplier brand relationship ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Brand ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  brandId: string;

  @ApiProperty({
    description: "Supplier ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  supplierId: string;

  @ApiProperty({
    description: "Brand name",
    example: "L'Oréal",
  })
  brandName: string;

  @ApiProperty({
    description: "Supplier brand relationship deleted status",
    example: false,
  })
  isDeleted: boolean;

  @ApiProperty({
    description: "Creation date",
    example: "2024-01-15T10:30:00Z",
  })
  createdAt: Date;

  @ApiPropertyOptional({
    description: "Deletion date",
    example: null,
  })
  deletedAt?: Date;
}

export class SupplierDto {
  @ApiProperty({
    description: "Supplier ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Supplier name",
    example: "Beauty Supply Co.",
  })
  name: string;

  @ApiPropertyOptional({
    description: "Contact person name",
    example: "John Smith",
  })
  contact_name?: string;

  @ApiPropertyOptional({
    description: "Phone number",
    example: "+1234567890",
  })
  phone?: string;

  @ApiPropertyOptional({
    description: "Email address",
    example: "contact@beautysupply.com",
  })
  email?: string;

  @ApiPropertyOptional({
    description: "Supplier address",
    example: "123 Business St, City, State 12345",
  })
  address?: string;

  @ApiProperty({
    description: "Supplier deleted status",
    example: false,
  })
  is_deleted: boolean;

  @ApiProperty({
    description: "Creation date",
    example: "2024-01-15T10:30:00Z",
  })
  created_at: Date;

  @ApiProperty({
    description: "Last update date",
    example: "2024-01-15T10:30:00Z",
  })
  updated_at: Date;

  @ApiPropertyOptional({
    description: "Deletion date",
    example: null,
  })
  deleted_at?: Date;

  @ApiPropertyOptional({
    description: "Additional metadata",
    example: {},
  })
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: "Brands supplied by this supplier",
    type: [SupplierBrandDto],
  })
  brands?: SupplierBrandDto[];
}

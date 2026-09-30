import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class WarehouseDto {
  @ApiProperty({
    description: "Warehouse ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiPropertyOptional({
    description: "Branch ID this warehouse belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  branch_id?: string;

  @ApiProperty({
    description: "Warehouse name",
    example: "Main Warehouse",
  })
  name: string;

  @ApiProperty({
    description: "Location type",
    example: "WAREHOUSE",
    enum: ["STORE", "WAREHOUSE", "DISTRIBUTION_CENTER", "POPUP_STORE"],
  })
  location_type: string;

  @ApiPropertyOptional({
    description: "Warehouse address",
    example: "456 Industrial Ave, Warehouse District",
  })
  address?: string;

  @ApiPropertyOptional({
    description: "Warehouse contact information",
    example: "warehouse@eslicosmetics.com",
  })
  contact?: string;

  @ApiProperty({
    description: "Warehouse deleted status",
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
    description: "Branch information",
  })
  branch?: {
    id: string;
    name: string;
    code?: string;
  };

  @ApiPropertyOptional({
    description: "Stock levels at this warehouse",
    type: [Object],
  })
  stock_levels?: Array<{
    id: string;
    productId: string;
    quantity: number;
  }>;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class BranchDto {
  @ApiProperty({
    description: "Branch ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "Branch name",
    example: "Downtown Store",
  })
  name: string;

  @ApiPropertyOptional({
    description: "Branch code",
    example: "DT001",
  })
  code?: string;

  @ApiPropertyOptional({
    description: "Branch address",
    example: "123 Main Street, Downtown, City",
  })
  address?: string;

  @ApiPropertyOptional({
    description: "Branch phone number",
    example: "+1234567890",
  })
  phone?: string;

  @ApiPropertyOptional({
    description: "Manager employee ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  manager_employee_id?: string;

  @ApiProperty({
    description: "Branch active status",
    example: true,
  })
  is_active: boolean;

  @ApiProperty({
    description: "Branch deleted status",
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
    description: "Manager employee information",
  })
  manager_employee?: {
    id: string;
    person: {
      firstName: string;
      lastName?: string;
    };
  };

  @ApiPropertyOptional({
    description: "Branch locations",
    type: [Object],
  })
  locations?: Array<{
    id: string;
    name: string;
    locationType: string;
    address?: string;
    contact?: string;
  }>;
}

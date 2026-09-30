import { ApiProperty } from "@nestjs/swagger";

class EmployeeInfoDto {
  @ApiProperty({ description: "Employee ID" })
  id: string;

  @ApiProperty({ description: "Person information" })
  person: {
    id: string;
    firstName: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };
}

class BranchInfoDto {
  @ApiProperty({ description: "Branch ID" })
  id: string;

  @ApiProperty({ description: "Branch name" })
  name: string;

  @ApiProperty({ description: "Branch code", required: false })
  code?: string;
}

class LocationInfoDto {
  @ApiProperty({ description: "Location ID" })
  id: string;

  @ApiProperty({ description: "Location name" })
  name: string;

  @ApiProperty({ description: "Branch ID", required: false })
  branchId?: string;
}

export class ProfileResponseDto {
  @ApiProperty({
    description: "User ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;

  @ApiProperty({
    description: "User email",
    example: "user@example.com",
  })
  email: string;

  @ApiProperty({
    description: "User active status",
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: "User roles",
    type: [String],
    example: ["admin", "sales_rep"],
  })
  roles: string[];

  @ApiProperty({
    description: "User permissions",
    type: [String],
    example: ["users.read", "users.create"],
  })
  permissions: string[];

  @ApiProperty({
    description: "Employee information",
    type: EmployeeInfoDto,
    required: false,
  })
  employee?: EmployeeInfoDto;

  @ApiProperty({
    description: "Branch information",
    type: BranchInfoDto,
    required: false,
  })
  branch?: BranchInfoDto;

  @ApiProperty({
    description: "Default location for POS",
    type: LocationInfoDto,
    required: false,
  })
  location?: LocationInfoDto;
}

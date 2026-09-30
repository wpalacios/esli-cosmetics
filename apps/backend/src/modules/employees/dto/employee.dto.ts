import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EmployeeDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  personId: string;

  @ApiPropertyOptional()
  userId?: string;

  @ApiPropertyOptional()
  employeeCode?: string;

  @ApiPropertyOptional()
  roleTitle?: string;

  @ApiPropertyOptional()
  locationId?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  hiredAt?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({
    description: "Associated person information",
  })
  person?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    docType?: string;
    docNumber?: string;
  };

  @ApiPropertyOptional({
    description: "Associated user information",
  })
  user?: {
    id: string;
    email: string;
    isActive: boolean;
  };

  @ApiPropertyOptional({
    description: "Associated location information",
  })
  location?: {
    id: string;
    name: string;
    locationType?: string;
    branchId?: string;
    branch?: {
      id: string;
      name: string;
      code?: string;
    };
  };
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class RoleInfoDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  name: string;
}

export class UserDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  lastLoginAt?: Date;

  @ApiProperty({
    description: "User roles",
    type: [RoleInfoDto],
  })
  roles: RoleInfoDto[];

  @ApiProperty({
    description: "User permissions",
    type: [String],
  })
  permissions: string[];

  @ApiPropertyOptional({
    description: "Associated person information",
  })
  person?: {
    id: string;
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
  };

  @ApiPropertyOptional({
    description: "Associated employee information",
  })
  employee?: {
    id: string;
    employeeCode?: string;
    roleTitle?: string;
    person?: {
      id: string;
      firstName: string;
      lastName?: string;
      phone?: string;
      email?: string;
    };
  };
}

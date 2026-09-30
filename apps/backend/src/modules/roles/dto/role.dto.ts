import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PermissionInfoDto {
  @ApiProperty()
  key: string;

  @ApiProperty()
  name: string | null;
}

export class RoleDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  key: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({
    description: "Role permissions",
    type: [PermissionInfoDto],
  })
  permissions: PermissionInfoDto[];
}

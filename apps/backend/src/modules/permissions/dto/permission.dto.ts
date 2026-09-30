import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PermissionDto {
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
}

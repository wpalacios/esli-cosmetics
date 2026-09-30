import { IsString, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateRoleDto {
  @ApiPropertyOptional({
    description: "Role display name",
    example: "Store Manager",
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: "Role description",
    example: "Manages store operations and staff",
  })
  @IsString()
  @IsOptional()
  description?: string;
}

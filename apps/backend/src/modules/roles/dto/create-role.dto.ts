import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateRoleDto {
  @ApiProperty({
    description: "Unique role key",
    example: "store_manager",
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: "Role display name",
    example: "Store Manager",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: "Role description",
    example: "Manages store operations and staff",
  })
  @IsString()
  @IsOptional()
  description?: string;
}

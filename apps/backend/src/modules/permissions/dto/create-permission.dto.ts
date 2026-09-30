import { IsString, IsNotEmpty, IsOptional } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreatePermissionDto {
  @ApiProperty({
    description: "Unique permission key",
    example: "products.create",
  })
  @IsString()
  @IsNotEmpty()
  key: string;

  @ApiProperty({
    description: "Permission display name",
    example: "Create Products",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: "Permission description",
    example: "Allows creating new products in the system",
  })
  @IsString()
  @IsOptional()
  description?: string;
}

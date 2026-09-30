import { IsString, IsOptional } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdatePermissionDto {
  @ApiPropertyOptional({
    description: "Permission display name",
    example: "Create Products",
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: "Permission description",
    example: "Allows creating new products in the system",
  })
  @IsString()
  @IsOptional()
  description?: string;
}

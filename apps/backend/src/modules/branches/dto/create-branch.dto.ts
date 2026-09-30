import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateBranchDto {
  @ApiProperty({
    description: "Branch name",
    example: "Downtown Store",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: "Branch code (unique identifier)",
    example: "DT001",
  })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({
    description: "Branch address",
    example: "123 Main Street, Downtown, City",
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: "Branch phone number",
    example: "+1234567890",
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: "Manager employee ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsOptional()
  managerEmployeeId?: string;

  @ApiPropertyOptional({
    description: "Branch active status",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

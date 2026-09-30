import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateEmployeeDto {
  @ApiProperty({
    description: "Employee first name",
    example: "John",
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional({
    description: "Employee last name",
    example: "Doe",
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: "Employee phone number",
    example: "+1234567890",
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: "Employee email address",
    example: "john.doe@esli-cosmetics.com",
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: "Document type",
    example: "CC",
  })
  @IsString()
  @IsOptional()
  docType?: string;

  @ApiPropertyOptional({
    description: "Document number",
    example: "12345678",
  })
  @IsString()
  @IsOptional()
  docNumber?: string;

  @ApiPropertyOptional({
    description: "Employee code",
    example: "EMP001",
  })
  @IsString()
  @IsOptional()
  employeeCode?: string;

  @ApiPropertyOptional({
    description: "Role title",
    example: "Sales Representative",
  })
  @IsString()
  @IsOptional()
  roleTitle?: string;

  @ApiPropertyOptional({
    description: "Location ID where employee works (store or warehouse)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsOptional()
  locationId?: string;

  @ApiPropertyOptional({
    description: "Employee active status",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Hire date",
    example: "2024-01-15",
  })
  @IsDateString()
  @IsOptional()
  hiredAt?: string;

  @ApiPropertyOptional({
    description: "User ID if employee has system access",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsOptional()
  userId?: string;
}

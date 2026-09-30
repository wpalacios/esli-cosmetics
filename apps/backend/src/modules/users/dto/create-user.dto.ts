import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsStrongPassword } from "../../../common/validators/password.validator";

export class CreateUserDto {
  @ApiProperty({
    description: "User email address",
    example: "user@esli-cosmetics.com",
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    description: "User password for login",
    example: "yourSecurePassword",
    minLength: 6,
  })
  @IsString()
  @IsOptional()
  @MinLength(8)
  @IsStrongPassword()
  password?: string;

  @ApiPropertyOptional({
    description: "User active status",
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Role keys to assign to the user",
    example: ["sales_rep"],
  })
  @IsString({ each: true })
  @IsOptional()
  roleKeys?: string[];

  @ApiPropertyOptional({
    description: "Employee ID to link to this user",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  @IsOptional()
  employeeId?: string;
}

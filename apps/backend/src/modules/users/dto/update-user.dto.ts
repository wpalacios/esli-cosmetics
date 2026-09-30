import {
  IsEmail,
  IsString,
  IsOptional,
  IsBoolean,
  MinLength,
  ValidateIf,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsStrongPassword } from "../../../common/validators/password.validator";

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: "User email address",
    example: "user@esli-cosmetics.com",
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: "New password to reset user password",
    example: "yourNewSecurePassword",
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
    example: ["sales_rep", "store_manager"],
  })
  @IsString({ each: true })
  @IsOptional()
  roleKeys?: string[];

  @ApiPropertyOptional({
    description: "Employee ID to link to this user. Set to null to unlink.",
    example: "123e4567-e89b-12d3-a456-426614174000",
    nullable: true,
  })
  @ValidateIf(o => o.employeeId !== null)
  @IsString()
  @IsOptional()
  employeeId?: string | null;
}

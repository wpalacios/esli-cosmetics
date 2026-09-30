import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  MaxLength,
  Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  sanitizeEmail,
  sanitizeString,
  sanitizePhone,
} from "../../../common/utils/sanitize.util";
import { IsStrongPassword } from "../../../common/validators/password.validator";

export class RegisterDto {
  @ApiProperty({
    description: "User email address",
    example: "user@esli-cosmetics.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address" })
  @IsNotEmpty({ message: "Email is required" })
  @MaxLength(255, { message: "Email must not exceed 255 characters" })
  @Transform(({ value }) => sanitizeEmail(value))
  email: string;

  @ApiProperty({
    description:
      "User password (must be at least 8 characters with uppercase, lowercase, number, and special character)",
    example: "Password123!",
    minLength: 8,
  })
  @IsString({ message: "Password must be a string" })
  @IsNotEmpty({ message: "Password is required" })
  @MinLength(8, { message: "Password must be at least 8 characters long" })
  @MaxLength(128, { message: "Password must not exceed 128 characters" })
  @IsStrongPassword({
    message:
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
  })
  @Transform(({ value }) => sanitizeString(value))
  password: string;

  @ApiProperty({
    description: "User first name",
    example: "John",
  })
  @IsString({ message: "First name must be a string" })
  @IsNotEmpty({ message: "First name is required" })
  @MaxLength(100, { message: "First name must not exceed 100 characters" })
  @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, {
    message:
      "First name can only contain letters, spaces, hyphens, and apostrophes",
  })
  @Transform(({ value }) => sanitizeString(value))
  firstName: string;

  @ApiPropertyOptional({
    description: "User last name",
    example: "Doe",
  })
  @IsString({ message: "Last name must be a string" })
  @IsOptional()
  @MaxLength(100, { message: "Last name must not exceed 100 characters" })
  @Matches(/^[a-zA-ZÀ-ÿ\s'-]+$/, {
    message:
      "Last name can only contain letters, spaces, hyphens, and apostrophes",
  })
  @Transform(({ value }) => (value ? sanitizeString(value) : value))
  lastName?: string;

  @ApiPropertyOptional({
    description: "User phone number",
    example: "+1234567890",
  })
  @IsString({ message: "Phone must be a string" })
  @IsOptional()
  @MaxLength(20, { message: "Phone number must not exceed 20 characters" })
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: "Please provide a valid phone number",
  })
  @Transform(({ value }) => (value ? sanitizePhone(value) : value))
  phone?: string;
}

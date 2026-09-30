import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  sanitizeEmail,
  sanitizeString,
} from "../../../common/utils/sanitize.util";

export class LoginDto {
  @ApiProperty({
    description: "User email address",
    example: "admin@esli-cosmetics.com",
  })
  @IsEmail({}, { message: "Please provide a valid email address" })
  @IsNotEmpty({ message: "Email is required" })
  @MaxLength(255, { message: "Email must not exceed 255 characters" })
  @Transform(({ value }) => sanitizeEmail(value))
  email: string;

  @ApiProperty({
    description: "User password",
    example: "yourSecurePassword",
    minLength: 6,
  })
  @IsString({ message: "Password must be a string" })
  @IsNotEmpty({ message: "Password is required" })
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  @MaxLength(128, { message: "Password must not exceed 128 characters" })
  @Transform(({ value }) => sanitizeString(value))
  password: string;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEmail, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreatePersonDto {
  @ApiProperty({
    description: "Person first name",
    example: "John",
  })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional({
    description: "Person last name",
    example: "Doe",
  })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({
    description: "Person phone number",
    example: "+1234567890",
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: "Person email address",
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
}

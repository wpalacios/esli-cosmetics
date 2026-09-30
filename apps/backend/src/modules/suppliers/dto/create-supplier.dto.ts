import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsUUID,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateSupplierDto {
  @ApiProperty({
    description: "Supplier name",
    example: "Beauty Supply Co.",
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: "Contact person name",
    example: "John Smith",
  })
  @IsString()
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional({
    description: "Phone number",
    example: "+1234567890",
  })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: "Email address",
    example: "contact@beautysupply.com",
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    description: "Supplier address",
    example: "123 Business St, City, State 12345",
  })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({
    description: "Brand IDs that this supplier provides",
    example: [
      "123e4567-e89b-12d3-a456-426614174000",
      "987fcdeb-51a2-43d7-8f9e-123456789abc",
    ],
    type: [String],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  brandIds?: string[];
}

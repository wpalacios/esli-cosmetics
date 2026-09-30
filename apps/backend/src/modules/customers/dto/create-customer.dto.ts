import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { CreatePersonDto } from "../../people/dto/create-person.dto";
import { CustomerAddressDto } from "./customer-address.dto";

export class CreateCustomerDto {
  @ApiProperty({
    description: "Person information for the customer",
    type: CreatePersonDto,
  })
  @ValidateNested()
  @Type(() => CreatePersonDto)
  @IsNotEmpty()
  person: CreatePersonDto;

  @ApiPropertyOptional({
    description: "Customer home/billing address",
    type: CustomerAddressDto,
  })
  @ValidateNested()
  @Type(() => CustomerAddressDto)
  @IsOptional()
  address?: CustomerAddressDto;

  @ApiPropertyOptional({
    description: "User ID (if customer has a user account)",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiPropertyOptional({
    description: "External ID (from external systems)",
    example: "EXT123456",
  })
  @IsString()
  @IsOptional()
  externalId?: string;

  @ApiPropertyOptional({
    description: "Default billing address ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsUUID()
  @IsOptional()
  defaultBillingAddressId?: string;

  @ApiPropertyOptional({
    description: "Assigned price type IDs",
    example: [
      "a1b2c3d4-e5f6-7890-1234-567890abcdef",
      "b2c3d4e5-f6g7-8901-2345-678901bcdefg",
    ],
    type: [String],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  priceTypeIds?: string[];

  @ApiPropertyOptional({
    description: "Discount code IDs assigned to this customer",
    example: [
      "123e4567-e89b-12d3-a456-426614174000",
      "987fcdeb-51a2-43d7-8f9e-123456789abc",
    ],
    type: [String],
  })
  @IsArray()
  @IsUUID("4", { each: true })
  @IsOptional()
  discountCodeIds?: string[];

  @ApiPropertyOptional({
    description: "Customer type for this customer",
    example: "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  })
  @IsUUID()
  @IsOptional()
  customerTypeId?: string;

  @ApiPropertyOptional({
    description: "Whether credit is allowed for this customer",
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  creditAllowed?: boolean;

  @ApiPropertyOptional({
    description: "Credit limit for this customer",
    example: 1000.0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  creditLimit?: number;

  @ApiPropertyOptional({
    description:
      "Initial opening balance as of December 31, 2025 (migration date)",
    example: 0.0,
  })
  @IsNumber()
  @IsOptional()
  initialOpeningBalance?: number;
}

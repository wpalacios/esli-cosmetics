import { ApiProperty } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
} from "class-validator";

const MAX_NAMES = 2000;
const MAX_NAME_LENGTH = 500;

export class ResolveVariantDisplayNamesDto {
  @ApiProperty({
    description:
      "Deduplicated display names (e.g. product_variants.name), normalized on the server",
    example: ["Labial rojo", "Base 02"],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_NAMES)
  @IsString({ each: true })
  @MaxLength(MAX_NAME_LENGTH, { each: true })
  names!: string[];
}

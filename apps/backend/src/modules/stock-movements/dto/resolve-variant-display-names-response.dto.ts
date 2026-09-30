import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export type VariantDisplayNameResolveStatus =
  | "unique"
  | "not_found"
  | "ambiguous";

export class VariantDisplayNameResolveEntryDto {
  @ApiProperty({
    description: "Normalized name (trim, lower, collapsed whitespace)",
  })
  normalizedName!: string;

  @ApiProperty({ enum: ["unique", "not_found", "ambiguous"] })
  status!: VariantDisplayNameResolveStatus;

  @ApiPropertyOptional({ format: "uuid" })
  productVariantId?: string;

  @ApiPropertyOptional({ format: "uuid" })
  productId?: string;

  @ApiPropertyOptional()
  candidateCount?: number;
}

export class ResolveVariantDisplayNamesResponseDto {
  @ApiProperty({ type: [VariantDisplayNameResolveEntryDto] })
  results!: VariantDisplayNameResolveEntryDto[];
}

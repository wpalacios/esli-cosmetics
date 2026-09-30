import { ApiProperty } from "@nestjs/swagger";

export class ProductSearchIndexStatusDto {
  @ApiProperty()
  totalVariants!: number;

  @ApiProperty()
  variantsWithAliases!: number;

  @ApiProperty()
  variantsWithoutAliases!: number;

  @ApiProperty()
  variantsWithEmbeddings!: number;

  @ApiProperty()
  pendingEmbeddings!: number;

  @ApiProperty()
  embeddingsEnabled!: boolean;
}

export class ProductSearchIndexRebuildResultDto {
  @ApiProperty()
  processed!: number;

  @ApiProperty({ required: false })
  aliases?: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty({ required: false })
  skipped?: number;
}

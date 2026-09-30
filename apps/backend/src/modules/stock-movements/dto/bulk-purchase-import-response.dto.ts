import { ApiProperty } from "@nestjs/swagger";

export class BulkPurchaseImportRowErrorDto {
  @ApiProperty()
  rowIndex!: number;

  @ApiProperty()
  message!: string;
}

export class BulkPurchaseImportResponseDto {
  @ApiProperty()
  dryRun!: boolean;

  @ApiProperty()
  ok!: boolean;

  @ApiProperty()
  rowsProcessed!: number;

  @ApiProperty({ description: "Number of PURCHASE movement rows created" })
  movementsCreated!: number;

  @ApiProperty({ type: [BulkPurchaseImportRowErrorDto] })
  errors!: BulkPurchaseImportRowErrorDto[];
}

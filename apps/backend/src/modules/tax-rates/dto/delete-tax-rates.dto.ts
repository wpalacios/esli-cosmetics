import { ApiProperty } from "@nestjs/swagger";

export class DeleteTaxRateResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
  })
  success!: boolean;

  @ApiProperty({
    description: "Success message",
    example: "Tax rate deleted successfully",
  })
  message!: string;

  @ApiProperty({
    description: "Deleted tax rate ID",
    example: "a88d871f-661c-485f-8d5a-352fea4dbca4",
  })
  id!: string;
}

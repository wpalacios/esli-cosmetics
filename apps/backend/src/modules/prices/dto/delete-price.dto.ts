import { ApiProperty } from "@nestjs/swagger";

export class DeletePriceResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Success message",
    example: "Price type deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "Deleted price type ID",
    example: "7c6fcd2f-e41f-422e-a4ce-8a32c86dc7ab",
  })
  id: string;
}

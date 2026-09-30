import { ApiProperty } from "@nestjs/swagger";

export class DeleteCustomerPriceResponseDto {
  @ApiProperty({
    description: "Success message",
    example: "Customer price deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "Deleted customer price ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;
}

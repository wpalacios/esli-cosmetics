import { ApiProperty } from "@nestjs/swagger";

export class DeleteSupplierResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Success message",
    example: "Supplier deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "Deleted supplier ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;
}

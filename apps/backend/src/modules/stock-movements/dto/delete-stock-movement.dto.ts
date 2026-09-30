import { ApiProperty } from "@nestjs/swagger";

export class DeleteStockMovementResponseDto {
  @ApiProperty({ description: "Whether the deletion was successful" })
  success: boolean;

  @ApiProperty({ description: "Deletion message" })
  message: string;

  @ApiProperty({ description: "ID of the deleted stock movement" })
  id: string;
}

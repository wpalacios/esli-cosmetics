import { ApiProperty } from "@nestjs/swagger";

export class DeleteBranchResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Success message",
    example: "Branch deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "Deleted branch ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;
}

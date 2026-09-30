import { ApiProperty } from "@nestjs/swagger";

export class DeleteBrandResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Response message",
    example: "Brand deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "Deleted brand ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  id: string;
}

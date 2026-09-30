import { ApiProperty } from "@nestjs/swagger";

export class DeleteCategoryResponseDto {
  @ApiProperty({
    description: "Success status",
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: "Success message",
    example: "Category deleted successfully",
  })
  message: string;

  @ApiProperty({
    description: "Deleted category ID",
    example: "123j444-k43b-34k3-j353-2342532523",
  })
  id: string;
}

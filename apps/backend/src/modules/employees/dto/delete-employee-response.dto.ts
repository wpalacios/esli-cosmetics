import { ApiProperty } from "@nestjs/swagger";

export class DeleteEmployeeResponseDto {
  @ApiProperty({
    description: "Deletion confirmation message",
    example: "Employee deleted successfully",
  })
  message: string;
}

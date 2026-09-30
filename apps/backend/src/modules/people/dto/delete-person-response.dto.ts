import { ApiProperty } from "@nestjs/swagger";

export class DeletePersonResponseDto {
  @ApiProperty({
    description: "Deletion confirmation message",
    example: "Person deleted successfully",
  })
  message: string;
}

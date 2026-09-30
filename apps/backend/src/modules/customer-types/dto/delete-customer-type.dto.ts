import { ApiProperty } from "@nestjs/swagger";

export class DeleteCustomerTypeResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  message: string;
}

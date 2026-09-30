import { ApiProperty } from "@nestjs/swagger";
import { UserInfo } from "./auth-response.dto";

export class LoginResponseDto {
  @ApiProperty({
    description: "User information",
    type: UserInfo,
  })
  user: UserInfo;
}

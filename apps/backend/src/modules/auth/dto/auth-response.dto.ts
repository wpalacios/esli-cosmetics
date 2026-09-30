import { ApiProperty } from "@nestjs/swagger";

export class UserInfo {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  roles: string[];

  @ApiProperty()
  permissions: string[];
}

export class AuthResponseDto {
  @ApiProperty({
    description: "JWT access token",
  })
  accessToken: string;

  @ApiProperty({
    description: "JWT refresh token",
  })
  refreshToken: string;

  @ApiProperty({
    description: "User information",
    type: UserInfo,
  })
  user: UserInfo;

  @ApiProperty({
    description: "Token expiration time in seconds",
  })
  expiresIn: number;
}

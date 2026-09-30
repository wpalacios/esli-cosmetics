import { ApiProperty } from "@nestjs/swagger";

export class RefreshResponseDto {
  @ApiProperty({
    description: "New JWT access token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken: string;

  @ApiProperty({
    description: "Token expiration time in seconds",
    example: 900,
  })
  expiresIn: number;
}

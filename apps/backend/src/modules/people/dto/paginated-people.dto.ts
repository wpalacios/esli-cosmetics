import { ApiProperty } from "@nestjs/swagger";
import { PersonDto } from "./person.dto";

export class PaginatedPeopleDto {
  @ApiProperty({
    description: "Array of people",
    type: [PersonDto],
  })
  people: PersonDto[];

  @ApiProperty({
    description: "Total number of people",
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: "Current page number",
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: "Number of items per page",
    example: 10,
  })
  limit: number;
}

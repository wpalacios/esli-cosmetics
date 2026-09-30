import { ApiProperty } from "@nestjs/swagger";
import { EmployeeDto } from "./employee.dto";

export class PaginatedEmployeesDto {
  @ApiProperty({
    description: "Array of employees",
    type: [EmployeeDto],
  })
  employees: EmployeeDto[];

  @ApiProperty({
    description: "Total number of employees",
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

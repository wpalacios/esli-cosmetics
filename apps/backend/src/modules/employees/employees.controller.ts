import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { DeleteEmployeeResponseDto } from "./dto/delete-employee-response.dto";
import { EmployeeDto } from "./dto/employee.dto";
import { PaginatedEmployeesDto } from "./dto/paginated-employees.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeesService } from "./employees.service";
// Using global guards - no need to import guards here
import { Permissions } from "../auth/decorators/permissions.decorator";

@ApiTags("Employees")
@Controller("employees")
// Using global guards
@ApiBearerAuth()
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Permissions("employees.create")
  @ApiOperation({ summary: "Create a new employee (Admin only)" })
  @ApiResponse({
    status: 201,
    description: "Employee created successfully",
    type: EmployeeDto,
  })
  @ApiResponse({
    status: 409,
    description:
      "Employee with this email, document, code, or user already exists",
  })
  create(@Body() createEmployeeDto: CreateEmployeeDto): Promise<EmployeeDto> {
    return this.employeesService.create(createEmployeeDto);
  }

  @Get("check-code")
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Check if employee code exists",
    description: "Check if an employee with the given code already exists",
  })
  @ApiQuery({
    name: "employeeCode",
    required: true,
    type: String,
    description: "Employee code to check",
  })
  @ApiQuery({
    name: "excludeId",
    required: false,
    type: String,
    description: "Employee ID to exclude from check (for updates)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns whether the code exists",
    schema: { type: "object", properties: { exists: { type: "boolean" } } },
  })
  async checkCodeExists(
    @Query("employeeCode") employeeCode: string,
    @Query("excludeId") excludeId?: string
  ): Promise<{ exists: boolean }> {
    if (!employeeCode || employeeCode.trim() === "") {
      throw new BadRequestException(
        "Employee code query parameter is required"
      );
    }
    const exists = await this.employeesService.checkEmployeeCodeExists(
      employeeCode.trim(),
      excludeId
    );
    return { exists };
  }

  @Get("check-document")
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Check if document number exists",
    description:
      "Check if a person with the given document type and number already exists",
  })
  @ApiQuery({
    name: "docType",
    required: true,
    type: String,
    description: "Document type to check",
  })
  @ApiQuery({
    name: "docNumber",
    required: true,
    type: String,
    description: "Document number to check",
  })
  @ApiQuery({
    name: "excludeId",
    required: false,
    type: String,
    description: "Employee ID to exclude from check (for updates)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns whether the document exists",
    schema: { type: "object", properties: { exists: { type: "boolean" } } },
  })
  async checkDocumentExists(
    @Query("docType") docType: string,
    @Query("docNumber") docNumber: string,
    @Query("excludeId") excludeId?: string
  ): Promise<{ exists: boolean }> {
    if (
      !docType ||
      docType.trim() === "" ||
      !docNumber ||
      docNumber.trim() === ""
    ) {
      throw new BadRequestException(
        "Document type and number query parameters are required"
      );
    }
    const exists = await this.employeesService.checkDocumentNumberExists(
      docType.trim(),
      docNumber.trim(),
      excludeId
    );
    return { exists };
  }

  @Get("check-email")
  @Permissions("employees.read")
  @ApiOperation({
    summary: "Check if email exists",
    description: "Check if a person with the given email already exists",
  })
  @ApiQuery({
    name: "email",
    required: true,
    type: String,
    description: "Email to check",
  })
  @ApiQuery({
    name: "excludeId",
    required: false,
    type: String,
    description: "Employee ID to exclude from check (for updates)",
  })
  @ApiResponse({
    status: 200,
    description: "Returns whether the email exists",
    schema: { type: "object", properties: { exists: { type: "boolean" } } },
  })
  async checkEmailExists(
    @Query("email") email: string,
    @Query("excludeId") excludeId?: string
  ): Promise<{ exists: boolean }> {
    if (!email || email.trim() === "") {
      throw new BadRequestException("Email query parameter is required");
    }
    const exists = await this.employeesService.checkEmailExists(
      email.trim(),
      excludeId
    );
    return { exists };
  }

  @Get()
  @Permissions("employees.read")
  @ApiOperation({ summary: "Get all employees with pagination and search" })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10)",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by first name, last name, employee code, or role",
  })
  @ApiResponse({
    status: 200,
    description: "Employees retrieved successfully",
    type: PaginatedEmployeesDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("search") search?: string
  ): Promise<PaginatedEmployeesDto> {
    return this.employeesService.findAll(page, limit, search);
  }

  @Get(":id")
  @Permissions("employees.read")
  @ApiOperation({ summary: "Get employee by ID" })
  @ApiResponse({
    status: 200,
    description: "Employee retrieved successfully",
    type: EmployeeDto,
  })
  @ApiResponse({ status: 404, description: "Employee not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<EmployeeDto> {
    return this.employeesService.findOne(id);
  }

  @Patch(":id")
  @Permissions("employees.update")
  @ApiOperation({ summary: "Update employee by ID (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "Employee updated successfully",
    type: EmployeeDto,
  })
  @ApiResponse({ status: 404, description: "Employee not found" })
  @ApiResponse({
    status: 409,
    description: "Email, document, code, or user already exists",
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto
  ): Promise<EmployeeDto> {
    return this.employeesService.update(id, updateEmployeeDto);
  }

  @Delete(":id")
  @Permissions("employees.delete")
  @ApiOperation({ summary: "Delete employee by ID (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "Employee deleted successfully",
    type: DeleteEmployeeResponseDto,
  })
  @ApiResponse({ status: 404, description: "Employee not found" })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteEmployeeResponseDto> {
    return this.employeesService.remove(id);
  }
}

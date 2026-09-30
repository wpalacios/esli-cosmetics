import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { CustomerTypesService } from "./customer-types.service";
import { CreateCustomerTypeDto } from "./dto/create-customer-type.dto";
import { CustomerTypeDto } from "./dto/customer-type.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { PaginatedCustomerTypesDto } from "./dto/paginated-customer-types.dto";
import { UpdateCustomerTypeDto } from "./dto/update-customer-type.dto";
import { DeleteCustomerTypeResponseDto } from "./dto/delete-customer-type.dto";

@ApiTags("Customer Types")
@Controller("customer-types")
@ApiBearerAuth()
export class CustomerTypesController {
  constructor(private readonly customerTypesService: CustomerTypesService) {}

  @Post()
  @Permissions("customer_types.create")
  @ApiOperation({ summary: "Create a new customer type" })
  @ApiResponse({
    status: 201,
    description: "Customer type created successfully",
    type: CustomerTypeDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 409, description: "Customer type already exists" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async create(
    @Body() createCustomerTypeDto: CreateCustomerTypeDto
  ): Promise<CustomerTypeDto> {
    return this.customerTypesService.create(createCustomerTypeDto);
  }

  @Get()
  @Permissions("customer_types.read")
  @ApiOperation({
    summary: "Get all customer types with pagination and optional search",
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by name or description",
  })
  @ApiQuery({
    name: "name",
    required: false,
    type: String,
    description: "Filter by name",
  })
  @ApiQuery({
    name: "description",
    required: false,
    type: String,
    description: "Filter by description",
  })
  @ApiResponse({
    status: 200,
    description: "Customer types retrieved successfully",
    type: PaginatedCustomerTypesDto,
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page: number = 1,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number = 10,
    @Query("search") search?: string,
    @Query("name") name?: string,
    @Query("description") description?: string
  ): Promise<PaginatedCustomerTypesDto> {
    if (page < 1) {
      throw new BadRequestException("Page must be greater than 0");
    }
    if (limit < 1 || limit > 100) {
      throw new BadRequestException("Limit must be between 1 and 100");
    }
    return this.customerTypesService.findAll(page, limit, {
      search,
      name,
      description,
    });
  }

  @Get(":id")
  @Permissions("customer_types.read")
  @ApiOperation({ summary: "Get a customer type by ID" })
  @ApiResponse({
    status: 200,
    description: "Customer type retrieved successfully",
    type: CustomerTypeDto,
  })
  @ApiResponse({ status: 404, description: "Customer type not found" })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async findOne(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<CustomerTypeDto> {
    return this.customerTypesService.findOne(id);
  }

  @Put(":id")
  @Permissions("customer_types.update")
  @ApiOperation({ summary: "Update a customer type" })
  @ApiResponse({
    status: 200,
    description: "Customer type updated successfully",
    type: CustomerTypeDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Customer type not found" })
  @ApiResponse({
    status: 409,
    description: "Customer type name already exists",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateCustomerTypeDto: UpdateCustomerTypeDto
  ): Promise<CustomerTypeDto> {
    return this.customerTypesService.update(id, updateCustomerTypeDto);
  }

  @Delete(":id")
  @Permissions("customer_types.delete")
  @ApiOperation({ summary: "Delete a customer type" })
  @ApiResponse({
    status: 200,
    description: "Customer type deleted successfully",
    type: DeleteCustomerTypeResponseDto,
  })
  @ApiResponse({ status: 404, description: "Customer type not found" })
  @ApiResponse({
    status: 409,
    description: "Customer type is being used by customers",
  })
  @ApiResponse({ status: 500, description: "Internal server error" })
  async remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteCustomerTypeResponseDto> {
    return this.customerTypesService.remove(id);
  }
}

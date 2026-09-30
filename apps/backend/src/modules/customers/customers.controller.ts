import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  ParseIntPipe,
  Request,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomerDto } from "./dto/customer.dto";
import { PaginatedCustomersDto } from "./dto/paginated-customers.dto";
import { DeleteCustomerResponseDto } from "./dto/delete-customer-response.dto";
import { AccountStatementResponseDto } from "./dto/account-statement.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";
import { CreatePaymentDto } from "../payments/dto/create-payment.dto";

@ApiTags("Customers")
@Controller("customers")
@ApiBearerAuth()
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Permissions("customers.create")
  @ApiOperation({ summary: "Create a new customer" })
  @ApiResponse({
    status: 201,
    description: "Customer created successfully",
    type: CustomerDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({
    status: 404,
    description: "Person, user, address or price types not found",
  })
  @ApiResponse({
    status: 409,
    description: "Customer already exists for this person",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async create(
    @Body() createCustomerDto: CreateCustomerDto
  ): Promise<CustomerDto> {
    return this.customersService.create(createCustomerDto);
  }

  @Get()
  @Permissions("customers.read")
  @ApiOperation({ summary: "Get all customers with pagination and search" })
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
    description:
      "Search term for name, email, phone, document number, or external ID",
  })
  @ApiResponse({
    status: 200,
    description: "Customers retrieved successfully",
    type: PaginatedCustomersDto,
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("search") search?: string
  ): Promise<PaginatedCustomersDto> {
    return this.customersService.findAll(page, limit, search);
  }

  @Get(":id")
  @Permissions("customers.read")
  @ApiOperation({ summary: "Get a customer by ID" })
  @ApiResponse({
    status: 200,
    description: "Customer retrieved successfully",
    type: CustomerDto,
  })
  @ApiResponse({ status: 404, description: "Customer not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async findOne(@Param("id", ParseUUIDPipe) id: string): Promise<CustomerDto> {
    return this.customersService.findOne(id);
  }

  @Patch(":id")
  @Permissions("customers.update")
  @ApiOperation({ summary: "Update a customer" })
  @ApiResponse({
    status: 200,
    description: "Customer updated successfully",
    type: CustomerDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({
    status: 404,
    description: "Customer, person, user, or address not found",
  })
  @ApiResponse({
    status: 409,
    description: "Customer already exists for this person",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateCustomerDto: UpdateCustomerDto
  ): Promise<CustomerDto> {
    return this.customersService.update(id, updateCustomerDto);
  }

  @Delete(":id")
  @Permissions("customers.delete")
  @ApiOperation({ summary: "Delete a customer (soft delete)" })
  @ApiResponse({
    status: 200,
    description: "Customer deleted successfully",
    type: DeleteCustomerResponseDto,
  })
  @ApiResponse({ status: 404, description: "Customer not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteCustomerResponseDto> {
    return this.customersService.remove(id);
  }

  @Get(":id/outstanding-credits")
  @Permissions("customers.read")
  @ApiOperation({ summary: "Get customer outstanding credit amount" })
  @ApiResponse({
    status: 200,
    description: "Outstanding credits retrieved successfully",
    schema: {
      type: "object",
      properties: {
        outstandingAmount: { type: "number" },
        creditLimit: { type: "number", nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: "Customer not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async getOutstandingCredits(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<{ outstandingAmount: number; creditLimit: number | null }> {
    return this.customersService.getOutstandingCredits(id);
  }

  @Get(":id/account-statement")
  @Permissions("customers.read")
  @ApiOperation({ summary: "Get customer account statement" })
  @ApiQuery({
    name: "from",
    required: false,
    type: String,
    description: "Start date (ISO format). Minimum: 2025-12-31",
  })
  @ApiQuery({
    name: "to",
    required: false,
    type: String,
    description: "End date (ISO format). Minimum: 2025-12-31",
  })
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
    description: "Items per page (default: 50)",
  })
  @ApiQuery({
    name: "transactionType",
    required: false,
    type: String,
    description:
      "Comma-separated list of transaction types to filter by (e.g. ORDER,PAYMENT,REFUND). Valid values: ORDER, PAYMENT, REFUND, CREDIT_NOTE, INITIAL_BALANCE",
  })
  @ApiResponse({
    status: 200,
    description: "Account statement retrieved successfully",
    type: AccountStatementResponseDto,
  })
  @ApiResponse({ status: 400, description: "Bad request - invalid date range" })
  @ApiResponse({ status: 404, description: "Customer not found" })
  @ApiResponse({
    status: 403,
    description: "Forbidden - insufficient permissions",
  })
  async getAccountStatement(
    @Param("id", ParseUUIDPipe) id: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("transactionType") transactionType?: string
  ): Promise<AccountStatementResponseDto> {
    return this.customersService.getAccountStatement(id, {
      from,
      to,
      page,
      limit,
      transactionType,
    });
  }

  @Post(":id/payments")
  @Permissions("orders.update")
  @ApiOperation({
    summary: "Create customer account payment",
    description:
      "Creates a payment for a customer and allocates it across all outstanding credits using waterfall logic.",
  })
  @ApiResponse({
    status: 201,
    description: "Payment created and allocated successfully",
  })
  @ApiResponse({
    status: 400,
    description:
      "Invalid payment amount or customer has no outstanding credits",
  })
  @ApiResponse({
    status: 404,
    description: "Customer not found",
  })
  async createCustomerPayment(
    @Param("id", ParseUUIDPipe) customerId: string,
    @Body() dto: CreatePaymentDto,
    @Request() req: AuthenticatedRequest
  ) {
    const userId = req.user?.id;
    return this.customersService.createCustomerPayment(customerId, dto, userId);
  }

  @Post(":id/refunds")
  @Permissions("orders.update")
  @ApiOperation({
    summary: "Create customer refund",
    description:
      "Records a refund to the customer when they have a credit balance (negative statement). The amount appears as a credit on the account statement.",
  })
  @ApiResponse({ status: 201, description: "Refund created successfully" })
  @ApiResponse({ status: 400, description: "Invalid amount" })
  @ApiResponse({ status: 404, description: "Customer not found" })
  async createCustomerRefund(
    @Param("id", ParseUUIDPipe) customerId: string,
    @Body() dto: CreatePaymentDto,
    @Request() req: AuthenticatedRequest
  ) {
    const userId = req.user?.id;
    return this.customersService.createCustomerRefund(customerId, dto, userId);
  }
}

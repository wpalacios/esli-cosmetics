import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { CustomerPricesService } from "./customer-prices.service";
import { CreateCustomerPriceDto } from "./dto/create-customer-price.dto";
import { CustomerPriceDto } from "./dto/customer-price.dto";
import { PaginatedCustomerPricesDto } from "./dto/paginated-customer-prices.dto";
import { DeleteCustomerPriceResponseDto } from "./dto/delete-customer-price-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";

@ApiTags("Customer Prices")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("customer-prices")
export class CustomerPricesController {
  constructor(private readonly customerPricesService: CustomerPricesService) {}

  @Post()
  @ApiOperation({ summary: "Create a new customer price relationship" })
  @ApiResponse({
    status: 201,
    description: "Customer price relationship created successfully",
    type: CustomerPriceDto,
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Customer or price type not found" })
  @ApiResponse({
    status: 409,
    description: "Customer price relationship already exists",
  })
  async create(
    @Body() createCustomerPriceDto: CreateCustomerPriceDto,
    @Request() req: AuthenticatedRequest
  ): Promise<CustomerPriceDto> {
    return this.customerPricesService.create(
      createCustomerPriceDto,
      req.user?.id
    );
  }

  @Get()
  @ApiOperation({
    summary: "Get all customer price relationships with pagination",
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
    name: "customerId",
    required: false,
    type: String,
    description: "Filter by customer ID",
  })
  @ApiQuery({
    name: "priceTypeId",
    required: false,
    type: String,
    description: "Filter by price type ID",
  })
  @ApiResponse({
    status: 200,
    description: "Customer price relationships retrieved successfully",
    type: PaginatedCustomerPricesDto,
  })
  async findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("customerId") customerId?: string,
    @Query("priceTypeId") priceTypeId?: string
  ): Promise<PaginatedCustomerPricesDto> {
    return this.customerPricesService.findAll(
      page,
      limit,
      customerId,
      priceTypeId
    );
  }

  @Get("customer/:customerId")
  @ApiOperation({ summary: "Get all price types for a specific customer" })
  @ApiResponse({
    status: 200,
    description: "Customer price relationships retrieved successfully",
    type: [CustomerPriceDto],
  })
  @ApiResponse({ status: 404, description: "Customer not found" })
  async findByCustomerId(
    @Param("customerId") customerId: string
  ): Promise<CustomerPriceDto[]> {
    return this.customerPricesService.findByCustomerId(customerId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific customer price relationship" })
  @ApiResponse({
    status: 200,
    description: "Customer price relationship retrieved successfully",
    type: CustomerPriceDto,
  })
  @ApiResponse({
    status: 404,
    description: "Customer price relationship not found",
  })
  async findOne(@Param("id") id: string): Promise<CustomerPriceDto> {
    return this.customerPricesService.findOne(id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a customer price relationship" })
  @ApiResponse({
    status: 200,
    description: "Customer price relationship deleted successfully",
    type: DeleteCustomerPriceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Customer price relationship not found",
  })
  async remove(
    @Param("id") id: string
  ): Promise<DeleteCustomerPriceResponseDto> {
    return this.customerPricesService.remove(id);
  }

  @Delete("customer/:customerId/price-type/:priceTypeId")
  @ApiOperation({
    summary: "Delete a customer price relationship by customer and price type",
  })
  @ApiResponse({
    status: 200,
    description: "Customer price relationship deleted successfully",
    type: DeleteCustomerPriceResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: "Customer price relationship not found",
  })
  async removeByCustomerAndPriceType(
    @Param("customerId") customerId: string,
    @Param("priceTypeId") priceTypeId: string
  ): Promise<DeleteCustomerPriceResponseDto> {
    return this.customerPricesService.removeByCustomerAndPriceType(
      customerId,
      priceTypeId
    );
  }

  @Post("bulk")
  @ApiOperation({ summary: "Create multiple customer price relationships" })
  @ApiResponse({
    status: 201,
    description: "Customer price relationships created successfully",
    type: [CustomerPriceDto],
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Customer not found" })
  @ApiResponse({
    status: 409,
    description: "One or more relationships already exist",
  })
  async bulkCreate(
    @Body() body: { customerId: string; priceTypeIds: string[] },
    @Request() req: AuthenticatedRequest
  ): Promise<CustomerPriceDto[]> {
    return this.customerPricesService.bulkCreate(
      body.customerId,
      body.priceTypeIds,
      req.user?.id
    );
  }

  @Post("bulk-update")
  @ApiOperation({
    summary: "Update customer price relationships (replace all for a customer)",
  })
  @ApiResponse({
    status: 200,
    description: "Customer price relationships updated successfully",
    type: [CustomerPriceDto],
  })
  @ApiResponse({ status: 400, description: "Bad request" })
  @ApiResponse({ status: 404, description: "Customer not found" })
  async bulkUpdate(
    @Body() body: { customerId: string; priceTypeIds: string[] },
    @Request() req: AuthenticatedRequest
  ): Promise<CustomerPriceDto[]> {
    return this.customerPricesService.bulkUpdate(
      body.customerId,
      body.priceTypeIds,
      req.user?.id
    );
  }
}

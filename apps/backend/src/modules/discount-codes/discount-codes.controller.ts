import {
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
import { Permissions } from "../auth/decorators/permissions.decorator";
import { DiscountCodesService } from "./discount-codes.service";
import { CreateDiscountCodeDto } from "./dto/create-discount-code.dto";
import { DeleteDiscountCodeResponseDto } from "./dto/delete-discount-code-response.dto";
import { DiscountCodeDto } from "./dto/discount-code.dto";
import { PaginatedDiscountCodesDto } from "./dto/paginated-discount-codes.dto";
import { UpdateDiscountCodeDto } from "./dto/update-discount-code.dto";

@ApiTags("Discount Codes")
@Controller("discount-codes")
@ApiBearerAuth()
export class DiscountCodesController {
  constructor(private readonly discountCodesService: DiscountCodesService) {}

  @Post()
  @Permissions("discount_codes.create")
  @ApiOperation({ summary: "Create a new discount code" })
  @ApiResponse({
    status: 201,
    description: "Discount code created successfully",
    type: DiscountCodeDto,
  })
  @ApiResponse({
    status: 409,
    description: "Discount code with this code already exists",
  })
  create(
    @Body() createDiscountCodeDto: CreateDiscountCodeDto
  ): Promise<DiscountCodeDto> {
    return this.discountCodesService.create(createDiscountCodeDto);
  }

  @Get()
  @Permissions("discount_codes.read")
  @ApiOperation({
    summary: "Get all discount codes with pagination and search",
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
    description: "Items per page (default: 10)",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by code or name",
  })
  @ApiResponse({
    status: 200,
    description: "Discount codes retrieved successfully",
    type: PaginatedDiscountCodesDto,
  })
  findAll(
    @Query("page", new ParseIntPipe({ optional: true })) page?: number,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("search") search?: string
  ): Promise<PaginatedDiscountCodesDto> {
    return this.discountCodesService.findAll(page, limit, search);
  }

  @Get("validate/:code")
  @Permissions("discount_codes.read")
  @ApiOperation({
    summary: "Validate discount code for POS",
    description: "Validates a discount code for a customer and order amount",
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    type: String,
    description: "Customer ID to validate assignment",
  })
  @ApiQuery({
    name: "orderAmount",
    required: false,
    type: Number,
    description: "Order amount to validate minimum purchase",
  })
  @ApiResponse({
    status: 200,
    description: "Discount code validation result",
    schema: {
      type: "object",
      properties: {
        valid: { type: "boolean" },
        discountCode: { type: "object" },
        message: { type: "string" },
        calculatedDiscount: { type: "number" },
      },
    },
  })
  validateCode(
    @Param("code") code: string,
    @Query("customerId") customerId?: string,
    @Query("orderAmount") orderAmount?: number
  ): Promise<any> {
    return this.discountCodesService.validateCode(
      code,
      customerId,
      orderAmount
    );
  }

  @Get(":id")
  @Permissions("discount_codes.read")
  @ApiOperation({ summary: "Get discount code by ID" })
  @ApiResponse({
    status: 200,
    description: "Discount code retrieved successfully",
    type: DiscountCodeDto,
  })
  @ApiResponse({ status: 404, description: "Discount code not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<DiscountCodeDto> {
    return this.discountCodesService.findOne(id);
  }

  @Patch(":id")
  @Permissions("discount_codes.update")
  @ApiOperation({ summary: "Update discount code by ID" })
  @ApiResponse({
    status: 200,
    description: "Discount code updated successfully",
    type: DiscountCodeDto,
  })
  @ApiResponse({ status: 404, description: "Discount code not found" })
  @ApiResponse({
    status: 409,
    description: "Discount code with this code already exists",
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateDiscountCodeDto: UpdateDiscountCodeDto
  ): Promise<DiscountCodeDto> {
    return this.discountCodesService.update(id, updateDiscountCodeDto);
  }

  @Delete(":id")
  @Permissions("discount_codes.delete")
  @ApiOperation({ summary: "Delete discount code by ID" })
  @ApiResponse({
    status: 200,
    description: "Discount code deleted successfully",
    type: DeleteDiscountCodeResponseDto,
  })
  @ApiResponse({ status: 404, description: "Discount code not found" })
  remove(
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<DeleteDiscountCodeResponseDto> {
    return this.discountCodesService.remove(id);
  }
}

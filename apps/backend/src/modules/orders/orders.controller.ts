import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  Request,
  BadRequestException,
  Patch,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { OrderDto } from "./dto/order.dto";
import { PayInstallmentDto } from "./dto/pay-installment.dto";
import { PayOrderDto } from "./dto/pay-order.dto";
import { AnnulOrderItemDto } from "./dto/annul-order-item.dto";
import { BulkAnnulOrderItemsDto } from "./dto/bulk-annul-order-items.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";

@ApiTags("Orders")
@Controller("orders")
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Permissions("orders.create")
  @ApiOperation({
    summary: "Create a new order (POS)",
    description:
      "Creates a new order with stock validation, payment processing, and stock movement creation.",
  })
  @ApiResponse({
    status: 201,
    description: "Order created successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid order data or insufficient stock",
  })
  @ApiResponse({
    status: 404,
    description: "Branch, location, customer, or employee not found",
  })
  create(
    @Body() createOrderDto: CreateOrderDto,
    @Request() req: AuthenticatedRequest
  ): Promise<OrderDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.ordersService.create(createOrderDto, userId);
  }

  @Get()
  @Permissions("orders.read")
  @ApiOperation({
    summary: "Get all orders with optional filters",
    description:
      "Retrieves a paginated list of orders with optional filtering by order number.",
  })
  @ApiQuery({
    name: "orderNumber",
    required: false,
    type: String,
    description: "Filter by order number (partial match)",
  })
  @ApiQuery({
    name: "locationId",
    required: false,
    type: String,
    description: "Filter by location ID",
  })
  @ApiQuery({
    name: "startDate",
    required: false,
    type: String,
    description: "Filter by creation date from (inclusive, YYYY-MM-DD)",
  })
  @ApiQuery({
    name: "endDate",
    required: false,
    type: String,
    description: "Filter by creation date to (inclusive, YYYY-MM-DD)",
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
  @ApiResponse({
    status: 200,
    description: "Orders retrieved successfully",
  })
  findAll(
    @Query("orderNumber") orderNumber?: string,
    @Query("locationId") locationId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number
  ) {
    return this.ordersService.findAll({
      orderNumber,
      locationId,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get(":id")
  @Permissions("orders.read")
  @ApiOperation({
    summary: "Get an order by ID",
    description: "Retrieves a specific order by its ID with all related data.",
  })
  @ApiResponse({
    status: 200,
    description: "Order retrieved successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<OrderDto> {
    return this.ordersService.findOne(id);
  }

  @Patch(":id/annul")
  @Permissions("orders.annul")
  @ApiOperation({
    summary: "Annul an order",
    description:
      "Annuls an order by marking it as annulled, reverting stock movements, and decrementing discount code usage if applicable.",
  })
  @ApiResponse({
    status: 200,
    description: "Order annulled successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Order is already annulled",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  annul(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<OrderDto> {
    const userId = req.user?.id;
    return this.ordersService.annul(id, userId);
  }

  @Patch(":id/approve")
  @Permissions("orders.update")
  @ApiOperation({
    summary: "Approve a pending order",
    description:
      "Approves a pending order by creating stock movements, incrementing discount code usage, and updating credit status if applicable.",
  })
  @ApiResponse({
    status: 200,
    description: "Order approved successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Order cannot be approved (not pending or already approved)",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  approve(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<OrderDto> {
    const userId = req.user?.id;
    return this.ordersService.approve(id, userId);
  }

  @Post(":id/installments/:installmentId/pay")
  @Permissions("orders.update")
  @ApiOperation({
    summary: "Pay a credit installment",
    description: "Processes payment for a specific credit installment.",
  })
  @ApiResponse({
    status: 200,
    description: "Installment paid successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid payment amount or installment already paid",
  })
  @ApiResponse({
    status: 404,
    description: "Order or installment not found",
  })
  payInstallment(
    @Param("id", ParseUUIDPipe) orderId: string,
    @Param("installmentId", ParseUUIDPipe) installmentId: string,
    @Body() dto: PayInstallmentDto,
    @Request() req: AuthenticatedRequest
  ): Promise<OrderDto> {
    const userId = req.user?.id;
    // Ensure the installmentId in DTO matches the path parameter
    dto.installmentId = installmentId;
    return this.ordersService.payInstallment(dto, userId);
  }

  @Post(":id/pay")
  @Permissions("orders.update")
  @ApiOperation({
    summary: "Pay entire order (all pending installments)",
    description:
      "Processes payment for all pending, partial, and overdue installments of a credit order.",
  })
  @ApiResponse({
    status: 200,
    description: "Order paid successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid payment amount or order does not have credit",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  payOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PayOrderDto,
    @Request() req: AuthenticatedRequest
  ): Promise<OrderDto> {
    const userId = req.user?.id;
    return this.ordersService.payOrder(id, dto, userId);
  }

  @Post(":orderId/items/:orderItemId/annul")
  @Permissions("orders.annul")
  @ApiOperation({
    summary: "Partially annul an order item",
    description:
      "Partially annuls one or more items from an order. Reverses inventory, adjusts financials, and updates credit balances if applicable.",
  })
  @ApiResponse({
    status: 200,
    description: "Order item annulled successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid annulment request (e.g., quantity exceeds remaining)",
  })
  @ApiResponse({
    status: 404,
    description: "Order or order item not found",
  })
  annulOrderItem(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Param("orderItemId", ParseUUIDPipe) orderItemId: string,
    @Body() dto: AnnulOrderItemDto,
    @Request() req: AuthenticatedRequest
  ): Promise<OrderDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.ordersService.annulOrderItem(orderId, orderItemId, dto, userId);
  }

  @Post(":orderId/items/bulk-annul")
  @Permissions("orders.annul")
  @ApiOperation({
    summary: "Bulk annul order items",
    description:
      "Annuls multiple order items at once. Reverses inventory, adjusts financials, and updates credit balances if applicable.",
  })
  @ApiResponse({
    status: 200,
    description: "Order items annulled successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid annulment request (e.g., quantity exceeds remaining)",
  })
  @ApiResponse({
    status: 404,
    description: "Order or order items not found",
  })
  bulkAnnulOrderItems(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: BulkAnnulOrderItemsDto,
    @Request() req: AuthenticatedRequest
  ): Promise<OrderDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.ordersService.bulkAnnulOrderItems(orderId, dto, userId);
  }
}

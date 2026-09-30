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
import { StockTransfersService } from "./stock-transfers.service";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { UpdateTransferStatusDto } from "./dto/update-transfer-status.dto";
import { DispatchTransferDto } from "./dto/dispatch-transfer.dto";
import { ReceiveTransferDto } from "./dto/receive-transfer.dto";
import { StockTransferDto } from "./dto/stock-transfer.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";
import { TransferStatus } from "@prisma/client";

@ApiTags("Stock Transfers")
@Controller("stock-transfers")
@ApiBearerAuth()
export class StockTransfersController {
  constructor(private readonly stockTransfersService: StockTransfersService) {}

  @Post()
  @Permissions("stock-transfers.create")
  @ApiOperation({
    summary: "Create a new stock transfer request",
    description:
      "Creates a new stock transfer request with items. Status will be CREATED.",
  })
  @ApiResponse({
    status: 201,
    description: "Transfer created successfully",
    type: StockTransferDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid transfer data or insufficient stock",
  })
  @ApiResponse({
    status: 404,
    description: "Location, product, or user not found",
  })
  create(
    @Body() createDto: CreateTransferDto,
    @Request() req: AuthenticatedRequest
  ): Promise<StockTransferDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.stockTransfersService.create(createDto, userId);
  }

  @Get()
  @Permissions("stock-transfers.read")
  @ApiOperation({
    summary: "Get all stock transfers with optional filters",
    description: "Retrieves a paginated list of stock transfers.",
  })
  @ApiQuery({
    name: "status",
    required: false,
    enum: TransferStatus,
    description: "Filter by status",
  })
  @ApiQuery({
    name: "fromLocationId",
    required: false,
    type: String,
    description: "Filter by source location ID",
  })
  @ApiQuery({
    name: "toLocationId",
    required: false,
    type: String,
    description: "Filter by destination location ID",
  })
  @ApiQuery({
    name: "trackingNumber",
    required: false,
    type: String,
    description: "Filter by tracking number (partial match)",
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
    description: "Transfers retrieved successfully",
  })
  findAll(
    @Query("status") status?: TransferStatus,
    @Query("fromLocationId") fromLocationId?: string,
    @Query("toLocationId") toLocationId?: string,
    @Query("trackingNumber") trackingNumber?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number
  ) {
    return this.stockTransfersService.findAll({
      status,
      fromLocationId,
      toLocationId,
      trackingNumber,
      page,
      limit,
    });
  }

  @Get(":id")
  @Permissions("stock-transfers.read")
  @ApiOperation({
    summary: "Get a stock transfer by ID",
    description:
      "Retrieves a specific stock transfer by its ID with all related data.",
  })
  @ApiResponse({
    status: 200,
    description: "Transfer retrieved successfully",
    type: StockTransferDto,
  })
  @ApiResponse({
    status: 404,
    description: "Transfer not found",
  })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<StockTransferDto> {
    return this.stockTransfersService.findOne(id);
  }

  @Patch(":id/status")
  @Permissions("stock-transfers.update")
  @ApiOperation({
    summary: "Update transfer status",
    description:
      "Updates the status of a transfer (e.g., CREATED -> ACCEPTED, ACCEPTED -> DISPATCHING).",
  })
  @ApiResponse({
    status: 200,
    description: "Status updated successfully",
    type: StockTransferDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid state transition",
  })
  @ApiResponse({
    status: 404,
    description: "Transfer not found",
  })
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTransferStatusDto,
    @Request() req: AuthenticatedRequest
  ): Promise<StockTransferDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.stockTransfersService.updateStatus(id, updateDto, userId);
  }

  @Post(":id/dispatch")
  @Permissions("stock-transfers.update")
  @ApiOperation({
    summary: "Dispatch transfer",
    description:
      "Marks transfer as dispatched (DISPATCHING -> IN_TRANSIT). Creates stock movements and updates quantities sent.",
  })
  @ApiResponse({
    status: 200,
    description: "Transfer dispatched successfully",
    type: StockTransferDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid dispatch data or insufficient stock",
  })
  @ApiResponse({
    status: 404,
    description: "Transfer not found",
  })
  dispatch(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dispatchDto: DispatchTransferDto,
    @Request() req: AuthenticatedRequest
  ): Promise<StockTransferDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.stockTransfersService.dispatch(id, dispatchDto, userId);
  }

  @Post(":id/receive")
  @Permissions("stock-transfers.update")
  @ApiOperation({
    summary: "Receive transfer",
    description:
      "Marks transfer as received (IN_TRANSIT -> RECEIVED_COMPLETE | RECEIVED_PARTIAL). Creates stock movements and handles discrepancies.",
  })
  @ApiResponse({
    status: 200,
    description: "Transfer received successfully",
    type: StockTransferDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid receive data or missing discrepancy information",
  })
  @ApiResponse({
    status: 404,
    description: "Transfer not found",
  })
  receive(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() receiveDto: ReceiveTransferDto,
    @Request() req: AuthenticatedRequest
  ): Promise<StockTransferDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.stockTransfersService.receive(id, receiveDto, userId);
  }

  @Post(":id/cancel")
  @Permissions("stock-transfers.cancel")
  @ApiOperation({
    summary: "Cancel transfer",
    description:
      "Cancels a transfer. Only allowed when status is CREATED or ACCEPTED.",
  })
  @ApiResponse({
    status: 200,
    description: "Transfer cancelled successfully",
    type: StockTransferDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Transfer cannot be cancelled (already in transit or received)",
  })
  @ApiResponse({
    status: 404,
    description: "Transfer not found",
  })
  cancel(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<StockTransferDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.stockTransfersService.cancel(id, userId);
  }
}

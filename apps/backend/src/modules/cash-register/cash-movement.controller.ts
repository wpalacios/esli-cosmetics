import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  Request,
  BadRequestException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { CashMovementService } from "./cash-movement.service";
import { CreateCashMovementDto } from "./dto/create-cash-movement.dto";
import { CashMovementDto } from "./dto/cash-movement.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";

@ApiTags("Cash Movements")
@Controller("cash-movements")
@ApiBearerAuth()
export class CashMovementController {
  constructor(private readonly cashMovementService: CashMovementService) {}

  @Post()
  @Permissions("cash_movements.create")
  @ApiOperation({ summary: "Create a new cash movement" })
  @ApiResponse({
    status: 201,
    description: "Cash movement created",
    type: CashMovementDto,
  })
  create(
    @Body() createDto: CreateCashMovementDto,
    @Request() req: AuthenticatedRequest
  ): Promise<CashMovementDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.cashMovementService.create(createDto, userId);
  }

  @Get()
  @Permissions("cash_movements.view")
  @ApiOperation({ summary: "Get all cash movements" })
  @ApiQuery({ name: "cashSessionId", required: false })
  @ApiQuery({ name: "type", required: false, enum: ["IN", "OUT"] })
  @ApiResponse({
    status: 200,
    description: "List of cash movements",
    type: [CashMovementDto],
  })
  findAll(
    @Query("cashSessionId") cashSessionId?: string,
    @Query("type") type?: string
  ): Promise<CashMovementDto[]> {
    return this.cashMovementService.findAll({
      cashSessionId,
      type,
    });
  }

  @Get(":id")
  @Permissions("cash_movements.view")
  @ApiOperation({ summary: "Get a cash movement by ID" })
  @ApiResponse({
    status: 200,
    description: "Cash movement found",
    type: CashMovementDto,
  })
  @ApiResponse({ status: 404, description: "Cash movement not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<CashMovementDto> {
    return this.cashMovementService.findOne(id);
  }
}

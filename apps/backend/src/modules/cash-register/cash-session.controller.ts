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
import { CashSessionService } from "./cash-session.service";
import { OpenCashSessionDto } from "./dto/open-cash-session.dto";
import { CloseCashSessionDto } from "./dto/close-cash-session.dto";
import { CashSessionDto } from "./dto/cash-session.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";

@ApiTags("Cash Sessions")
@Controller("cash-sessions")
@ApiBearerAuth()
export class CashSessionController {
  constructor(private readonly cashSessionService: CashSessionService) {}

  @Post("open")
  @Permissions("cash_sessions.open")
  @ApiOperation({ summary: "Open a new cash session" })
  @ApiResponse({
    status: 201,
    description: "Cash session opened",
    type: CashSessionDto,
  })
  async openSession(
    @Body() openDto: OpenCashSessionDto,
    @Request() req: AuthenticatedRequest
  ): Promise<CashSessionDto> {
    // Try to get employee ID from request body first, then from authenticated user
    const employeeId = openDto.employeeId || req.user?.employee?.id;
    if (!employeeId) {
      throw new BadRequestException("Employee ID is required");
    }
    const roles = req.user?.roles || [];
    return this.cashSessionService.openSession(openDto, employeeId, roles);
  }

  @Post(":id/close")
  @Permissions("cash_sessions.close")
  @ApiOperation({ summary: "Close a cash session" })
  @ApiResponse({
    status: 200,
    description: "Cash session closed",
    type: CashSessionDto,
  })
  async closeSession(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() closeDto: CloseCashSessionDto,
    @Request() req: AuthenticatedRequest
  ): Promise<CashSessionDto> {
    const employeeId = req.user?.employee?.id;
    const roles = req.user?.roles || [];
    if (!employeeId) {
      throw new BadRequestException("Employee ID is required");
    }
    return this.cashSessionService.closeSession(
      id,
      closeDto,
      employeeId,
      roles
    );
  }

  @Get("current")
  @Permissions("cash_sessions.view")
  @ApiOperation({
    summary: "Get current open session for the logged-in employee",
  })
  @ApiResponse({
    status: 200,
    description: "Current session",
    type: CashSessionDto,
  })
  async getCurrentSession(
    @Request() req: AuthenticatedRequest
  ): Promise<CashSessionDto | null> {
    const employeeId = req.user?.employee?.id;
    const roles = req.user?.roles || [];
    if (!employeeId) {
      throw new BadRequestException("Employee ID is required");
    }
    return this.cashSessionService.getCurrentSession(employeeId, roles);
  }

  @Get()
  @Permissions("cash_sessions.view")
  @ApiOperation({ summary: "Get all cash sessions" })
  @ApiQuery({ name: "cashRegisterId", required: false })
  @ApiQuery({ name: "employeeId", required: false })
  @ApiQuery({ name: "status", required: false, enum: ["open", "closed"] })
  @ApiQuery({ name: "locationId", required: false })
  @ApiQuery({ name: "closedBy", required: false })
  @ApiResponse({
    status: 200,
    description: "List of cash sessions",
    type: [CashSessionDto],
  })
  findAll(
    @Query("cashRegisterId") cashRegisterId?: string,
    @Query("employeeId") employeeId?: string,
    @Query("status") status?: string,
    @Query("locationId") locationId?: string,
    @Query("closedBy") closedBy?: string
  ): Promise<CashSessionDto[]> {
    return this.cashSessionService.findAll({
      cashRegisterId,
      employeeId,
      closedBy,
      status,
      locationId,
    });
  }

  @Get(":id")
  @Permissions("cash_sessions.view")
  @ApiOperation({ summary: "Get a cash session by ID" })
  @ApiResponse({
    status: 200,
    description: "Cash session found",
    type: CashSessionDto,
  })
  @ApiResponse({ status: 404, description: "Cash session not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<CashSessionDto> {
    return this.cashSessionService.findOne(id);
  }
}

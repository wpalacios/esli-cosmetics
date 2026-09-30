import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { CashRegisterService } from "./cash-register.service";
import { CashRegisterDto } from "./dto/cash-register.dto";
import { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";

@ApiTags("Cash Registers")
@Controller("cash-registers")
@ApiBearerAuth()
export class CashRegisterController {
  constructor(private readonly cashRegisterService: CashRegisterService) {}

  @Post()
  @Permissions("cash_registers.create")
  @ApiOperation({ summary: "Create a new cash register" })
  @ApiResponse({
    status: 201,
    description: "Cash register created",
    type: CashRegisterDto,
  })
  create(@Body() createDto: CreateCashRegisterDto): Promise<CashRegisterDto> {
    return this.cashRegisterService.create(createDto);
  }

  @Get()
  @Permissions("cash_registers.view")
  @ApiOperation({ summary: "Get all cash registers" })
  @ApiQuery({ name: "locationId", required: false })
  @ApiQuery({ name: "isActive", required: false, type: Boolean })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: "List of cash registers with pagination",
  })
  async findAll(
    @Query("locationId") locationId?: string,
    @Query("isActive") isActive?: string,
    @Query("search") search?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string
  ) {
    const result = await this.cashRegisterService.findAll({
      locationId,
      isActive:
        isActive === "true" ? true : isActive === "false" ? false : undefined,
      search,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    // Return in the format expected by the frontend
    return {
      data: result.data,
      pagination: result.pagination,
    };
  }

  @Get(":id")
  @Permissions("cash_registers.view")
  @ApiOperation({ summary: "Get a cash register by ID" })
  @ApiResponse({
    status: 200,
    description: "Cash register found",
    type: CashRegisterDto,
  })
  @ApiResponse({ status: 404, description: "Cash register not found" })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<CashRegisterDto> {
    return this.cashRegisterService.findOne(id);
  }

  @Patch(":id")
  @Permissions("cash_registers.update")
  @ApiOperation({ summary: "Update a cash register" })
  @ApiResponse({
    status: 200,
    description: "Cash register updated",
    type: CashRegisterDto,
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateCashRegisterDto
  ): Promise<CashRegisterDto> {
    return this.cashRegisterService.update(id, updateDto);
  }

  @Delete(":id")
  @Permissions("cash_registers.delete")
  @ApiOperation({ summary: "Delete a cash register" })
  @ApiResponse({ status: 200, description: "Cash register deleted" })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.cashRegisterService.remove(id);
  }
}

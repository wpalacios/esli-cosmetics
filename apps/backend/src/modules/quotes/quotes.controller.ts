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
  Request,
  BadRequestException,
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
import { QuotesService } from "./quotes.service";
import { CreateQuoteDto } from "./dto/create-quote.dto";
import { UpdateQuoteDto } from "./dto/update-quote.dto";
import { QuoteDto, PaginatedQuotesDto } from "./dto/quote.dto";
import { ConvertQuoteToOrderDto } from "./dto/convert-quote-to-order.dto";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";

@ApiTags("Quotes")
@Controller("quotes")
@ApiBearerAuth()
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @Permissions("quotes.create")
  @ApiOperation({
    summary: "Create a new quote",
    description:
      "Creates a new quote. Quotes do NOT affect inventory or create payments.",
  })
  @ApiResponse({
    status: 201,
    description: "Quote created successfully",
    type: QuoteDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid quote data",
  })
  @ApiResponse({
    status: 404,
    description: "Branch, location, customer, or employee not found",
  })
  create(
    @Body() createQuoteDto: CreateQuoteDto,
    @Request() req: AuthenticatedRequest
  ): Promise<QuoteDto> {
    const userId = req.user?.id;

    return this.quotesService.create(createQuoteDto, userId);
  }

  @Get()
  @Permissions("quotes.read")
  @ApiOperation({
    summary: "Get all quotes with optional filters",
    description:
      "Retrieves a paginated list of quotes with optional filtering.",
  })
  @ApiQuery({
    name: "quoteNumber",
    required: false,
    type: String,
    description: "Filter by quote number (partial match)",
  })
  @ApiQuery({
    name: "status",
    required: false,
    type: String,
    description: "Filter by status (DRAFT, APPROVED, EXPIRED, CONVERTED)",
  })
  @ApiQuery({
    name: "customerId",
    required: false,
    type: String,
    description: "Filter by customer ID",
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
    description: "Quotes retrieved successfully",
    type: PaginatedQuotesDto,
  })
  findAll(
    @Query("quoteNumber") quoteNumber?: string,
    @Query("status") status?: string,
    @Query("customerId") customerId?: string,
    @Query("locationId") locationId?: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit?: number
  ): Promise<PaginatedQuotesDto> {
    return this.quotesService.findAll({
      quoteNumber,
      status,
      customerId,
      locationId,
      startDate,
      endDate,
      page,
      limit,
    });
  }

  @Get(":id")
  @Permissions("quotes.read")
  @ApiOperation({
    summary: "Get a quote by ID",
    description: "Retrieves a specific quote by its ID with all related data.",
  })
  @ApiResponse({
    status: 200,
    description: "Quote retrieved successfully",
    type: QuoteDto,
  })
  @ApiResponse({
    status: 404,
    description: "Quote not found",
  })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<QuoteDto> {
    return this.quotesService.findOne(id);
  }

  @Patch(":id")
  @Permissions("quotes.update")
  @ApiOperation({
    summary: "Update a quote",
    description: "Updates a quote. Cannot update converted quotes.",
  })
  @ApiResponse({
    status: 200,
    description: "Quote updated successfully",
    type: QuoteDto,
  })
  @ApiResponse({
    status: 400,
    description: "Cannot update converted quote",
  })
  @ApiResponse({
    status: 404,
    description: "Quote not found",
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateQuoteDto: UpdateQuoteDto,
    @Request() req: AuthenticatedRequest
  ): Promise<QuoteDto> {
    const userId = req.user?.id;
    return this.quotesService.update(id, updateQuoteDto, userId);
  }

  @Post(":id/approve")
  @Permissions("quotes.update")
  @ApiOperation({
    summary: "Approve a quote (DRAFT → APPROVED)",
    description:
      "Approves a quote in DRAFT status, reserves inventory, and sets approval timestamps. Only DRAFT quotes can be approved.",
  })
  @ApiResponse({
    status: 200,
    description: "Quote approved successfully",
    type: QuoteDto,
  })
  @ApiResponse({
    status: 400,
    description: "Quote must be in DRAFT status or userId missing",
  })
  @ApiResponse({
    status: 404,
    description: "Quote not found",
  })
  async approveQuote(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<QuoteDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("UserId is required for approval.");
    }
    return this.quotesService.approveQuote(id, userId);
  }

  @Post(":id/annul")
  @Permissions("quotes.update")
  @ApiOperation({
    summary: "Annul a quote (DRAFT/APPROVED → ANNULLED)",
    description:
      "Annuls a quote, records the auditor, and releases reserved inventory if the quote was in APPROVED status.",
  })
  @ApiResponse({
    status: 200,
    description: "Quote annulled successfully",
    type: QuoteDto,
  })
  @ApiResponse({
    status: 400,
    description:
      "Quote cannot be annulled (already converted or invalid status)",
  })
  @ApiResponse({
    status: 404,
    description: "Quote not found",
  })
  async annulQuote(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: AuthenticatedRequest
  ): Promise<QuoteDto> {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("UserId is required to annul a quote.");
    }
    return this.quotesService.annulQuote(id, userId);
  }

  @Post(":id/convert-to-order")
  @Permissions("quotes.convert")
  @ApiOperation({
    summary: "Convert a quote to an order",
    description:
      "Converts a quote to an order. This will create an order, deduct stock, create payments, and mark the quote as CONVERTED.",
  })
  @ApiResponse({
    status: 201,
    description: "Quote converted to order successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Quote cannot be converted (already converted or expired)",
  })
  @ApiResponse({
    status: 404,
    description: "Quote not found",
  })
  convertToOrder(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() convertDto: ConvertQuoteToOrderDto,
    @Request() req: AuthenticatedRequest
  ) {
    const userId = req.user?.id;
    if (!userId) {
      throw new BadRequestException("User ID is required");
    }
    return this.quotesService.convertToOrder(id, convertDto, userId);
  }

  @Delete(":id")
  @Permissions("quotes.delete")
  @ApiOperation({
    summary: "Delete a quote",
    description: "Soft deletes a quote. Cannot delete converted quotes.",
  })
  @ApiResponse({
    status: 200,
    description: "Quote deleted successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Cannot delete converted quote",
  })
  @ApiResponse({
    status: 404,
    description: "Quote not found",
  })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.quotesService.remove(id);
  }
}

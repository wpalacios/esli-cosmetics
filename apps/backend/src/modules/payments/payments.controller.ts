import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthenticatedRequest } from "../auth/interfaces/user.interface";
import { PaymentsService } from "./payments.service";
import { ReversePaymentDto } from "./dto/reverse-payment.dto";
import { ManualPaymentReversalDto } from "./dto/manual-payment-reversal.dto";

@ApiTags("Payments")
@Controller("payments")
@ApiBearerAuth()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(":id/allocate")
  @Permissions("orders.update")
  @ApiOperation({
    summary: "Allocate payment to credit installments",
    description:
      "Allocates an existing payment to credit installments using waterfall logic. Payment must be linked to a credit, order with credit, or customer.",
  })
  @ApiResponse({
    status: 200,
    description: "Payment allocated successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid payment or payment already allocated",
  })
  @ApiResponse({
    status: 404,
    description: "Payment not found",
  })
  async allocatePayment(@Param("id", ParseUUIDPipe) paymentId: string) {
    return this.paymentsService.allocatePayment(paymentId);
  }

  @Post(":id/reverse")
  @Permissions("orders.update")
  @ApiOperation({
    summary: "Reverse a payment automatically",
    description:
      "Reverses a posted payment using stored payment allocations. Legacy payments without allocations are rejected and must use manual reversal.",
  })
  async reversePayment(
    @Param("id", ParseUUIDPipe) paymentId: string,
    @Body() dto: ReversePaymentDto,
    @Request() req: AuthenticatedRequest
  ) {
    const userId = req.user?.id;
    return this.paymentsService.reversePayment(paymentId, dto, userId);
  }

  @Post(":id/manual-reversal")
  @Permissions("orders.update")
  @ApiOperation({
    summary: "Manual accounting reversal for legacy payments",
    description:
      "Manually reverses a payment by specifying allocation entries (opening balance and/or installments).",
  })
  async manualReversePayment(
    @Param("id", ParseUUIDPipe) paymentId: string,
    @Body() dto: ManualPaymentReversalDto,
    @Request() req: AuthenticatedRequest
  ) {
    const userId = req.user?.id;
    return this.paymentsService.manualReversePayment(paymentId, dto, userId);
  }
}

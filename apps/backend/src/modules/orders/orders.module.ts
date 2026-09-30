import { Module } from "@nestjs/common";
import { OrdersService } from "./orders.service";
import { OrdersController } from "./orders.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { PaymentsModule } from "../payments/payments.module";
import { NumberSequenceModule } from "../number-sequence/number-sequence.module";

@Module({
  imports: [
    PrismaModule,
    StockMovementsModule,
    PaymentsModule,
    NumberSequenceModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

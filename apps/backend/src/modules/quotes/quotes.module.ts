import { Module } from "@nestjs/common";
import { QuotesService } from "./quotes.service";
import { QuotesController } from "./quotes.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { OrdersModule } from "../orders/orders.module";
import { NumberSequenceModule } from "../number-sequence/number-sequence.module";

@Module({
  imports: [PrismaModule, OrdersModule, NumberSequenceModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}

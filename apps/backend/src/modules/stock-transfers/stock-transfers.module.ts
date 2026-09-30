import { Module } from "@nestjs/common";
import { StockTransfersService } from "./stock-transfers.service";
import { StockTransfersController } from "./stock-transfers.controller";
import { StockMovementsModule } from "../stock-movements/stock-movements.module";
import { NumberSequenceModule } from "../number-sequence/number-sequence.module";

@Module({
  imports: [StockMovementsModule, NumberSequenceModule],
  providers: [StockTransfersService],
  controllers: [StockTransfersController],
  exports: [StockTransfersService],
})
export class StockTransfersModule {}

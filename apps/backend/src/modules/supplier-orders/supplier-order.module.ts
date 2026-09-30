import { Module } from "@nestjs/common";
import { SupplierOrderService } from "./supplier-order.service";
import { SupplierOrderController } from "./supplier-order.controller";
import { StockLevelsModule } from "../stock-levels/stock-levels.module";

@Module({
  imports: [StockLevelsModule],
  providers: [SupplierOrderService],
  controllers: [SupplierOrderController],
  exports: [SupplierOrderService],
})
export class SupplierOrderModule {}

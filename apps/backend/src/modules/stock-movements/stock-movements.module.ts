import { Module, forwardRef } from "@nestjs/common";
import { StockMovementsService } from "./stock-movements.service";
import { StockMovementsController } from "./stock-movements.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { StockLevelsModule } from "../stock-levels/stock-levels.module";
import { ProductVariantsModule } from "../product-variants/product-variants.module";

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => StockLevelsModule),
    ProductVariantsModule,
  ],
  providers: [StockMovementsService],
  controllers: [StockMovementsController],
  exports: [StockMovementsService],
})
export class StockMovementsModule {}

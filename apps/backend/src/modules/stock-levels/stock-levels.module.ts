import { Module, forwardRef } from "@nestjs/common";
import { StockLevelsService } from "./stock-levels.service";
import { StockLevelsController } from "./stock-levels.controller";
import { StockLevelNotificationService } from "./stock-level-notification.service";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { NotificationModule } from "../notifications/notification.module";

@Module({
  imports: [PrismaModule, forwardRef(() => NotificationModule)],
  providers: [StockLevelsService, StockLevelNotificationService],
  controllers: [StockLevelsController],
  exports: [StockLevelsService, StockLevelNotificationService],
})
export class StockLevelsModule {}

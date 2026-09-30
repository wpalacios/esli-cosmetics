import { Module } from "@nestjs/common";
import { CashRegisterService } from "./cash-register.service";
import { CashSessionService } from "./cash-session.service";
import { CashMovementService } from "./cash-movement.service";
import { CashRegisterController } from "./cash-register.controller";
import { CashSessionController } from "./cash-session.controller";
import { CashMovementController } from "./cash-movement.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [
    CashRegisterController,
    CashSessionController,
    CashMovementController,
  ],
  providers: [CashRegisterService, CashSessionService, CashMovementService],
  exports: [CashRegisterService, CashSessionService, CashMovementService],
})
export class CashRegisterModule {}

import { Module } from "@nestjs/common";
import { DiscountCodesService } from "./discount-codes.service";
import { DiscountCodesController } from "./discount-codes.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [DiscountCodesController],
  providers: [DiscountCodesService],
  exports: [DiscountCodesService],
})
export class DiscountCodesModule {}

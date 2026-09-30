import { Module } from "@nestjs/common";
import { CustomerPricesService } from "./customer-prices.service";
import { CustomerPricesController } from "./customer-prices.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [CustomerPricesController],
  providers: [CustomerPricesService],
  exports: [CustomerPricesService],
})
export class CustomerPricesModule {}

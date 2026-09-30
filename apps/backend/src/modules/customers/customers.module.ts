import { Module } from "@nestjs/common";
import { CustomersService } from "./customers.service";
import { CustomersController } from "./customers.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";
import { PaymentsModule } from "../payments/payments.module";

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}

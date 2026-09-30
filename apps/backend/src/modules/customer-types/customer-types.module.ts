import { Module } from "@nestjs/common";
import { CustomerTypesService } from "./customer-types.service";
import { CustomerTypesController } from "./customer-types.controller";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [CustomerTypesController],
  providers: [CustomerTypesService],
  exports: [CustomerTypesService],
})
export class CustomerTypesModule {}

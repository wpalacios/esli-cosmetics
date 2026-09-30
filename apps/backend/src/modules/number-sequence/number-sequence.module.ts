import { Module } from "@nestjs/common";
import { NumberSequenceService } from "./number-sequence.service";
import { PrismaModule } from "../../common/prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  providers: [NumberSequenceService],
  exports: [NumberSequenceService],
})
export class NumberSequenceModule {}

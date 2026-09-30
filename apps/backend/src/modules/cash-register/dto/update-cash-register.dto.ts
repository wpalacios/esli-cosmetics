import { PartialType } from "@nestjs/swagger";
import { CreateCashRegisterDto } from "./create-cash-register.dto";

export class UpdateCashRegisterDto extends PartialType(CreateCashRegisterDto) {}

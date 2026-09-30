import { PartialType } from "@nestjs/mapped-types";
import { CreateTaxRateDto } from "./create-tax-rates.dto";

export class UpdateTaxRateDto extends PartialType(CreateTaxRateDto) {}

import { CreatePriceDto } from "./create-price.dto";
import { PartialType } from "@nestjs/mapped-types";

export class UpdatePriceDto extends PartialType(CreatePriceDto) {}

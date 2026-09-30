import {
  IsArray,
  IsUUID,
  ValidateNested,
  IsNumber,
  Min,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";

class ImageOrderItemDto {
  @IsUUID()
  id: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  sortOrder: number;
}

export class ReorderProductVariantImagesDto {
  @ApiProperty({ type: [ImageOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageOrderItemDto)
  images: ImageOrderItemDto[];
}

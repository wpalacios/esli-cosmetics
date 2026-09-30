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

export class ReorderProductImagesDto {
  @ApiProperty({
    type: [ImageOrderItemDto],
    example: [
      { id: "uuid-1", sortOrder: 0 },
      { id: "uuid-2", sortOrder: 1 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImageOrderItemDto)
  images: ImageOrderItemDto[];
}

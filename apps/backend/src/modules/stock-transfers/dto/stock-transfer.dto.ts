import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TransferStatus } from "@prisma/client";

export class StockTransferItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  transferId: string;

  @ApiProperty()
  productId: string;

  @ApiPropertyOptional()
  productVariantId?: string;

  @ApiProperty()
  quantityRequested: number;

  @ApiPropertyOptional()
  quantitySent?: number;

  @ApiPropertyOptional()
  quantityReceived?: number;

  @ApiPropertyOptional()
  product?: any;

  @ApiPropertyOptional()
  productVariant?: any;
}

export class StockTransferLogDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  transferId: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: TransferStatus })
  previousStatus: TransferStatus;

  @ApiProperty({ enum: TransferStatus })
  newStatus: TransferStatus;

  @ApiProperty()
  note: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  user?: any;
}

export class StockTransferDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  trackingNumber: string;

  @ApiProperty({ enum: TransferStatus })
  status: TransferStatus;

  @ApiProperty()
  fromLocationId: string;

  @ApiProperty()
  toLocationId: string;

  @ApiProperty()
  createdById: string;

  @ApiPropertyOptional()
  senderId?: string;

  @ApiPropertyOptional()
  receiverId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  dispatchedAt?: Date;

  @ApiPropertyOptional()
  receivedAt?: Date;

  @ApiProperty({ type: [StockTransferItemDto] })
  items: StockTransferItemDto[];

  @ApiProperty({ type: [StockTransferLogDto] })
  logs: StockTransferLogDto[];

  @ApiPropertyOptional()
  fromLocation?: any;

  @ApiPropertyOptional()
  toLocation?: any;

  @ApiPropertyOptional()
  createdBy?: any;

  @ApiPropertyOptional()
  sender?: any;

  @ApiPropertyOptional()
  receiver?: any;

  @ApiPropertyOptional()
  movements?: any[];
}

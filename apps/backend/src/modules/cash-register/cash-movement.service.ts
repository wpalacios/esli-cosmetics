import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateCashMovementDto } from "./dto/create-cash-movement.dto";
import { CashMovementDto } from "./dto/cash-movement.dto";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class CashMovementService {
  private readonly logger = new Logger(CashMovementService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    createDto: CreateCashMovementDto,
    userId?: string
  ): Promise<CashMovementDto> {
    this.logger.log(
      `Creating cash movement: ${createDto.type} - ${createDto.amount}`
    );

    // Validate session exists and is open
    const session = await this.prisma.cashSession.findUnique({
      where: { id: createDto.cashSessionId },
    });

    if (!session) {
      throw new NotFoundException(
        `Cash session with ID ${createDto.cashSessionId} not found`
      );
    }

    if (session.status !== "open") {
      throw new BadRequestException(
        "Cash session must be open to create movements"
      );
    }

    // Validate reference order if provided
    if (createDto.referenceOrderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: createDto.referenceOrderId },
      });

      if (!order) {
        throw new NotFoundException(
          `Order with ID ${createDto.referenceOrderId} not found`
        );
      }
    }

    const movement = await this.prisma.cashMovement.create({
      data: {
        cashSessionId: createDto.cashSessionId,
        type: createDto.type,
        amount: new Decimal(createDto.amount),
        reason: createDto.reason,
        referenceOrderId: createDto.referenceOrderId,
        createdBy: userId,
      },
    });

    this.logger.log(`Cash movement created: ${movement.id}`);
    return this.mapToDto(movement);
  }

  async findAll(filters?: {
    cashSessionId?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<CashMovementDto[]> {
    const where: any = {};

    if (filters?.cashSessionId) {
      where.cashSessionId = filters.cashSessionId;
    }

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.startDate || filters?.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const movements = await this.prisma.cashMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return movements.map(m => this.mapToDto(m));
  }

  async findOne(id: string): Promise<CashMovementDto> {
    const movement = await this.prisma.cashMovement.findUnique({
      where: { id },
    });

    if (!movement) {
      throw new NotFoundException(`Cash movement with ID ${id} not found`);
    }

    return this.mapToDto(movement);
  }

  private mapToDto(movement: any): CashMovementDto {
    return {
      id: movement.id,
      cashSessionId: movement.cashSessionId,
      type: movement.type,
      amount: Number(movement.amount),
      reason: movement.reason,
      referenceOrderId: movement.referenceOrderId,
      createdBy: movement.createdBy,
      createdAt: movement.createdAt,
    };
  }
}

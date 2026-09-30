import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateCashRegisterDto } from "./dto/create-cash-register.dto";
import { UpdateCashRegisterDto } from "./dto/update-cash-register.dto";
import { CashRegisterDto } from "./dto/cash-register.dto";

@Injectable()
export class CashRegisterService {
  private readonly logger = new Logger(CashRegisterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(createDto: CreateCashRegisterDto): Promise<CashRegisterDto> {
    this.logger.log(`Creating cash register: ${createDto.name}`);

    // check if location is provided
    if (!createDto.locationId) {
      throw new BadRequestException(
        "Location ID must be provided to create a cash register"
      );
    }

    const location = await this.prisma.location.findUnique({
      where: { id: createDto.locationId },
    });

    // Validate location if provided
    if (!location) {
      throw new NotFoundException(
        `Location with ID ${createDto.locationId} not found`
      );
    }

    const cashRegister = await this.prisma.cashRegister.create({
      data: {
        locationId: createDto.locationId,
        name: createDto.name,
        code: createDto.code,
        isActive: createDto.isActive ?? true,
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            branchId: true,
          },
        },
      },
    });

    return this.mapToDto(cashRegister);
  }

  async findAll(filters?: {
    locationId?: string;
    isActive?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: CashRegisterDto[]; pagination: any }> {
    const where: any = {};

    if (filters?.locationId) {
      where.locationId = filters.locationId;
    }

    // Default to only active cash registers unless explicitly filtered
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    } else {
      where.isActive = true;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { code: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [cashRegisters, total] = await Promise.all([
      this.prisma.cashRegister.findMany({
        where,
        include: {
          location: {
            select: {
              id: true,
              name: true,
              branchId: true,
            },
          },
          sessions: {
            where: {
              status: "open",
            },
            orderBy: {
              createdAt: "desc",
            },
            select: {
              id: true,
              status: true,
            },
            take: 1, // Only get the first open session ID
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      this.prisma.cashRegister.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: cashRegisters.map(cr => this.mapToDto(cr, false)),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findOne(id: string): Promise<CashRegisterDto> {
    const cashRegister = await this.prisma.cashRegister.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            branchId: true,
          },
        },
        sessions: {
          where: {
            status: "open",
          },
          include: {
            movements: true,
            orders: {
              select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                createdAt: true,
              },
            },
            employee: {
              select: {
                id: true,
                person: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          take: 1, // Only get the first open session
        },
      },
    });

    if (!cashRegister) {
      throw new NotFoundException(
        `Cash register with ID ${id} not found or is inactive`
      );
    }

    return this.mapToDto(cashRegister, true);
  }

  async update(
    id: string,
    updateDto: UpdateCashRegisterDto
  ): Promise<CashRegisterDto> {
    // Check if exists
    await this.findOne(id);

    // Validate location if provided
    if (updateDto.locationId) {
      const location = await this.prisma.location.findUnique({
        where: { id: updateDto.locationId },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with ID ${updateDto.locationId} not found`
        );
      }
    }

    const cashRegister = await this.prisma.cashRegister.update({
      where: { id },
      data: {
        ...updateDto,
        updatedAt: new Date(),
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            branchId: true,
          },
        },
        sessions: {
          where: {
            status: "open",
          },
          include: {
            movements: true,
            orders: {
              select: {
                id: true,
                orderNumber: true,
                totalAmount: true,
                createdAt: true,
              },
            },
            employee: {
              select: {
                id: true,
                person: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
          take: 1, // Only get the first open session
        },
      },
    });

    return this.mapToDto(cashRegister, true);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    // Check if register has open sessions
    const openSessions = await this.prisma.cashSession.count({
      where: {
        cashRegisterId: id,
        status: "open",
      },
    });

    if (openSessions > 0) {
      throw new Error("Cannot delete cash register with open sessions");
    }

    // Soft delete by setting isActive to false
    // If soft delete fields are added to schema later, use those instead
    await this.prisma.cashRegister.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Cash register ${id} soft deleted (set to inactive)`);
  }

  private mapToDto(
    cashRegister: any,
    includeFullSession: boolean = false
  ): CashRegisterDto {
    // Get the first open session if any
    const openSession =
      cashRegister.sessions && cashRegister.sessions.length > 0
        ? cashRegister.sessions[0]
        : null;

    const baseDto: CashRegisterDto = {
      id: cashRegister.id,
      locationId: cashRegister.locationId,
      name: cashRegister.name,
      code: cashRegister.code,
      isActive: cashRegister.isActive,
      createdAt: cashRegister.createdAt,
      updatedAt: cashRegister.updatedAt,
      location: cashRegister.location,
    };

    // For list endpoints, only return the session ID
    if (!includeFullSession) {
      return {
        ...baseDto,
        openSessionId: openSession?.id || null,
        openSession: null,
      };
    }

    // For single item endpoints, return full session data
    return {
      ...baseDto,
      openSessionId: openSession?.id || null,
      openSession: openSession
        ? {
            id: openSession.id,
            cashRegisterId: openSession.cashRegisterId,
            employeeId: openSession.employeeId,
            openedAt: openSession.openedAt,
            closedAt: openSession.closedAt,
            openingBalance: Number(openSession.openingBalance),
            closingBalance: openSession.closingBalance
              ? Number(openSession.closingBalance)
              : null,
            systemTotal: openSession.systemTotal
              ? Number(openSession.systemTotal)
              : null,
            difference: openSession.difference
              ? Number(openSession.difference)
              : null,
            status: openSession.status,
            notes: openSession.notes,
            createdAt: openSession.createdAt,
            updatedAt: openSession.updatedAt,
            employee: openSession.employee,
            movements:
              openSession.movements?.map((m: any) => ({
                id: m.id,
                cashSessionId: m.cashSessionId,
                type: m.type,
                amount: Number(m.amount),
                reason: m.reason,
                referenceOrderId: m.referenceOrderId,
                createdBy: m.createdBy,
                createdAt: m.createdAt,
              })) || [],
            orders:
              openSession.orders?.map((o: any) => ({
                id: o.id,
                orderNumber: o.orderNumber,
                totalAmount: o.totalAmount ? Number(o.totalAmount) : null,
                createdAt: o.createdAt,
              })) || [],
          }
        : null,
    };
  }
}

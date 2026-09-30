import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { OpenCashSessionDto } from "./dto/open-cash-session.dto";
import { CloseCashSessionDto } from "./dto/close-cash-session.dto";
import { CashSessionDto } from "./dto/cash-session.dto";
import { Decimal } from "@prisma/client/runtime/library";
import type { CashSessionPdfData } from "../reports/types/cash-session-types";

@Injectable()
export class CashSessionService {
  private readonly logger = new Logger(CashSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Open a new cash session or return existing open session for employee
   */
  async openSession(
    openDto: OpenCashSessionDto,
    employeeId: string,
    roles: string[] = []
  ): Promise<CashSessionDto> {
    this.logger.log(
      `Opening cash session for cash register ${openDto.cashRegisterId}`
    );

    return await this.prisma.$transaction(async tx => {
      // Validate cash register exists and is active
      const cashRegister = await tx.cashRegister.findUnique({
        where: { id: openDto.cashRegisterId },
        include: {
          location: true,
        },
      });

      if (!cashRegister) {
        throw new NotFoundException(
          `Cash register with ID ${openDto.cashRegisterId} not found`
        );
      }

      if (!cashRegister.isActive) {
        throw new BadRequestException("Cash register is not active");
      }

      // Check if cash register already has an open session
      // Allow multiple employees to use the same cash register session
      const existingCashRegisterSession = await tx.cashSession.findFirst({
        where: {
          cashRegisterId: openDto.cashRegisterId,
          status: "open",
        },
        include: {
          cashRegister: {
            select: {
              id: true,
              name: true,
              code: true,
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
      });

      // If there's already an open session on this cash register, return it
      // This allows multiple employees to share the same cash register session
      if (existingCashRegisterSession) {
        this.logger.log(
          `Cash register already has an open session: ${existingCashRegisterSession.id}. Employee ${employeeId} joining existing session.`
        );
        return this.mapToDto(existingCashRegisterSession);
      }

      // Validate employee exists and is assigned to location
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: {
          location: {
            include: {
              branch: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException(`Employee with ID ${employeeId} not found`);
      }

      if (!employee.isActive) {
        throw new BadRequestException("Employee is not active");
      }

      // If cash register has a location, validate employee is in same location
      // Admins can open cash registers at any location
      const isAdmin = roles.includes("admin");
      if (!isAdmin && cashRegister.locationId && employee.locationId) {
        if (cashRegister.locationId !== employee.locationId) {
          throw new BadRequestException(
            "Employee is not assigned to the same location as the cash register"
          );
        }
      }

      // Create new session
      const session = await tx.cashSession.create({
        data: {
          cashRegisterId: openDto.cashRegisterId,
          employeeId,
          openingBalance: new Decimal(openDto.openingBalance),
          status: "open",
          openedAt: openDto.openedAt ? new Date(openDto.openedAt) : undefined,
        },
        include: {
          cashRegister: {
            select: {
              id: true,
              name: true,
              code: true,
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
      });

      this.logger.log(`Cash session opened: ${session.id}`);
      return this.mapToDto(session);
    });
  }

  /**
   * Close a cash session
   */
  async closeSession(
    sessionId: string,
    closeDto: CloseCashSessionDto,
    employeeId: string,
    roles: string[] = []
  ): Promise<CashSessionDto> {
    this.logger.log(`Closing cash session: ${sessionId}`);

    return await this.prisma.$transaction(async tx => {
      // Get session with related data
      const session = await tx.cashSession.findUnique({
        where: { id: sessionId },
        include: {
          orders: {
            select: {
              id: true,
              totalAmount: true,
            },
          },
          movements: {
            select: {
              id: true,
              type: true,
              amount: true,
            },
          },
        },
      });

      if (!session) {
        throw new NotFoundException(
          `Cash session with ID ${sessionId} not found`
        );
      }

      if (session.status === "closed") {
        throw new ConflictException("Cash session is already closed");
      }

      if (session.employeeId !== employeeId) {
        const isAdmin = roles.includes("admin");
        const isCashier = roles.includes("cashier");
        if (!isAdmin && !isCashier) {
          throw new BadRequestException(
            "Only the employee who opened the session, an admin, or a cashier can close it"
          );
        }
      }

      // Calculate system total: opening balance + cash IN movements - cash OUT movements + order payments
      // For credit orders, only count initial payments (payments without creditInstallmentId)
      // For cash orders, count all payments
      // Also include credit installment payments
      let systemTotal = new Decimal(session.openingBalance);

      // Add cash IN movements
      const cashInMovements = session.movements
        .filter(m => m.type === "IN")
        .reduce((sum, m) => sum.plus(m.amount), new Decimal(0));

      // Subtract cash OUT movements
      const cashOutMovements = session.movements
        .filter(m => m.type === "OUT")
        .reduce((sum, m) => sum.plus(m.amount), new Decimal(0));

      // Get all orders (excluding pending and annulled orders)
      const orders = await tx.order.findMany({
        where: {
          cashSessionId: sessionId,
          status: {
            notIn: ["PENDING", "ANNULLED"],
          },
        },
        include: {
          payments: {
            where: {
              creditInstallmentId: null, // Only initial payments (not installment payments)
              paymentType: { in: ["CASH", "DOWN_PAYMENT"] },
            },
          },
        },
      });

      // Calculate order payments total
      // For credit orders, this will be the initial payment
      // For cash orders, this will be the full payment
      const ordersTotal = orders.reduce((sum, order) => {
        const orderPayments = order.payments.reduce(
          (paymentSum, payment) => paymentSum.plus(payment.amount || 0),
          new Decimal(0)
        );
        return sum.plus(orderPayments);
      }, new Decimal(0));

      // Get credit installment payments for orders in this session
      const orderIds = orders.map(o => o.id);
      const creditInstallmentPaymentsTotal =
        orderIds.length > 0
          ? await tx.payment
              .findMany({
                where: {
                  creditInstallmentId: { not: null },
                  orderId: { in: orderIds },
                  paymentType: { in: ["CASH", "DOWN_PAYMENT"] },
                },
                select: {
                  amount: true,
                },
              })
              .then(payments =>
                payments.reduce(
                  (sum, payment) => sum.plus(payment.amount || 0),
                  new Decimal(0)
                )
              )
          : new Decimal(0);

      systemTotal = systemTotal
        .plus(cashInMovements)
        .minus(cashOutMovements)
        .plus(ordersTotal)
        .plus(creditInstallmentPaymentsTotal);

      // Calculate difference
      const closingBalance = new Decimal(closeDto.closingBalance);
      const difference = closingBalance.minus(systemTotal);

      // Update session
      const updatedSession = await tx.cashSession.update({
        where: { id: sessionId },
        data: {
          closingBalance,
          systemTotal,
          difference,
          status: "closed",
          closedAt: closeDto.closedAt
            ? new Date(closeDto.closedAt)
            : new Date(),
          notes: closeDto.notes,
          updatedAt: new Date(),
          closedById: closeDto.closedById || employeeId,
        },
        include: {
          cashRegister: {
            select: {
              id: true,
              name: true,
              code: true,
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
          closedBy: {
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
      });

      this.logger.log(
        `Cash session closed: ${sessionId}, difference: ${difference}`
      );
      return this.mapToDto(updatedSession);
    });
  }

  /**
   * Get current open session for an employee
   * Returns any open session at the employee's location to allow multiple users
   * to share the same cash register session
   */
  async getCurrentSession(
    employeeId: string,
    roles: string[] = []
  ): Promise<CashSessionDto | null> {
    // First, get the employee's location
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        locationId: true,
      },
    });

    let session;
    if (roles.includes("admin")) {
      // Admins can see any open session
      session = await this.prisma.cashSession.findFirst({
        where: {
          status: "open",
        },
        orderBy: {
          openedAt: "desc",
        },
        include: {
          cashRegister: {
            select: {
              id: true,
              name: true,
              code: true,
              locationId: true,
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
          closedBy: {
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
      });
    } else {
      // For non-admin users, return any open session at their location
      // This allows multiple employees to share the same cash register session
      if (employee?.locationId) {
        session = await this.prisma.cashSession.findFirst({
          where: {
            status: "open",
            cashRegister: {
              locationId: employee.locationId,
            },
          },
          orderBy: {
            openedAt: "desc",
          },
          include: {
            cashRegister: {
              select: {
                id: true,
                name: true,
                code: true,
                locationId: true,
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
            closedBy: {
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
        });
      } else {
        // If employee has no location, fall back to employee-specific session
        session = await this.prisma.cashSession.findFirst({
          where: {
            employeeId,
            status: "open",
          },
          orderBy: {
            openedAt: "desc",
          },
          include: {
            cashRegister: {
              select: {
                id: true,
                name: true,
                code: true,
                locationId: true,
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
            closedBy: {
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
        });
      }
    }
    return session ? this.mapToDto(session) : null;
  }

  /**
   * Get session by ID
   */
  async findOne(id: string): Promise<CashSessionDto> {
    const session = await this.prisma.cashSession.findUnique({
      where: { id },
      include: {
        cashRegister: {
          select: {
            id: true,
            name: true,
            code: true,
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
        closedBy: {
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
        orders: {
          where: {
            status: {
              notIn: ["PENDING", "ANNULLED"],
            },
          },
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paymentMethod: true,
            createdAt: true,
            payments: {
              where: {
                creditInstallmentId: null, // Only initial payments (not installment payments)
              },
              select: {
                id: true,
                paymentType: true,
                provider: true,
                amount: true,
                transactionReference: true,
                paidAt: true,
              },
            },
            credit: {
              select: {
                id: true,
                principalAmount: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        movements: {
          select: {
            id: true,
            type: true,
            amount: true,
            reason: true,
            referenceOrderId: true,
            createdAt: true,
            createdBy: true,
            referenceOrder: {
              select: {
                id: true,
                orderNumber: true,
              },
            },
            creator: {
              select: {
                id: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Cash session with ID ${id} not found`);
    }

    // Get credit installment payments for orders in this session
    const orderIds = (session.orders || []).map((o: any) => o.id);
    const creditInstallmentPayments =
      orderIds.length > 0
        ? await this.prisma.payment.findMany({
            where: {
              creditInstallmentId: { not: null },
              orderId: { in: orderIds },
            },
            select: {
              id: true,
              orderId: true,
              creditInstallmentId: true,
              paymentType: true,
              provider: true,
              amount: true,
              transactionReference: true,
              paidAt: true,
              creditInstallment: {
                select: {
                  id: true,
                  installmentNo: true,
                  credit: {
                    select: {
                      orderId: true,
                      order: {
                        select: {
                          orderNumber: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: {
              paidAt: "desc",
            },
          })
        : [];

    return this.mapToDto(session, creditInstallmentPayments);
  }

  /**
   * Get cash session data for PDF export
   */
  async getCashSessionPdfData(sessionId: string): Promise<CashSessionPdfData> {
    const session = await this.prisma.cashSession.findUnique({
      where: { id: sessionId },
      include: {
        cashRegister: {
          include: {
            location: {
              include: {
                branch: true,
              },
            },
          },
        },
        employee: {
          include: {
            person: true,
            location: {
              include: {
                branch: true,
              },
            },
          },
        },
        closedBy: {
          include: {
            person: true,
            location: {
              include: {
                branch: true,
              },
            },
          },
        },
        orders: {
          where: {
            status: {
              notIn: ["PENDING", "ANNULLED"],
            },
          },
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            paymentMethod: true,
            createdAt: true,
            payments: {
              where: {
                creditInstallmentId: null, // Only initial payments (not installment payments)
              },
              select: {
                amount: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        movements: {
          select: {
            id: true,
            type: true,
            amount: true,
            reason: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(
        `Cash session with ID ${sessionId} not found`
      );
    }

    // Get credit installment payments for orders in this session
    const orderIds = (session.orders || []).map((o: any) => o.id);
    const creditInstallmentPayments =
      orderIds.length > 0
        ? await this.prisma.payment.findMany({
            where: {
              creditInstallmentId: { not: null },
              orderId: { in: orderIds },
            },
            select: {
              id: true,
              orderId: true,
              creditInstallmentId: true,
              paymentType: true,
              provider: true,
              amount: true,
              transactionReference: true,
              paidAt: true,
              creditInstallment: {
                select: {
                  id: true,
                  installmentNo: true,
                  credit: {
                    select: {
                      orderId: true,
                      order: {
                        select: {
                          orderNumber: true,
                        },
                      },
                    },
                  },
                },
              },
            },
            orderBy: {
              paidAt: "desc",
            },
          })
        : [];

    const employeeName = session.employee?.person
      ? `${session.employee.person.firstName} ${session.employee.person.lastName || ""}`.trim()
      : "Unknown";

    const closedByName = session.closedBy?.person
      ? `${session.closedBy.person.firstName} ${session.closedBy.person.lastName || ""}`.trim()
      : undefined;

    const branchName =
      session.cashRegister?.location?.branch?.name ||
      session.employee?.location?.branch?.name ||
      undefined;

    return {
      companyName: "Esli Cosmetics",
      branchName,
      cashRegisterName: session.cashRegister?.name || "Unknown",
      cashRegisterCode: session.cashRegister?.code || undefined,
      employeeName,
      closedByName,
      sessionId: session.id,
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString(),
      openingBalance: Number(session.openingBalance),
      closingBalance: session.closingBalance
        ? Number(session.closingBalance)
        : undefined,
      systemTotal: session.systemTotal
        ? Number(session.systemTotal)
        : undefined,
      difference: session.difference ? Number(session.difference) : undefined,
      notes: session.notes || undefined,
      orders: (session.orders || []).map((order: any) => {
        // For credit orders, use initial payment; for cash orders, use totalAmount
        const orderAmount =
          order.paymentMethod === "CREDIT"
            ? (order.payments || []).reduce(
                (sum: number, payment: any) =>
                  sum + Number(payment.amount || 0),
                0
              )
            : order.totalAmount
              ? Number(order.totalAmount)
              : 0;

        return {
          orderNumber: order.orderNumber || undefined,
          date: order.createdAt?.toISOString() || new Date().toISOString(),
          totalAmount: orderAmount,
          paymentMethod: order.paymentMethod || "CASH",
        };
      }),
      creditInstallmentPayments: creditInstallmentPayments.map(
        (payment: any) => ({
          orderNumber:
            payment.creditInstallment?.credit?.order?.orderNumber || undefined,
          installmentNo: payment.creditInstallment?.installmentNo || undefined,
          date: payment.paidAt.toISOString(),
          amount: Number(payment.amount),
        })
      ),
      movements: (session.movements || []).map(movement => ({
        type: movement.type as "IN" | "OUT",
        date: movement.createdAt.toISOString(),
        reason: movement.reason || undefined,
        amount: Number(movement.amount),
      })),
    };
  }

  /**
   * Get all sessions with filters
   */
  async findAll(filters?: {
    cashRegisterId?: string;
    employeeId?: string;
    closedBy?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    locationId?: string;
  }): Promise<CashSessionDto[]> {
    const where: any = {};

    if (filters?.cashRegisterId) {
      where.cashRegisterId = filters.cashRegisterId;
    }

    if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters?.closedBy) {
      where.closedById = filters.closedBy;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.openedAt = {};
      if (filters.startDate) {
        where.openedAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.openedAt.lte = filters.endDate;
      }
    }

    if (filters?.locationId) {
      where.cashRegister = { locationId: filters.locationId };
    }

    const sessions = await this.prisma.cashSession.findMany({
      where,
      include: {
        cashRegister: {
          select: {
            id: true,
            name: true,
            code: true,
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
        closedBy: {
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
      orderBy: { openedAt: "desc" },
    });

    return sessions.map(s => this.mapToDto(s));
  }

  private mapToDto(
    session: any,
    creditInstallmentPayments: any[] = []
  ): CashSessionDto {
    return {
      id: session.id,
      cashRegisterId: session.cashRegisterId,
      employeeId: session.employeeId,
      closedById: session.closedById,
      openedAt: session.openedAt,
      closedAt: session.closedAt,
      openingBalance: Number(session.openingBalance),
      closingBalance: session.closingBalance
        ? Number(session.closingBalance)
        : null,
      systemTotal: session.systemTotal ? Number(session.systemTotal) : null,
      difference: session.difference ? Number(session.difference) : null,
      status: session.status,
      notes: session.notes,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      cashRegister: session.cashRegister,
      employee: session.employee,
      closedBy: session.closedBy
        ? {
            id: session.closedBy.id,
            person: session.closedBy.person
              ? {
                  firstName: session.closedBy.person.firstName,
                  lastName: session.closedBy.person.lastName,
                }
              : null,
          }
        : null,
      orders: session.orders
        ? session.orders.map((order: any) => ({
            id: order.id,
            orderNumber: order.orderNumber,
            totalAmount: order.totalAmount ? Number(order.totalAmount) : null,
            paymentMethod: order.paymentMethod || "CASH",
            createdAt: order.createdAt,
            payments: order.payments
              ? order.payments.map((payment: any) => ({
                  id: payment.id,
                  paymentType: payment.paymentType,
                  provider: payment.provider,
                  amount: Number(payment.amount),
                  transactionReference: payment.transactionReference,
                  paidAt: payment.paidAt,
                }))
              : [],
            credit: order.credit
              ? {
                  id: order.credit.id,
                  principalAmount: Number(order.credit.principalAmount),
                }
              : null,
          }))
        : undefined,
      movements: session.movements
        ? session.movements.map((movement: any) => ({
            id: movement.id,
            cashSessionId: movement.cashSessionId,
            type: movement.type,
            amount: Number(movement.amount),
            reason: movement.reason,
            referenceOrderId: movement.referenceOrderId,
            createdBy: movement.createdBy,
            createdAt: movement.createdAt,
            referenceOrder: movement.referenceOrder
              ? {
                  id: movement.referenceOrder.id,
                  orderNumber: movement.referenceOrder.orderNumber,
                }
              : null,
            creator: movement.creator
              ? {
                  id: movement.creator.id,
                  email: movement.creator.email,
                }
              : null,
          }))
        : undefined,
      creditInstallmentPayments: creditInstallmentPayments.map(
        (payment: any) => ({
          id: payment.id,
          orderId: payment.orderId,
          orderNumber:
            payment.creditInstallment?.credit?.order?.orderNumber || null,
          installmentNo: payment.creditInstallment?.installmentNo || null,
          paymentType: payment.paymentType,
          provider: payment.provider,
          amount: Number(payment.amount),
          transactionReference: payment.transactionReference,
          paidAt: payment.paidAt,
        })
      ),
    };
  }
}

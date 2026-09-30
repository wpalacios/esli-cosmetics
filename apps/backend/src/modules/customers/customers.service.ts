import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomerDto } from "./dto/customer.dto";
import { PaginatedCustomersDto } from "./dto/paginated-customers.dto";
import { DeleteCustomerResponseDto } from "./dto/delete-customer-response.dto";
import type { DataWorkbookRequest } from "../reports/types/excel-reports.types";
import type { Prisma } from "@prisma/client";
import {
  normalizeDateRange,
  RawDate,
} from "src/common/date-range/date-range.util";
import { CreditStatus, PaymentLifecycleStatus } from "@prisma/client";
import { PaymentsService } from "../payments/payments.service";
import { displayReversalStatementReference } from "../payments/payment-label.util";
import { computeStatementBalances } from "./statement-balance.util";
import { CreatePaymentDto } from "../payments/dto/create-payment.dto";
import { Decimal } from "@prisma/client/runtime/library";

type CustomerAddressInput = {
  address?: string;
  city?: string;
  postalCode?: string;
};

// Returns true if the address payload has any non-empty field worth persisting
function hasAddressContent(address?: CustomerAddressInput): boolean {
  if (!address) return false;
  return Boolean(
    address.address?.trim() ||
      address.city?.trim() ||
      address.postalCode?.trim()
  );
}

// Helper function to normalize strings (remove accents and convert to lowercase)
function normalizeText(text?: string): string | undefined {
  if (!text) return undefined;
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function translateOrderStatus(status: string): string {
  const statusMap: Record<string, string> = {
    PENDING: "Pendiente",
    APPROVED: "Aprobado",
    COMPLETED: "Completado",
    ANNULLED: "Anulado",
  };
  return statusMap[status.toUpperCase()] || status;
}

function translatePaymentType(paymentType: string): string {
  const paymentMap: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    CREDIT: "Crédito",
    CREDIT_PAYMENT: "Pago de Crédito",
    DOWN_PAYMENT: "Anticipo",
  };
  return paymentMap[paymentType.toUpperCase()] || paymentType;
}

const MAX_EXPORT_ROWS = 10000;

type ExportFilters = {
  search?: string;
  from?: RawDate;
  to?: RawDate;
  branchId?: string;
  customerId?: string;
  employeeId?: string;
  orderNumber?: string;
  paymentMethod?: "CASH" | "CREDIT";
  locationId?: string;
  orderStatus?: string;
  maxRows?: number;
};

type CustomerListParams = {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
};

type CustomerItemRow = {
  fullName: string;
  email: string;
  phone: string;
  doc: string;
  priceTypes: string;
  createdAt: string;
};

type PaginatedCustomerItems = {
  data: CustomerItemRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type SalesListParams = {
  page?: number;
  limit?: number;
  orderNumber?: string;
  from?: string;
  to?: string;
  branchId?: string;
  customerId?: string;
  productName?: string;
  variantName?: string;
  variantSku?: string;
  employeeId?: string;
  locationId?: string;
  orderStatus?: string;
  paymentMethod?: "CASH" | "CREDIT";
};

type SalesItemRow = {
  date: string;
  orderNumber: string;
  customer: string;
  branch: string;
  productName: string;
  variantName: string;
  quantity: number;
  orderTotal: number;
};

type PaginatedSalesItems = {
  data: SalesItemRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

@Injectable()
export class CustomersService {
  private readonly MIGRATION_DATE = new Date("2025-12-31T00:00:00.000Z");
  private readonly OPENING_BALANCE_REFERENCE = "OPENING_BALANCE";

  constructor(
    private prisma: PrismaService,
    private paymentsService: PaymentsService
  ) {}

  /**
   * Upsert opening balance payment transaction
   * Creates or updates a special payment record to represent the opening balance
   */
  private async upsertOpeningBalancePayment(
    customerId: string,
    openingBalance: number,
    userId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const prisma = tx || this.prisma;
    const migrationDate = this.MIGRATION_DATE;

    // Find existing opening balance payment
    const existing = await prisma.payment.findFirst({
      where: {
        customerId,
        transactionReference: this.OPENING_BALANCE_REFERENCE,
        orderId: null,
        creditInstallmentId: null,
      },
    });

    if (existing) {
      // Update existing opening balance payment
      await prisma.payment.update({
        where: { id: existing.id },
        data: {
          amount: new Decimal(openingBalance),
          createdBy: userId || existing.createdBy,
        },
      });
    } else {
      // Create new opening balance payment
      await prisma.payment.create({
        data: {
          customerId,
          paymentType: "CASH", // Payment type doesn't matter for opening balance
          amount: new Decimal(openingBalance),
          transactionReference: this.OPENING_BALANCE_REFERENCE,
          paidAt: migrationDate,
          createdBy: userId,
        },
      });
    }
  }

  // Report of sales by customer (one row per order) with pagination
  async listSalesByCustomerItems(
    params: SalesListParams = {}
  ): Promise<PaginatedSalesItems> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const skip = (page - 1) * limit;

    const { from, to } = normalizeDateRange({
      from: params.from,
      to: params.to,
    });

    const q = normalizeText(params.orderNumber);

    const andOrder: Prisma.OrderWhereInput[] = [
      { customer: { isDeleted: false } },
    ];
    if (params.branchId) andOrder.push({ branchId: params.branchId });
    if (params.customerId) andOrder.push({ customerId: params.customerId });
    if (params.locationId) andOrder.push({ locationId: params.locationId });
    if (params.employeeId) {
      andOrder.push({
        OR: [{ sellerId: params.employeeId }, { cashierId: params.employeeId }],
      });
    }
    if (q) {
      andOrder.push({ orderNumber: { contains: q, mode: "insensitive" } });
    }
    if (params.paymentMethod) {
      andOrder.push({ paymentMethod: params.paymentMethod });
    }
    if (params.orderStatus) {
      andOrder.push({ status: params.orderStatus });
    }
    if (from || to) {
      andOrder.push({
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      });
    }

    const where: Prisma.OrderWhereInput = andOrder.length
      ? { AND: andOrder }
      : {};

    // Count orders instead of order items
    const total = await this.prisma.order.count({ where });
    const paginatedOrders = await this.prisma.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          include: {
            person: { select: { firstName: true, lastName: true } },
          },
        },
        location: { select: { name: true, locationType: true } },
        seller: {
          include: {
            person: { select: { firstName: true, lastName: true } },
          },
        },
        discountCode: { select: { code: true } },
        payments: {
          select: {
            paymentType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Return one row per order (not per order item)
    const data: SalesItemRow[] = paginatedOrders.map(o => {
      const customerName =
        `${o.customer?.person?.firstName ?? ""} ${o.customer?.person?.lastName ?? ""}`.trim();
      const sellerName = o.seller
        ? `${o.seller.person?.firstName ?? ""} ${o.seller.person?.lastName ?? ""}`.trim()
        : "";
      // Translate payment types
      const paymentTypes = (o.payments ?? [])
        .map(p => p.paymentType)
        .filter(Boolean)
        .map(pt => translatePaymentType(pt));
      // If no payments, use order paymentMethod as fallback
      const paymentType =
        paymentTypes.length > 0
          ? paymentTypes.join(", ")
          : o.paymentMethod
            ? translatePaymentType(o.paymentMethod)
            : "";
      const orderStatus =
        typeof o.status === "string"
          ? o.status
          : typeof (o as any).orderStatus === "string"
            ? (o as any).orderStatus
            : String(o.status ?? (o as any).orderStatus ?? "");
      // Send date as ISO string so frontend can convert to user's timezone
      // The date is stored in UTC in the database, so we send it as ISO string
      return {
        date: o.createdAt ? o.createdAt.toISOString() : "",
        orderNumber: o.orderNumber ?? "",
        customer: customerName,
        branch: o.location?.name ?? "",
        productName: "", // No product info for order-level rows
        variantName: "",
        variantSku: "",
        quantity: 0, // No quantity for order-level rows
        orderTotal: Number(o.totalAmount?.toString() ?? 0),
        sellerName,
        paymentType,
        discountCode: o.discountCode?.code ?? "",
        orderDiscount: Number(o.discountAmount?.toString() ?? 0),
        orderSubtotal: Number(o.subtotal?.toString() ?? 0),
        orderTaxes: Number(o.taxes?.toString() ?? 0),
        status: translateOrderStatus(orderStatus),
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { data, pagination: { page, limit, total, totalPages } };
  }

  // List customers (paginated) for the preview table
  async listCustomerItems(
    params: CustomerListParams = {}
  ): Promise<PaginatedCustomerItems> {
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 10;
    const skip = (page - 1) * limit;

    const { from, to } = normalizeDateRange({
      from: params.from,
      to: params.to,
    });

    const where: Prisma.CustomerWhereInput = {
      isDeleted: false,
      ...(params.search
        ? {
            OR: [
              {
                person: {
                  firstName: { contains: params.search, mode: "insensitive" },
                },
              },
              {
                person: {
                  lastName: { contains: params.search, mode: "insensitive" },
                },
              },
              {
                person: {
                  email: { contains: params.search, mode: "insensitive" },
                },
              },
              {
                person: {
                  phone: { contains: params.search, mode: "insensitive" },
                },
              },
              {
                person: {
                  docNumber: { contains: params.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        include: {
          person: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              docType: true,
              docNumber: true,
            },
          },
          customerPrices: {
            where: { isDeleted: false },
            include: { priceType: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const data: CustomerItemRow[] = customers.map(c => ({
      fullName:
        `${c.person?.firstName ?? ""} ${c.person?.lastName ?? ""}`.trim(),
      email: c.person?.email ?? "",
      phone: c.person?.phone ?? "",
      doc: c.person ? `${c.person.docType}-${c.person.docNumber}` : "",
      priceTypes:
        c.customerPrices
          ?.map(cp => cp.priceType?.name)
          .filter(Boolean)
          .join(", ") ?? "",
      createdAt: c.createdAt ? c.createdAt.toISOString() : "",
    }));

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return { data, pagination: { page, limit, total, totalPages } };
  }

  private mapToCustomerDto(customer: any): CustomerDto {
    return {
      id: customer.id,
      personId: customer.personId,
      userId: customer.userId,
      externalId: customer.externalId,
      defaultBillingAddressId: customer.defaultBillingAddressId,
      priceTypeIds:
        customer.customerPrices?.map((cp: any) => cp.priceTypeId) || [],
      priceTypes:
        customer.customerPrices?.map((cp: any) => ({
          id: cp.priceType.id,
          name: cp.priceType.name,
          minQuantity: cp.priceType.minQuantity,
          priority: cp.priceType.priority,
          description: cp.priceType.description,
          isActive: cp.priceType.isActive,
        })) || [],
      isDeleted: customer.isDeleted,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      deletedAt: customer.deletedAt,
      metadata: customer.metadata,
      creditAllowed: customer.creditAllowed,
      creditLimit: customer.creditLimit
        ? Number(customer.creditLimit)
        : undefined,
      initialOpeningBalance: customer.initialOpeningBalance
        ? Number(customer.initialOpeningBalance)
        : undefined,
      person: customer.person
        ? {
            id: customer.person.id,
            firstName: customer.person.firstName,
            lastName: customer.person.lastName,
            phone: customer.person.phone,
            email: customer.person.email,
            docType: customer.person.docType,
            docNumber: customer.person.docNumber,
          }
        : undefined,
      user: customer.user,
      defaultBillingAddress: customer.defaultBillingAddress
        ? {
            id: customer.defaultBillingAddress.id,
            address: customer.defaultBillingAddress.address,
            city: customer.defaultBillingAddress.city,
            postalCode: customer.defaultBillingAddress.postalCode,
          }
        : undefined,
      orders: customer.orders,
      discountCodes: customer.discountCodes?.map((dc: any) => ({
        id: dc.id,
        discountCode: {
          id: dc.discountCode.id,
          code: dc.discountCode.code,
          name: dc.discountCode.name,
          discountType: dc.discountCode.discountType,
          value: dc.discountCode.value,
          isActive: dc.discountCode.isActive,
        },
        isRedeemed: dc.isRedeemed,
        assignedAt: dc.assignedAt,
      })),
      customerType: customer.customerType
        ? {
            id: customer.customerType.id,
            name: customer.customerType.name,
            description: customer.customerType.description,
            isActive: customer.customerType.isActive,
            isDeleted: customer.customerType.isDeleted,
            createdAt: customer.customerType.createdAt,
            updatedAt: customer.customerType.updatedAt,
            deletedAt: customer.customerType.deletedAt,
          }
        : undefined,
    };
  }

  private getCustomerInclude(options?: { ordersTake?: number }) {
    return {
      customerPrices: {
        where: { isDeleted: false },
        include: { priceType: true },
      },
      customerType: true,
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          docType: true,
          docNumber: true,
        },
      },
      user: { select: { id: true, email: true, isActive: true } },
      defaultBillingAddress: {
        select: {
          id: true,
          address: true,
          city: true,
          postalCode: true,
        },
      },
      discountCodes: {
        where: {
          isDeleted: false,
          discountCode: {
            isDeleted: false,
            isActive: true,
          },
        },
        include: {
          discountCode: {
            select: {
              id: true,
              code: true,
              name: true,
              discountType: true,
              value: true,
              isActive: true,
            },
          },
        },
      },
      orders: {
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" as const },
        take: options?.ordersTake ?? 5,
      },
    };
  }

  async create(createCustomerDto: CreateCustomerDto): Promise<CustomerDto> {
    return await this.prisma.$transaction(
      async tx => {
        // Verify user exists if userId is provided
        if (createCustomerDto.userId) {
          const user = await tx.user.findFirst({
            where: {
              id: createCustomerDto.userId,
              isDeleted: false,
            },
          });

          if (!user) {
            throw new NotFoundException("User not found");
          }
        }

        // Verify address exists if defaultBillingAddressId is provided
        if (createCustomerDto.defaultBillingAddressId) {
          const address = await tx.address.findFirst({
            where: {
              id: createCustomerDto.defaultBillingAddressId,
              isDeleted: false,
            },
          });

          if (!address) {
            throw new NotFoundException("Address not found");
          }
        }

        // Validate price type IDs if provided
        if (
          createCustomerDto.priceTypeIds &&
          createCustomerDto.priceTypeIds.length > 0
        ) {
          const existingPriceTypes = await tx.priceType.findMany({
            where: {
              id: { in: createCustomerDto.priceTypeIds },
              isDeleted: false,
              isActive: true,
            },
            select: { id: true },
          });

          if (
            existingPriceTypes.length !== createCustomerDto.priceTypeIds.length
          ) {
            throw new BadRequestException(
              "One or more price type IDs are invalid or inactive"
            );
          }
        }

        // Validate discount code IDs if provided
        if (
          createCustomerDto.discountCodeIds &&
          createCustomerDto.discountCodeIds.length > 0
        ) {
          const existingDiscountCodes = await tx.discountCode.findMany({
            where: {
              id: { in: createCustomerDto.discountCodeIds },
              isDeleted: false,
              isActive: true,
            },
            select: { id: true },
          });

          if (
            existingDiscountCodes.length !==
            createCustomerDto.discountCodeIds.length
          ) {
            throw new BadRequestException(
              "One or more discount code IDs are invalid or inactive"
            );
          }
        }

        // Create the person first
        const person = await tx.person.create({
          data: {
            firstName: createCustomerDto.person.firstName,
            lastName: createCustomerDto.person.lastName,
            phone: createCustomerDto.person.phone,
            email: createCustomerDto.person.email,
            docType: createCustomerDto.person.docType,
            docNumber: createCustomerDto.person.docNumber,
          },
        });

        // Create home/billing address if provided (takes precedence over defaultBillingAddressId)
        let defaultBillingAddressId = createCustomerDto.defaultBillingAddressId;
        if (hasAddressContent(createCustomerDto.address)) {
          const createdAddress = await tx.address.create({
            data: {
              personId: person.id,
              address: createCustomerDto.address?.address,
              city: createCustomerDto.address?.city,
              postalCode: createCustomerDto.address?.postalCode,
            },
          });
          defaultBillingAddressId = createdAddress.id;
        }

        // Create the customer with the new person
        const customer = await tx.customer.create({
          data: {
            personId: person.id,
            userId: createCustomerDto.userId,
            externalId: createCustomerDto.externalId,
            defaultBillingAddressId,
            ...(createCustomerDto.creditAllowed !== undefined && {
              creditAllowed: createCustomerDto.creditAllowed,
            }),
            ...(createCustomerDto.creditLimit !== undefined && {
              creditLimit: createCustomerDto.creditLimit,
            }),
            ...(createCustomerDto.initialOpeningBalance !== undefined && {
              initialOpeningBalance: createCustomerDto.initialOpeningBalance,
            }),
            ...(createCustomerDto.customerTypeId && {
              customerTypeId: createCustomerDto.customerTypeId,
            }),
            discountCodes:
              createCustomerDto.discountCodeIds &&
              createCustomerDto.discountCodeIds.length > 0
                ? {
                    create: createCustomerDto.discountCodeIds.map(
                      discountCodeId => ({
                        discountCodeId,
                      })
                    ),
                  }
                : undefined,
          } as any,
          include: this.getCustomerInclude(),
        });

        // Create customer prices if provided
        if (
          createCustomerDto.priceTypeIds &&
          createCustomerDto.priceTypeIds.length > 0
        ) {
          await tx.customerPrice.createMany({
            data: createCustomerDto.priceTypeIds.map(priceTypeId => ({
              customerId: customer.id,
              priceTypeId,
            })),
          });
        }

        // Fetch the customer with all relations including the newly created customer prices
        const customerWithPrices = await tx.customer.findUnique({
          where: { id: customer.id },
          include: this.getCustomerInclude(),
        });

        // Create/update opening balance payment transaction if initialOpeningBalance is set
        // (Inlined here so all DB access uses the same tx reference; passing tx to another method can cause "Transaction not found" in Prisma.)
        if (createCustomerDto.initialOpeningBalance !== undefined) {
          const openingBalance = createCustomerDto.initialOpeningBalance;
          const existing = await tx.payment.findFirst({
            where: {
              customerId: customer.id,
              transactionReference: this.OPENING_BALANCE_REFERENCE,
              orderId: null,
              creditInstallmentId: null,
            },
          });
          if (existing) {
            await tx.payment.update({
              where: { id: existing.id },
              data: { amount: new Decimal(openingBalance) },
            });
          } else {
            await tx.payment.create({
              data: {
                customerId: customer.id,
                paymentType: "CASH",
                amount: new Decimal(openingBalance),
                transactionReference: this.OPENING_BALANCE_REFERENCE,
                paidAt: this.MIGRATION_DATE,
              },
            });
          }
        }

        return this.mapToCustomerDto(customerWithPrices);
      },
      { timeout: 15000 }
    );
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string
  ): Promise<PaginatedCustomersDto> {
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const whereClause: any = {
      isDeleted: false,
    };

    // Add search functionality
    if (search) {
      whereClause.OR = [
        { person: { firstName: { contains: search, mode: "insensitive" } } },
        { person: { lastName: { contains: search, mode: "insensitive" } } },
        { person: { email: { contains: search, mode: "insensitive" } } },
        { person: { phone: { contains: search, mode: "insensitive" } } },
        { person: { docNumber: { contains: search, mode: "insensitive" } } },
        {
          customerPrices: {
            some: {
              priceType: { name: { contains: search, mode: "insensitive" } },
            },
          },
        },
      ];
    }

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where: whereClause }),
      this.prisma.customer.findMany({
        where: whereClause,
        include: this.getCustomerInclude(),
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: customers.map(customer => this.mapToCustomerDto(customer)),
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

  async findOne(id: string): Promise<CustomerDto> {
    const customer = await this.prisma.customer.findFirst({
      where: {
        id,
        isDeleted: false,
      },
      include: this.getCustomerInclude({ ordersTake: 10 }),
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    return this.mapToCustomerDto(customer);
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto
  ): Promise<CustomerDto> {
    return await this.prisma.$transaction(async tx => {
      // Check if customer exists
      const existingCustomer = await tx.customer.findFirst({
        where: {
          id,
          isDeleted: false,
        },
      });

      if (!existingCustomer) {
        throw new NotFoundException("Customer not found");
      }

      // Update person if person data is provided
      if (updateCustomerDto.person) {
        const personUpdateData: any = {};

        if (updateCustomerDto.person.firstName !== undefined) {
          personUpdateData.firstName = updateCustomerDto.person.firstName;
        }
        if (updateCustomerDto.person.lastName !== undefined) {
          personUpdateData.lastName = updateCustomerDto.person.lastName;
        }
        if (updateCustomerDto.person.phone !== undefined) {
          personUpdateData.phone = updateCustomerDto.person.phone;
        }
        if (updateCustomerDto.person.email !== undefined) {
          personUpdateData.email = updateCustomerDto.person.email;
        }
        if (updateCustomerDto.person.docType !== undefined) {
          personUpdateData.docType = updateCustomerDto.person.docType;
        }
        if (updateCustomerDto.person.docNumber !== undefined) {
          personUpdateData.docNumber = updateCustomerDto.person.docNumber;
        }

        if (Object.keys(personUpdateData).length > 0) {
          personUpdateData.updatedAt = new Date();

          await tx.person.update({
            where: { id: existingCustomer.personId },
            data: personUpdateData,
          });
        }
      }

      // Verify user exists if userId is being updated
      if (updateCustomerDto.userId) {
        const user = await tx.user.findFirst({
          where: {
            id: updateCustomerDto.userId,
            isDeleted: false,
          },
        });

        if (!user) {
          throw new NotFoundException("User not found");
        }
      }

      // Verify address exists if defaultBillingAddressId is being updated
      if (updateCustomerDto.defaultBillingAddressId) {
        const address = await tx.address.findFirst({
          where: {
            id: updateCustomerDto.defaultBillingAddressId,
            isDeleted: false,
          },
        });

        if (!address) {
          throw new NotFoundException("Address not found");
        }
      }

      // Validate price type IDs if provided
      if (
        updateCustomerDto.priceTypeIds &&
        updateCustomerDto.priceTypeIds.length > 0
      ) {
        const existingPriceTypes = await tx.priceType.findMany({
          where: {
            id: { in: updateCustomerDto.priceTypeIds },
            isDeleted: false,
            isActive: true,
          },
          select: { id: true },
        });

        if (
          existingPriceTypes.length !== updateCustomerDto.priceTypeIds.length
        ) {
          throw new BadRequestException(
            "One or more price type IDs are invalid or inactive"
          );
        }
      }

      // Validate discount code IDs if provided
      if (
        updateCustomerDto.discountCodeIds &&
        updateCustomerDto.discountCodeIds.length > 0
      ) {
        const existingDiscountCodes = await tx.discountCode.findMany({
          where: {
            id: { in: updateCustomerDto.discountCodeIds },
            isDeleted: false,
            isActive: true,
          },
          select: { id: true },
        });

        if (
          existingDiscountCodes.length !==
          updateCustomerDto.discountCodeIds.length
        ) {
          throw new BadRequestException(
            "One or more discount code IDs are invalid or inactive"
          );
        }
      }

      // Prepare customer update data (exclude person object, discountCodeIds, priceTypeIds, and initialOpeningBalance)
      // initialOpeningBalance is handled separately to create/update the payment transaction
      const {
        discountCodeIds,
        priceTypeIds,
        initialOpeningBalance,
        person: _ignoredPerson,
        address: addressInput,
        ...customerData
      } = updateCustomerDto;

      // Handle home/billing address: update existing address or create a new one
      if (addressInput !== undefined && hasAddressContent(addressInput)) {
        if (existingCustomer.defaultBillingAddressId) {
          await tx.address.update({
            where: { id: existingCustomer.defaultBillingAddressId },
            data: {
              address: addressInput.address,
              city: addressInput.city,
              postalCode: addressInput.postalCode,
              updatedAt: new Date(),
            },
          });
        } else {
          const createdAddress = await tx.address.create({
            data: {
              personId: existingCustomer.personId,
              address: addressInput.address,
              city: addressInput.city,
              postalCode: addressInput.postalCode,
            },
          });
          customerData.defaultBillingAddressId = createdAddress.id;
        }
      }

      // Handle discount codes update
      if (discountCodeIds !== undefined) {
        const newDiscountCodeIds = new Set(discountCodeIds);

        // Get all existing discount code assignments (including soft-deleted)
        const existingCustomerDiscountCodes =
          await tx.customerDiscountCode.findMany({
            where: { customerId: id },
            select: { discountCodeId: true, isDeleted: true },
          });

        const existingDiscountCodeIds = existingCustomerDiscountCodes
          .filter(cdc => !cdc.isDeleted)
          .map(cdc => cdc.discountCodeId);

        // Soft delete assignments that are no longer in the new list
        const discountCodeIdsToDelete = existingDiscountCodeIds.filter(
          existingId => !newDiscountCodeIds.has(existingId)
        );

        if (discountCodeIdsToDelete.length > 0) {
          await tx.customerDiscountCode.updateMany({
            where: {
              customerId: id,
              discountCodeId: { in: discountCodeIdsToDelete },
              isDeleted: false,
            },
            data: {
              isDeleted: true,
            },
          });
        }

        // Batch restore/create discount code assignments
        const existingDiscountCodeIdSet = new Set(
          existingCustomerDiscountCodes.map(cdc => cdc.discountCodeId)
        );
        const discountCodeIdsToCreate = discountCodeIds.filter(
          dcId => !existingDiscountCodeIdSet.has(dcId)
        );
        const discountCodeIdsToRestore = discountCodeIds.filter(dcId =>
          existingDiscountCodeIdSet.has(dcId)
        );

        if (discountCodeIdsToRestore.length > 0) {
          await tx.customerDiscountCode.updateMany({
            where: {
              customerId: id,
              discountCodeId: { in: discountCodeIdsToRestore },
            },
            data: { isDeleted: false },
          });
        }

        if (discountCodeIdsToCreate.length > 0) {
          await tx.customerDiscountCode.createMany({
            data: discountCodeIdsToCreate.map(discountCodeId => ({
              customerId: id,
              discountCodeId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Handle price types update
      if (priceTypeIds !== undefined) {
        // First, soft delete all existing price type assignments
        const newPriceTypeIds = new Set(priceTypeIds);

        const existinCustomerPrices = await tx.customerPrice.findMany({
          where: { customerId: id },
          select: { priceTypeId: true },
        });

        const existingPriceTypeIds = existinCustomerPrices.map(
          cp => cp.priceTypeId
        );

        const priceTypeIdsToDelete = existingPriceTypeIds.filter(
          existingId => !newPriceTypeIds.has(existingId)
        );

        if (priceTypeIdsToDelete.length > 0) {
          await tx.customerPrice.updateMany({
            where: {
              customerId: id,
              priceTypeId: { in: priceTypeIdsToDelete },
              isDeleted: false,
            },
            data: {
              isDeleted: true,
              deletedAt: new Date(),
            },
          });
        }

        // Batch restore/create price type assignments
        const existingPriceTypeIdSet = new Set(existingPriceTypeIds);
        const priceTypeIdsToCreate = priceTypeIds.filter(
          ptId => !existingPriceTypeIdSet.has(ptId)
        );
        const priceTypeIdsToRestore = priceTypeIds.filter(ptId =>
          existingPriceTypeIdSet.has(ptId)
        );

        if (priceTypeIdsToRestore.length > 0) {
          await tx.customerPrice.updateMany({
            where: {
              customerId: id,
              priceTypeId: { in: priceTypeIdsToRestore },
            },
            data: { isDeleted: false, deletedAt: null },
          });
        }

        if (priceTypeIdsToCreate.length > 0) {
          await tx.customerPrice.createMany({
            data: priceTypeIdsToCreate.map(priceTypeId => ({
              customerId: id,
              priceTypeId,
            })),
            skipDuplicates: true,
          });
        }
      }
      // Update the customer
      const updatedCustomer = await tx.customer.update({
        where: { id },
        data: {
          ...customerData,
          updatedAt: new Date(),
        },
        include: this.getCustomerInclude(),
      });

      // Update opening balance payment transaction if initialOpeningBalance was provided
      if (initialOpeningBalance !== undefined) {
        // Get userId from request if available (would need to pass it from controller)
        // For now, we'll use undefined and keep existing createdBy
        await this.upsertOpeningBalancePayment(
          id,
          initialOpeningBalance,
          undefined, // TODO: Pass userId from controller if available
          tx
        );

        // Also update the customer's initialOpeningBalance field
        await tx.customer.update({
          where: { id },
          data: {
            initialOpeningBalance: new Decimal(initialOpeningBalance),
          },
        });
      }

      return this.mapToCustomerDto(updatedCustomer);
    });
  }

  async remove(id: string): Promise<DeleteCustomerResponseDto> {
    return await this.prisma.$transaction(async tx => {
      // Check if customer exists
      const existingCustomer = await tx.customer.findFirst({
        where: {
          id,
          isDeleted: false,
        },
      });

      if (!existingCustomer) {
        throw new NotFoundException("Customer not found");
      }

      // Soft delete the customer
      await tx.customer.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      return {
        success: true,
        message: "Customer deleted successfully",
        id,
      };
    });
  }

  // Build and return only the DataWorkbookRequest for ReportsService (preview/export)
  async exportCustomersReport(
    params: ExportFilters
  ): Promise<DataWorkbookRequest> {
    const { from, to } = normalizeDateRange({
      from: params.from,
      to: params.to,
    });
    const where: Prisma.CustomerWhereInput = {
      isDeleted: false,
      ...(params.search
        ? {
            OR: [
              {
                person: {
                  firstName: { contains: params.search, mode: "insensitive" },
                },
              },
              {
                person: {
                  lastName: { contains: params.search, mode: "insensitive" },
                },
              },
              {
                person: {
                  email: { contains: params.search, mode: "insensitive" },
                },
              },
              {
                person: {
                  phone: { contains: params.search, mode: "insensitive" },
                },
              },
              {
                person: {
                  docNumber: { contains: params.search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const customers = await this.prisma.customer.findMany({
      where,
      take: params.maxRows ?? MAX_EXPORT_ROWS,
      include: {
        person: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            docType: true,
            docNumber: true,
          },
        },
        customerPrices: {
          where: { isDeleted: false },
          include: { priceType: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const rows = customers.map(c => ({
      fullName:
        `${c.person?.firstName ?? ""} ${c.person?.lastName ?? ""}`.trim(),
      email: c.person?.email ?? "",
      phone: c.person?.phone ?? "",
      doc: c.person ? `${c.person.docType}-${c.person.docNumber}` : "",
      priceTypes:
        c.customerPrices
          ?.map(cp => cp.priceType?.name)
          .filter(Boolean)
          .join(", ") ?? "",
      createdAt: c.createdAt ?? null,
    }));

    const fields = [
      "fullName",
      "email",
      "phone",
      "doc",
      "priceTypes",
      "createdAt",
    ] as const;

    const headerMap = {
      fullName: "Customer",
      email: "Email",
      phone: "Phone",
      doc: "Document",
      priceTypes: "Price Types",
      createdAt: "Created At",
    } as const;

    const fileName = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return {
      fileName,
      sheets: [
        {
          name: "Customers",
          rows,
          fields,
          headerMap,
        },
      ],
    };
  }

  // Report of sales by customer (one row per order item)
  async exportSalesByCustomerReport(
    params: ExportFilters
  ): Promise<DataWorkbookRequest> {
    const { from, to } = normalizeDateRange({
      from: params.from,
      to: params.to,
    });

    const and: Prisma.OrderWhereInput[] = [{ customer: { isDeleted: false } }];

    if (params.branchId) and.push({ branchId: params.branchId });
    if (params.customerId) and.push({ customerId: params.customerId });
    if (params.locationId) and.push({ locationId: params.locationId });
    if (params.employeeId) {
      and.push({
        OR: [{ sellerId: params.employeeId }, { cashierId: params.employeeId }],
      });
    }

    if (params.orderNumber) {
      and.push({
        orderNumber: { contains: params.orderNumber, mode: "insensitive" },
      });
    }

    if (params.paymentMethod) {
      and.push({ paymentMethod: params.paymentMethod });
    }

    if (params.orderStatus) {
      and.push({ status: params.orderStatus });
    }

    if (from || to) {
      and.push({
        createdAt: {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        },
      });
    }

    const where: Prisma.OrderWhereInput = and.length ? { AND: and } : {};

    const orders = await this.prisma.order.findMany({
      where,
      take: params.maxRows ?? MAX_EXPORT_ROWS,
      include: {
        customer: {
          include: {
            person: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                docNumber: true,
              },
            },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
        location: { select: { id: true, name: true, locationType: true } },
        seller: {
          select: {
            id: true,
            person: { select: { firstName: true, lastName: true } },
          },
        },
        cashier: {
          select: {
            id: true,
            person: { select: { firstName: true, lastName: true } },
          },
        },
        payments: {
          select: {
            paymentType: true,
            provider: true,
            amount: true,
            paidAt: true,
          },
        },
        discountCode: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Create one row per order (not per order item)
    const rows = orders.map(o => {
      const customerName =
        `${o.customer?.person?.firstName ?? ""} ${o.customer?.person?.lastName ?? ""}`.trim();
      // Use location name instead of branch name
      const locationName = o.location?.name ?? "";
      // Translate payment types
      const paymentTypes = (o.payments ?? [])
        .map(p => p.paymentType)
        .filter(Boolean)
        .map(pt => translatePaymentType(pt));
      // If no payments, use order paymentMethod as fallback
      const paymentType =
        paymentTypes.length > 0
          ? paymentTypes.join(", ")
          : o.paymentMethod
            ? translatePaymentType(o.paymentMethod)
            : "";

      const sellerName = o.seller
        ? `${o.seller.person?.firstName ?? ""} ${o.seller.person?.lastName ?? ""}`.trim()
        : "";
      const cashierName = o.cashier
        ? `${o.cashier.person?.firstName ?? ""} ${o.cashier.person?.lastName ?? ""}`.trim()
        : "";

      const orderStatus =
        typeof o.status === "string"
          ? o.status
          : typeof (o as any).orderStatus === "string"
            ? (o as any).orderStatus
            : String(o.status ?? (o as any).orderStatus ?? "");

      // Return one row per order with order-level fields
      return {
        date: o.createdAt ?? null,
        orderNumber: o.orderNumber ?? "",
        customer: customerName,
        branch: locationName,

        // keep seller/cashier names on each row so ReportsService can extract employee
        sellerName: sellerName,
        cashierName: cashierName,
        status: translateOrderStatus(orderStatus),

        // add discountCode field (string) from included relation
        discountCode: o.discountCode?.code ?? "",

        orderDiscount: Number(o.discountAmount?.toString() ?? 0),
        orderSubtotal: Number(o.subtotal?.toString() ?? 0),
        orderTaxes: Number(o.taxes?.toString() ?? 0),
        orderTotal: Number(o.totalAmount?.toString() ?? 0),

        paymentType,
      };
    });

    const fields = [
      "date",
      "orderNumber",
      "sellerName",
      "customer",
      "branch",
      "orderDiscount",
      "orderSubtotal",
      "orderTaxes",
      "orderTotal",
      "paymentType",
      "discountCode",
      "status",
    ] as const;

    const headerMap = {
      date: "Fecha",
      orderNumber: "# Orden",
      sellerName: "Vendedor",
      customer: "Cliente",
      branch: "Ubicación",
      orderDiscount: "Descuento Total",
      orderSubtotal: "Subtotal",
      orderTaxes: "Impuestos",
      orderTotal: "Total",
      paymentType: "Tipo de pago",
      discountCode: "Código de descuento",
      status: "Estado",
    } as const;

    // Calculate totals for all numeric columns (orderDiscount, orderSubtotal, orderTaxes, orderTotal)
    const numericFields: Array<(typeof fields)[number]> = [
      "orderDiscount",
      "orderSubtotal",
      "orderTaxes",
      "orderTotal",
    ];
    const numericFieldIndices = numericFields
      .map(field => {
        const index = fields.indexOf(field);
        return index >= 0 ? { field, index } : null;
      })
      .filter(
        (item): item is { field: (typeof fields)[number]; index: number } =>
          item !== null
      );

    if (numericFieldIndices.length > 0) {
      const sums: Record<(typeof fields)[number], number> = {} as Record<
        (typeof fields)[number],
        number
      >;
      for (const { field } of numericFieldIndices) {
        sums[field] = 0;
      }

      for (const row of rows) {
        for (const { field } of numericFieldIndices) {
          const value = (row as any)[field];
          if (typeof value === "number") {
            sums[field] += value;
          } else if (value != null) {
            const num = Number(value);
            if (!Number.isNaN(num)) {
              sums[field] += num;
            }
          }
        }
      }

      // Check if any sum is non-zero
      const hasNonZeroSum = Object.values(sums).some(
        s => !Number.isNaN(s) && s !== 0
      );

      if (hasNonZeroSum) {
        const totalRow: any = {};
        // Create total row with empty values except for numeric columns
        fields.forEach((field, index) => {
          if (index === 0) {
            // Put "Total" label in first column
            totalRow[field] = "Total";
          } else {
            // Check if this field is one of the numeric fields we're summing
            const numericField = numericFieldIndices.find(
              nf => nf.field === field
            );
            if (numericField) {
              // Put sum in the corresponding numeric column
              totalRow[field] = sums[numericField.field];
            } else {
              totalRow[field] = "";
            }
          }
        });
        rows.push(totalRow);
      }
    }

    const fileName = `reporte-de-ventas-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

    return {
      fileName,
      sheets: [
        {
          name: "Reporte de ventas",
          rows,
          fields,
          headerMap,
        },
      ],
    };
  }

  /**
   * Get customer outstanding credit amount
   */
  async getOutstandingCredits(
    customerId: string
  ): Promise<{ outstandingAmount: number; creditLimit: number | null }> {
    // Get customer with credit information
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        creditAllowed: true,
        creditLimit: true,
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    const creditLimit = customer.creditLimit
      ? Number(customer.creditLimit)
      : null;

    // Calculate current outstanding amount from active credits (including OVERDUE)
    const activeCredits = await this.prisma.credit.findMany({
      where: {
        customerId,
        status: {
          in: [CreditStatus.ACTIVE, CreditStatus.PENDING, CreditStatus.OVERDUE],
        },
      },
      select: {
        outstandingAmount: true,
      },
    });

    const outstandingAmount = activeCredits.reduce(
      (sum, credit) => sum + Number(credit.outstandingAmount),
      0
    );

    return {
      outstandingAmount,
      creditLimit,
    };
  }

  /**
   * Get customer account statement
   * Minimum date is December 31, 2025 (migration date)
   */
  async getAccountStatement(
    customerId: string,
    params: {
      from?: string;
      to?: string;
      page?: number;
      limit?: number;
      transactionType?: string;
    } = {}
  ): Promise<any> {
    // Migration date is December 31, 2025 at start of day (00:00:00.000 UTC)
    const MIGRATION_DATE = new Date("2025-12-31T00:00:00.000Z");
    const MIN_DATE = MIGRATION_DATE;

    // Parse and validate dates
    // Important: Database uses UTC (timestamptz), so we must create dates in UTC
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (params.from) {
      // Parse the date string (format: YYYY-MM-DD) and set to start of day in UTC (00:00:00.000)
      // Use explicit UTC parsing to avoid timezone issues
      const [year, month, day] = params.from.split("-").map(Number);
      fromDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      if (fromDate.getTime() < MIN_DATE.getTime()) {
        throw new BadRequestException(
          `Date range cannot be before December 31, 2025 (migration date)`
        );
      }
    } else {
      fromDate = MIN_DATE;
    }

    if (params.to) {
      // Parse the date string (format: YYYY-MM-DD) and set to end of day in UTC (23:59:59.999)
      // Use explicit UTC parsing to avoid timezone issues
      const [year, month, day] = params.to.split("-").map(Number);
      toDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      if (toDate.getTime() < MIN_DATE.getTime()) {
        throw new BadRequestException(
          `Date range cannot be before December 31, 2025 (migration date)`
        );
      }
    } else {
      // Set to end of current day in UTC
      const now = new Date();
      const year = now.getUTCFullYear();
      const month = now.getUTCMonth();
      const day = now.getUTCDate();
      toDate = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    }

    if (fromDate > toDate) {
      throw new BadRequestException("From date cannot be after to date");
    }

    // Get customer with initial opening balance
    const customer = await this.prisma.customer.findFirst({
      where: {
        id: customerId,
        isDeleted: false,
      },
      select: {
        id: true,
        creditAllowed: true,
        creditLimit: true,
        initialOpeningBalance: true,
        person: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException("Customer not found");
    }

    // Get opening balance from persistent payment transaction
    const openingBalancePayment = await this.prisma.payment.findFirst({
      where: {
        customerId,
        transactionReference: this.OPENING_BALANCE_REFERENCE,
        orderId: null,
        creditInstallmentId: null,
      },
    });

    // Get the original opening balance from the payment transaction
    // If it doesn't exist, fall back to customer.initialOpeningBalance (for backward compatibility)
    const originalOpeningBalance = openingBalancePayment
      ? Number(openingBalancePayment.amount || 0)
      : customer.initialOpeningBalance
        ? Number(customer.initialOpeningBalance)
        : 0;

    // Calculate opening balance at the start of the selected period
    // If fromDate is exactly the migration date, use the original opening balance
    // Otherwise, calculate balance from all transactions before fromDate
    let openingBalance = originalOpeningBalance;

    if (fromDate.getTime() > MIN_DATE.getTime()) {
      // Run independent "before" queries in parallel
      const [ordersBefore, paymentsBefore, creditNotesBefore] =
        await Promise.all([
          this.prisma.order.findMany({
            where: {
              customerId,
              createdAt: { gte: MIN_DATE, lt: fromDate },
              status: { not: "ANNULLED" },
            },
            include: {
              credit: { select: { principalAmount: true } },
            },
          }),
          this.prisma.payment.findMany({
            where: {
              customerId,
              paidAt: { gte: MIN_DATE, lt: fromDate },
              AND: [
                {
                  OR: [
                    { transactionReference: null },
                    {
                      transactionReference: {
                        not: this.OPENING_BALANCE_REFERENCE,
                      },
                    },
                  ],
                },
                {
                  OR: [
                    {
                      order: {
                        status: { in: ["APPROVED", "COMPLETED"] },
                      },
                    },
                    {
                      creditInstallment: {
                        credit: {
                          order: {
                            status: { in: ["APPROVED", "COMPLETED"] },
                          },
                        },
                      },
                    },
                    { orderId: null, creditInstallmentId: null },
                  ],
                },
              ],
            },
            select: {
              id: true,
              amount: true,
              transactionType: true,
              originalPaymentId: true,
            },
          }),
          this.prisma.creditNote.findMany({
            where: {
              customerId,
              createdAt: { gte: MIN_DATE, lt: fromDate },
            },
            select: { amount: true },
          }),
        ]);

      // Calculate: initial balance + credits created - payments made
      // Exclude PENDING credit orders (not approved yet) from opening balance
      const creditsBefore = ordersBefore
        .filter(
          o =>
            o.paymentMethod === "CREDIT" && o.credit && o.status !== "PENDING"
        )
        .reduce((sum, o) => sum + Number(o.credit!.principalAmount), 0);

      // A payment reversal (transactionType REVERSAL) is NOT a standalone debit: it reduces the credit of
      // the ORIGINAL payment it undoes (same semantics as computeStatementBalances / the in-range ledger).
      // Netting it here — instead of adding it back unconditionally — keeps the opening balance correct when
      // the original payment was excluded above because its order is now ANNULLED: otherwise the reversal
      // would inflate the balance with no matching credit to offset. Fully valid or account-level payments
      // still net to the exact same result.
      const reversedBeforeByOriginal = paymentsBefore.reduce(
        (acc, p) => {
          const tt = (p as { transactionType?: string }).transactionType;
          const originalId = (p as { originalPaymentId?: string | null })
            .originalPaymentId;
          if (tt === "REVERSAL" && originalId) {
            acc[originalId] =
              (acc[originalId] ?? 0) +
              Number((p as { amount?: unknown }).amount || 0);
          }
          return acc;
        },
        {} as Record<string, number>
      );

      // Regular payments (PAYMENT / legacy null) are credits (reduce balance), net of any reversal applied
      // to them within this period.
      const regularPaymentsBeforeTotal = paymentsBefore.reduce((sum, p) => {
        const tt = (p as { transactionType?: string }).transactionType;
        if (tt === "REFUND" || tt === "REVERSAL") return sum;
        const reversed =
          reversedBeforeByOriginal[(p as { id: string }).id] ?? 0;
        return sum + Math.max(0, Number(p.amount || 0) - reversed);
      }, 0);

      // Only genuine refunds (money physically returned to the customer) add back to the balance as a debit.
      // REVERSALs are already netted above against their original payment.
      const refundReversalBeforeTotal = paymentsBefore.reduce((sum, p) => {
        const tt = (p as { transactionType?: string }).transactionType;
        if (tt === "REFUND") return sum + Number(p.amount || 0);
        return sum;
      }, 0);

      // Credit notes from annulled orders reduce the customer's balance (are credits)
      const creditNotesBeforeTotal = creditNotesBefore.reduce(
        (sum, cn) => sum + Number(cn.amount),
        0
      );

      // Opening balance = original + credits created - regular payments + refunds/reversals + credit notes
      openingBalance =
        originalOpeningBalance +
        creditsBefore -
        regularPaymentsBeforeTotal +
        refundReversalBeforeTotal +
        creditNotesBeforeTotal;
    }

    // Run independent in-range queries in parallel
    const [orders, annulledOrders, paymentsRaw, creditNotes] =
      await Promise.all([
        this.prisma.order.findMany({
          where: {
            customerId,
            createdAt: { gte: fromDate, lte: toDate },
            status: { not: { in: ["ANNULLED", "PENDING"] } },
          },
          include: {
            payments: {
              where: { creditInstallmentId: null },
            },
            credit: {
              include: {
                installments: {
                  include: { payments: true },
                  orderBy: { installmentNo: "asc" },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
        this.prisma.order.findMany({
          where: {
            customerId,
            createdAt: { gte: fromDate, lte: toDate },
            status: "ANNULLED",
            paymentMethod: "CREDIT",
            creditId: { not: null },
          },
          select: {
            id: true,
            orderNumber: true,
            totalAmount: true,
            createdAt: true,
            creditId: true,
          },
          orderBy: { createdAt: "asc" },
        }),
        this.prisma.payment.findMany({
          where: {
            customerId,
            paidAt: { gte: fromDate, lte: toDate },
            AND: [
              {
                OR: [
                  { transactionReference: null },
                  {
                    transactionReference: {
                      not: this.OPENING_BALANCE_REFERENCE,
                    },
                  },
                ],
              },
            ],
          },
          include: {
            order: {
              select: { orderNumber: true, status: true },
            },
            creditInstallment: {
              include: {
                credit: {
                  include: {
                    order: {
                      select: { orderNumber: true, status: true },
                    },
                  },
                },
              },
            },
            originalPayment: {
              select: {
                paymentType: true,
                orderId: true,
                creditInstallmentId: true,
                transactionReference: true,
                order: { select: { orderNumber: true } },
                creditInstallment: {
                  select: {
                    installmentNo: true,
                    credit: {
                      select: { order: { select: { orderNumber: true } } },
                    },
                  },
                },
              },
            },
          },
          orderBy: { paidAt: "asc" },
        }),
        this.prisma.creditNote.findMany({
          where: {
            customerId,
            createdAt: { gte: fromDate, lte: toDate },
          },
          include: {
            order: {
              select: { orderNumber: true, status: true },
            },
            creditInstallment: {
              select: { id: true, installmentNo: true },
            },
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

    const payments = paymentsRaw.filter(p => {
      const orderStatus =
        p.order?.status ?? p.creditInstallment?.credit?.order?.status;
      return orderStatus !== "ANNULLED";
    });

    // Build transaction list
    const transactions: any[] = [];

    if (openingBalance !== 0 || fromDate.getTime() === MIN_DATE.getTime()) {
      // Fallback: create calculated opening balance transaction (for backward compatibility)
      transactions.push({
        id: `opening-balance-${customerId}-${fromDate.toISOString()}`,
        type: "INITIAL_BALANCE",
        date: fromDate.toISOString(),
        description:
          fromDate.getTime() === MIN_DATE.getTime()
            ? "Saldo Inicial (Migración)"
            : "Saldo Inicial",
        reference:
          fromDate.getTime() === MIN_DATE.getTime()
            ? "MIGRACIÓN"
            : "SALDO_INICIAL",
        debit: openingBalance > 0 ? openingBalance : null,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : null,
        balance: openingBalance,
        metadata: {},
      });
    }

    // Add orders as transactions
    for (const order of orders) {
      if (order.paymentMethod === "CREDIT" && order.credit) {
        // Credit order - add as debit
        transactions.push({
          id: `order-${order.id}`,
          type: "ORDER",
          date: order.createdAt.toISOString(),
          description: `Orden de Crédito ${order.orderNumber || order.id}`,
          reference: order.orderNumber || `ORD-${order.id.slice(0, 8)}`,
          debit: Number(order.totalAmount || 0),
          credit: null,
          balance: 0, // Will be calculated
          metadata: {
            orderId: order.id,
            creditId: order.credit.id,
          },
        });

        // One line per down payment (same as cuotas): correct dates, paymentId, and reversed flag for summary totals.
        for (const p of order.payments) {
          const amt = Number(p.amount || 0);
          if (amt <= 0) continue;
          const isReversed = p.status === PaymentLifecycleStatus.REVERSED;
          transactions.push({
            id: `payment-initial-${p.id}`,
            type: "PAYMENT",
            date: p.paidAt.toISOString(),
            description: `Pago Inicial - Pedido ${order.orderNumber || order.id}`,
            reference: order.orderNumber || `ORD-${order.id.slice(0, 8)}`,
            debit: null,
            credit: amt,
            balance: 0, // Will be calculated
            metadata: {
              orderId: order.id,
              paymentId: p.id,
              reversed: isReversed,
              legacyGroupId: `initial-payment-${order.id}`,
            },
          });
        }

        // NOTE: Installments are NOT added as separate transactions
        // The full credit order amount is already debited above.
        // Installments are payment schedules shown in the Credits section,
        // not separate charges that affect the account balance.
      }
    }

    // Add annulled orders as debits so the ledger shows full audit trail.
    // Per investigation: use sum(credit notes) as debit (not Order.totalAmount) so that
    // debit = sum(credit notes) → net effect for that order = 0; Saldo Final correct
    // even when order was partially annulled (items) before full annul. Only show line if sum > 0.
    const creditNotesByOrderId = creditNotes.reduce(
      (acc, cn) => {
        const id = cn.orderId ?? "none";
        if (!acc[id]) acc[id] = 0;
        acc[id] += Number(cn.amount);
        return acc;
      },
      {} as Record<string, number>
    );
    for (const order of annulledOrders) {
      const sumCreditNotes = creditNotesByOrderId[order.id] ?? 0;
      if (sumCreditNotes <= 0) continue;
      const debitAmount = sumCreditNotes;
      transactions.push({
        id: `order-annulled-${order.id}`,
        type: "ORDER",
        date: order.createdAt.toISOString(),
        description: `Orden de Crédito (Anulada) ${order.orderNumber || order.id}`,
        reference: order.orderNumber || `ORD-${order.id.slice(0, 8)}`,
        debit: debitAmount,
        credit: null,
        balance: 0, // Will be calculated
        metadata: {
          orderId: order.id,
          creditId: order.creditId!,
          annulled: true,
        },
      });
    }

    // Add payments as transactions
    for (const payment of payments) {
      if (
        payment.creditInstallmentId !== null &&
        payment.creditInstallmentId !== undefined
      ) {
        // Installment payment
        const isReversed =
          (payment as { status?: string }).status === "REVERSED";
        const installment = payment.creditInstallment;
        transactions.push({
          id: `payment-installment-${payment.id}`,
          type: "PAYMENT",
          date: payment.paidAt.toISOString(),
          description: `Pago - Cuota #${installment?.installmentNo} - Pedido ${installment?.credit?.order?.orderNumber || "N/A"}`,
          reference: installment?.credit?.order?.orderNumber || "N/A",
          debit: null,
          credit: Number(payment.amount || 0),
          balance: 0, // Will be calculated
          metadata: {
            paymentId: payment.id,
            creditId: installment?.credit?.id,
            installmentId: installment?.id,
            reversed: isReversed,
          },
        });
      } else if (payment.orderId) {
        // Order payment (already handled above, but add if not already added)
        const existing = transactions.find(
          t => t.metadata?.paymentId === payment.id
        );
        if (!existing) {
          const isReversed =
            (payment as { status?: string }).status === "REVERSED";
          transactions.push({
            id: `payment-order-${payment.id}`,
            type: "PAYMENT",
            date: payment.paidAt.toISOString(),
            description: `Pago - Orden ${payment.order?.orderNumber || "N/A"}`,
            reference: payment.order?.orderNumber || "N/A",
            debit: null,
            credit: Number(payment.amount || 0),
            balance: 0, // Will be calculated
            metadata: {
              paymentId: payment.id,
              orderId: payment.orderId,
              reversed: isReversed,
            },
          });
        }
      } else if (
        payment.customerId &&
        !payment.orderId &&
        !payment.creditInstallmentId
      ) {
        // Customer account payment (applied to opening balance and/or credits)
        // Check if this payment was already added (might have been added via credit allocation)
        const existing = transactions.find(
          t => t.metadata?.paymentId === payment.id
        );
        if (!existing) {
          // Use transactionType only (user-editable transactionReference is not used for refund detection)
          const isReversed =
            (payment as { status?: string }).status === "REVERSED";
          const isRefund =
            (payment as { transactionType?: string }).transactionType ===
            "REFUND";
          const isReversal =
            (payment as { transactionType?: string }).transactionType ===
            "REVERSAL";
          const amount = Number(payment.amount || 0);
          // Refund = money we return to the customer → reduces their credit balance → debit (increases running balance toward zero)
          // Payment = money customer gave us → credit (reduces what they owe)
          transactions.push({
            id: `payment-account-${payment.id}`,
            type: isRefund || isReversal ? "REFUND" : "PAYMENT",
            date: payment.paidAt.toISOString(),
            description: isRefund
              ? "Devolución a Cliente"
              : isReversal
                ? "Reversión de Pago"
                : "Pago a Cuenta",
            reference: isReversal
              ? displayReversalStatementReference({
                  reversalRef: payment.transactionReference,
                  originalPaymentId: payment.originalPaymentId,
                  originalPayment: payment.originalPayment ?? undefined,
                })
              : (payment.transactionReference ??
                `PAY-${payment.id.slice(0, 8).toUpperCase()}`),
            debit: isRefund || isReversal ? amount : null,
            credit: isRefund || isReversal ? null : amount,
            balance: 0, // Will be calculated
            metadata: {
              paymentId: payment.id,
              reversed: isReversed,
              transactionType: payment.transactionType,
              originalPaymentId: payment.originalPaymentId ?? null,
              legacyType: "PAYMENT",
            },
          });
        }
      }
    }

    // Add credit notes (notas de crédito) as transactions
    // Credit notes reduce the customer's balance (are credits)
    for (const creditNote of creditNotes) {
      // Generate description if not provided
      let description = creditNote.description;
      if (!description) {
        if (creditNote.orderId && creditNote.creditInstallmentId) {
          description = `Nota de Crédito - Pago Cuota #${creditNote.creditInstallment?.installmentNo} - Pedido Anulado ${creditNote.order?.orderNumber || "N/A"}`;
        } else if (creditNote.orderId) {
          description = `Nota de Crédito - Pago Inicial - Pedido Anulado ${creditNote.order?.orderNumber || "N/A"}`;
        } else {
          description = `Nota de Crédito Manual`;
        }
      }

      transactions.push({
        id: `credit-note-${creditNote.id}`,
        type: "CREDIT_NOTE",
        date: creditNote.createdAt.toISOString(),
        description,
        reference: creditNote.order?.orderNumber || "MANUAL",
        debit: null,
        credit: Number(creditNote.amount), // Credit reduces customer balance
        balance: 0, // Will be calculated
        metadata: {
          creditNoteId: creditNote.id,
          orderId: creditNote.orderId,
          paymentId: creditNote.paymentId,
          creditInstallmentId: creditNote.creditInstallmentId,
        },
      });
    }

    // Sort transactions by date
    transactions.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      // If same date, order: INITIAL_BALANCE, ORDER, CREDIT_INSTALLMENT, PAYMENT, REFUND, CREDIT_NOTE
      const order = {
        INITIAL_BALANCE: 0,
        ORDER: 1,
        CREDIT_INSTALLMENT: 2,
        PAYMENT: 3,
        REFUND: 4,
        CREDIT_NOTE: 5,
      };
      return (
        (order[a.type as keyof typeof order] || 99) -
        (order[b.type as keyof typeof order] || 99)
      );
    });

    // Compute the running balance and summary totals. A payment reversal (transactionType REVERSAL) is an
    // audit debit line that does NOT move the balance on its own; instead it reduces the credit of the
    // ORIGINAL payment it reverses. This is what makes PARTIAL reversals correct — e.g. a global "Pago a
    // Cuenta" split across two orders where only one is later annulled keeps the still-valid portion
    // reducing the balance and only undoes the annulled portion. See statement-balance.util.ts.
    const { totalCharges, totalPayments, closingBalance } =
      computeStatementBalances(transactions, openingBalance);

    // Get active credits for display (exclude PENDING - not approved yet, not reflected in statement)
    const activeCredits = await this.prisma.credit.findMany({
      where: {
        customerId,
        status: {
          in: [CreditStatus.ACTIVE, CreditStatus.OVERDUE],
        },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
          },
        },
        installments: {
          orderBy: {
            installmentNo: "asc",
          },
        },
      },
    });

    // Get outstanding amount (exclude PENDING - not approved yet)
    const outstandingCredits = await this.prisma.credit.findMany({
      where: {
        customerId,
        status: {
          in: [
            CreditStatus.APPROVED,
            CreditStatus.ACTIVE,
            CreditStatus.OVERDUE,
          ],
        },
      },
      select: {
        outstandingAmount: true,
      },
    });

    const outstandingAmount = outstandingCredits.reduce(
      (sum, credit) => sum + Number(credit.outstandingAmount),
      0
    );

    const creditLimit = customer.creditLimit
      ? Number(customer.creditLimit)
      : null;

    // Calculate available credit
    // Use closingBalance directly as it already includes:
    // - Initial opening balance
    // - All credit orders and installments (debits)
    // - All payments (credits)
    // It represents the total amount the customer owes
    // If closingBalance is negative (customer has credit in favor), use 0 instead
    const creditUsed = Math.max(closingBalance, 0);
    const availableCredit =
      creditLimit !== null ? Math.max(0, creditLimit - creditUsed) : null;

    // Filter by transaction type if specified
    let filteredTransactions = transactions;
    if (params.transactionType) {
      const allowedTypes = new Set(
        params.transactionType.split(",").map(t => t.trim().toUpperCase())
      );
      filteredTransactions = transactions.filter(t => allowedTypes.has(t.type));
    }

    // Pagination
    const page = params.page && params.page > 0 ? params.page : 1;
    const limit = params.limit && params.limit > 0 ? params.limit : 1000;
    const total = filteredTransactions.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedTransactions = filteredTransactions.slice(
      (page - 1) * limit,
      page * limit
    );

    const response = {
      customer: {
        id: customer.id,
        person: {
          firstName: customer.person.firstName,
          lastName: customer.person.lastName,
          email: customer.person.email,
          phone: customer.person.phone,
        },
        creditAllowed: customer.creditAllowed ?? false,
        creditLimit,
        initialOpeningBalance: customer.initialOpeningBalance
          ? Number(customer.initialOpeningBalance)
          : 0,
      },
      summary: {
        openingBalance,
        totalCharges,
        totalPayments,
        closingBalance,
        creditLimit,
        availableCredit,
        outstandingAmount,
      },
      transactions: paginatedTransactions,
      credits: activeCredits.map(credit => ({
        id: credit.id,
        orderNumber: credit.order.orderNumber || "N/A",
        principalAmount: Number(credit.principalAmount),
        outstandingAmount: Number(credit.outstandingAmount),
        status: credit.status,
        createdAt: credit.createdAt.toISOString(),
        durationDays: credit.durationDays || null,
        installmentCount: credit.installmentCount,
        installments: credit.installments.map(inst => ({
          id: inst.id,
          installmentNo: inst.installmentNo,
          dueDate: inst.dueDate.toISOString(),
          amount: Number(inst.amount),
          paidAmount: Number(inst.paidAmount),
          status: inst.status,
        })),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };

    return response;
  }

  /**
   * Create a customer account payment and allocate it across all outstanding credits
   */
  async createCustomerPayment(
    customerId: string,
    dto: CreatePaymentDto,
    userId?: string
  ) {
    return this.paymentsService.createCustomerPayment(customerId, dto, userId);
  }

  /**
   * Create a customer refund (when the customer has a credit balance / negative statement).
   * Records money returned to the customer; appears as a debit on the statement, moving the balance
   * back toward zero.
   *
   * Non-negative guard: a refund can only return the customer's current credit-in-favor
   * (|closingBalance| when the statement is negative). This prevents a refund from overshooting and
   * flipping the statement into a positive balance (i.e. making it look like the customer owes money).
   */
  async createCustomerRefund(
    customerId: string,
    dto: CreatePaymentDto,
    userId?: string
  ) {
    const statement = await this.getAccountStatement(customerId);
    const closingBalance = Number(statement?.summary?.closingBalance ?? 0);
    const creditInFavor = Math.max(0, Math.round(-closingBalance * 100) / 100);

    if (creditInFavor <= 0) {
      throw new BadRequestException(
        "El cliente no tiene saldo a favor; no se puede registrar una devolución."
      );
    }

    const amount = Math.round(Number(dto.amount) * 100) / 100;
    if (amount > creditInFavor + 0.005) {
      throw new BadRequestException(
        `La devolución (${amount}) no puede exceder el saldo a favor del cliente (${creditInFavor}).`
      );
    }

    return this.paymentsService.createCustomerRefund(customerId, dto, userId);
  }
}

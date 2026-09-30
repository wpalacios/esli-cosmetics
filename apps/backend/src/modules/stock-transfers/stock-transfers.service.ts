import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";
import { NumberSequenceService } from "../number-sequence/number-sequence.service";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { UpdateTransferStatusDto } from "./dto/update-transfer-status.dto";
import { DispatchTransferDto } from "./dto/dispatch-transfer.dto";
import {
  ReceiveTransferDto,
  DiscrepancyType,
} from "./dto/receive-transfer.dto";
import { StockTransferDto } from "./dto/stock-transfer.dto";
import { TransferStatus, StockMovementType, Prisma } from "@prisma/client";
import { StockMovementsService } from "../stock-movements/stock-movements.service";

@Injectable()
export class StockTransfersService {
  private readonly logger = new Logger(StockTransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stockMovementsService: StockMovementsService,
    private readonly numberSequenceService: NumberSequenceService
  ) {}

  /**
   * Translate TransferStatus enum to Spanish
   */
  private translateStatus(status: TransferStatus): string {
    const statusTranslations: Record<TransferStatus, string> = {
      [TransferStatus.CREATED]: "Creada",
      [TransferStatus.ACCEPTED]: "Aceptada",
      [TransferStatus.DISPATCHING]: "Despachanda",
      [TransferStatus.IN_TRANSIT]: "En Tránsito",
      [TransferStatus.RECEIVED_COMPLETE]: "Recibida Completo",
      [TransferStatus.RECEIVED_PARTIAL]: "Recibida Parcialmente",
      [TransferStatus.CANCELLED]: "Cancelada",
    };
    return statusTranslations[status] || status;
  }

  /**
   * Validate state transition
   */
  private validateStateTransition(
    currentStatus: TransferStatus,
    newStatus: TransferStatus
  ): void {
    const allowedTransitions: Record<TransferStatus, TransferStatus[]> = {
      [TransferStatus.CREATED]: [
        TransferStatus.ACCEPTED,
        TransferStatus.CANCELLED,
      ],
      [TransferStatus.ACCEPTED]: [
        TransferStatus.DISPATCHING,
        TransferStatus.CANCELLED,
      ],
      [TransferStatus.DISPATCHING]: [
        TransferStatus.IN_TRANSIT,
        TransferStatus.CANCELLED,
      ],
      [TransferStatus.IN_TRANSIT]: [
        TransferStatus.RECEIVED_COMPLETE,
        TransferStatus.RECEIVED_PARTIAL,
      ],
      [TransferStatus.RECEIVED_COMPLETE]: [],
      [TransferStatus.RECEIVED_PARTIAL]: [],
      [TransferStatus.CANCELLED]: [],
    };

    const allowed = allowedTransitions[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid state transition from ${currentStatus} to ${newStatus}`
      );
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    tx: Prisma.TransactionClient,
    transferId: string,
    userId: string,
    previousStatus: TransferStatus,
    newStatus: TransferStatus,
    note: string
  ): Promise<void> {
    await tx.stockTransferLog.create({
      data: {
        transferId,
        userId,
        previousStatus,
        newStatus,
        note,
      },
    });
  }

  /**
   * Create a new transfer request
   */
  async create(
    createDto: CreateTransferDto,
    userId: string
  ): Promise<StockTransferDto> {
    this.logger.log("[CREATE] Creating new stock transfer");

    return await this.prisma.$transaction(
      async tx => {
        // Validate locations
        const [fromLocation, toLocation] = await Promise.all([
          tx.location.findUnique({
            where: { id: createDto.fromLocationId },
          }),
          tx.location.findUnique({
            where: { id: createDto.toLocationId },
          }),
        ]);

        if (!fromLocation) {
          throw new NotFoundException(
            `From location with ID ${createDto.fromLocationId} not found`
          );
        }

        if (!toLocation) {
          throw new NotFoundException(
            `To location with ID ${createDto.toLocationId} not found`
          );
        }

        if (fromLocation.id === toLocation.id) {
          throw new BadRequestException(
            "From and to locations cannot be the same"
          );
        }

        // Validate employees if provided (batch operation)
        // Note: Frontend sends employee IDs, but we need to get their userId
        const employeeIdsToValidate = [
          createDto.senderId,
          createDto.receiverId,
        ].filter((id): id is string => !!id);

        let senderUserId: string | undefined;
        let receiverUserId: string | undefined;

        if (employeeIdsToValidate.length > 0) {
          const employees = await tx.employee.findMany({
            where: {
              id: { in: employeeIdsToValidate },
              isDeleted: false,
              isActive: true,
            },
            include: {
              user: true,
            },
          });

          const employeeMap = new Map(employees.map(e => [e.id, e]));

          if (createDto.senderId) {
            const senderEmployee = employeeMap.get(createDto.senderId);
            if (!senderEmployee) {
              throw new NotFoundException(
                `Sender employee with ID ${createDto.senderId} not found or inactive`
              );
            }
            if (!senderEmployee.userId) {
              throw new BadRequestException(
                `Sender employee with ID ${createDto.senderId} is not linked to a user account`
              );
            }
            senderUserId = senderEmployee.userId;
          }

          if (createDto.receiverId) {
            const receiverEmployee = employeeMap.get(createDto.receiverId);
            if (!receiverEmployee) {
              throw new NotFoundException(
                `Receiver employee with ID ${createDto.receiverId} not found or inactive`
              );
            }
            if (!receiverEmployee.userId) {
              throw new BadRequestException(
                `Receiver employee with ID ${createDto.receiverId} is not linked to a user account`
              );
            }
            receiverUserId = receiverEmployee.userId;
          }
        }

        // Validate items and check stock availability (batch operations)
        // Extract all product IDs and variant IDs
        const productIds = [
          ...new Set(createDto.items.map(item => item.productId)),
        ];
        const variantIds = createDto.items
          .map(item => item.productVariantId)
          .filter((id): id is string => !!id);

        // Batch fetch all products
        const products = await tx.product.findMany({
          where: { id: { in: productIds } },
          include: {
            variants:
              variantIds.length > 0
                ? {
                    where: { id: { in: variantIds } },
                  }
                : false,
          },
        });

        // Create maps for O(1) lookup
        const productMap = new Map(products.map(p => [p.id, p]));
        const variantMap = new Map(
          products.flatMap(p =>
            (p.variants || []).map(v => [v.id, { ...v, product: p }])
          )
        );

        // Build stock level lookup conditions
        const stockLevelConditions = createDto.items.map(item => ({
          productId: item.productId,
          productVariantId: item.productVariantId || null,
          locationId: createDto.fromLocationId,
        }));

        // Batch fetch all stock levels
        const stockLevels = await tx.stockLevel.findMany({
          where: {
            OR: stockLevelConditions.map(condition => ({
              productId: condition.productId,
              productVariantId: condition.productVariantId,
              locationId: condition.locationId,
            })),
          },
        });

        // Create stock level map for O(1) lookup
        const stockLevelMap = new Map(
          stockLevels.map(sl => [
            `${sl.productId || "null"}-${sl.productVariantId || "null"}-${sl.locationId}`,
            sl,
          ])
        );

        // Validate all items
        for (const item of createDto.items) {
          const product = productMap.get(item.productId);
          if (!product) {
            throw new NotFoundException(
              `Product with ID ${item.productId} not found`
            );
          }

          if (item.productVariantId) {
            const variant = variantMap.get(item.productVariantId);
            if (!variant) {
              throw new NotFoundException(
                `Product variant with ID ${item.productVariantId} not found`
              );
            }
          }

          // Check stock availability at from location
          const stockKey = `${item.productId}-${item.productVariantId || "null"}-${createDto.fromLocationId}`;
          const stockLevel = stockLevelMap.get(stockKey);

          const availableStock = stockLevel
            ? Number(stockLevel.quantity) - Number(stockLevel.reserved)
            : 0;

          if (availableStock < item.quantityRequested) {
            throw new BadRequestException(
              `Insufficient stock for product ${item.productId} at location ${createDto.fromLocationId}. Available: ${availableStock}, Requested: ${item.quantityRequested}`
            );
          }
        }

        // Generate sequential transfer number (12 digits, zero-padded; concurrency-safe via PostgreSQL sequence)
        const trackingNumber = await this.numberSequenceService.getNextNumber(
          tx,
          "transfers"
        );

        // Create transfer
        const transfer = await tx.stockTransfer.create({
          data: {
            trackingNumber: `TRF-${trackingNumber}`,
            status: TransferStatus.CREATED,
            fromLocationId: createDto.fromLocationId,
            toLocationId: createDto.toLocationId,
            createdById: userId,
            senderId: senderUserId,
            receiverId: receiverUserId,
            items: {
              create: createDto.items.map(item => ({
                productId: item.productId,
                productVariantId: item.productVariantId,
                quantityRequested: item.quantityRequested,
              })),
            },
          },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
            fromLocation: true,
            toLocation: true,
            createdBy: { select: { id: true, email: true } },
            sender: { select: { id: true, email: true } },
            receiver: { select: { id: true, email: true } },
          },
        });

        // Create initial audit log
        await this.createAuditLog(
          tx,
          transfer.id,
          userId,
          TransferStatus.CREATED,
          TransferStatus.CREATED,
          createDto.note || "Solicitud de transferencia creada"
        );

        return this.mapToDto(transfer);
      },
      {
        timeout: 30000,
      }
    );
  }

  /**
   * Find all transfers with optional filters
   */
  async findAll(filters?: {
    status?: TransferStatus;
    fromLocationId?: string;
    toLocationId?: string;
    trackingNumber?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: StockTransferDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const where: Prisma.StockTransferWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.fromLocationId) {
      where.fromLocationId = filters.fromLocationId;
    }

    if (filters?.toLocationId) {
      where.toLocationId = filters.toLocationId;
    }

    if (filters?.trackingNumber) {
      where.trackingNumber = {
        contains: filters.trackingNumber,
        mode: "insensitive",
      };
    }

    const [transfers, total] = await Promise.all([
      this.prisma.stockTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          fromLocation: true,
          toLocation: true,
          createdBy: { select: { id: true, email: true } },
          sender: { select: { id: true, email: true } },
          receiver: { select: { id: true, email: true } },
        },
      }),
      this.prisma.stockTransfer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: transfers.map(t => this.mapToDto(t)),
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

  /**
   * Find one transfer by ID
   */
  async findOne(id: string): Promise<StockTransferDto> {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            productVariant: true,
          },
        },
        logs: {
          include: {
            user: { select: { id: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        movements: {
          include: {
            product: true,
            productVariant: true,
            fromLocation: true,
            toLocation: true,
            creator: { select: { id: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        fromLocation: true,
        toLocation: true,
        createdBy: { select: { id: true, email: true } },
        sender: { select: { id: true, email: true } },
        receiver: { select: { id: true, email: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with ID ${id} not found`);
    }

    return this.mapToDto(transfer);
  }

  /**
   * Update transfer status (for simple transitions like ACCEPTED)
   */
  async updateStatus(
    id: string,
    updateDto: UpdateTransferStatusDto,
    userId: string
  ): Promise<StockTransferDto> {
    this.logger.log(
      `[UPDATE_STATUS] Updating transfer ${id} to ${updateDto.status}`
    );

    return await this.prisma.$transaction(async tx => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!transfer) {
        throw new NotFoundException(`Transfer with ID ${id} not found`);
      }

      // Validate state transition
      this.validateStateTransition(transfer.status, updateDto.status);

      // Update status
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: updateDto.status,
        },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          logs: {
            include: {
              user: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          movements: {
            include: {
              product: true,
              productVariant: true,
              fromLocation: true,
              toLocation: true,
              creator: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          fromLocation: true,
          toLocation: true,
          createdBy: { select: { id: true, email: true } },
          sender: { select: { id: true, email: true } },
          receiver: { select: { id: true, email: true } },
        },
      });

      // Create audit log
      await this.createAuditLog(
        tx,
        id,
        userId,
        transfer.status,
        updateDto.status,
        updateDto.note ||
          `Estado cambiado a ${this.translateStatus(updateDto.status)}`
      );

      return this.mapToDto(updated);
    });
  }

  /**
   * Dispatch transfer (DISPATCHING -> IN_TRANSIT)
   */
  async dispatch(
    id: string,
    dispatchDto: DispatchTransferDto,
    userId: string
  ): Promise<StockTransferDto> {
    this.logger.log(`[DISPATCH] Dispatching transfer ${id}`);

    return await this.prisma.$transaction(
      async tx => {
        const transfer = await tx.stockTransfer.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
          },
        });

        if (!transfer) {
          throw new NotFoundException(`Transfer with ID ${id} not found`);
        }

        // Validate state
        if (transfer.status !== TransferStatus.DISPATCHING) {
          throw new BadRequestException(
            `Transfer must be in DISPATCHING status to dispatch. Current status: ${transfer.status}`
          );
        }

        // Validate items and quantities (batch operations)
        const itemMap = new Map(transfer.items.map(item => [item.id, item]));

        // Validate all items exist
        const missingItemIds = dispatchDto.items
          .map(di => di.itemId)
          .filter(id => !itemMap.has(id));

        if (missingItemIds.length > 0) {
          throw new NotFoundException(
            `Transfer items with IDs ${missingItemIds.join(", ")} not found`
          );
        }

        // Validate quantities don't exceed requested
        for (const dispatchItem of dispatchDto.items) {
          const item = itemMap.get(dispatchItem.itemId)!;
          if (dispatchItem.quantitySent > Number(item.quantityRequested)) {
            throw new BadRequestException(
              `Quantity sent (${dispatchItem.quantitySent}) cannot exceed quantity requested (${item.quantityRequested}) for item ${item.id}`
            );
          }
        }

        // Batch fetch all stock levels
        const stockLevelConditions = dispatchDto.items.map(dispatchItem => {
          const item = itemMap.get(dispatchItem.itemId)!;
          return {
            productId: item.productId,
            productVariantId: item.productVariantId || null,
            locationId: transfer.fromLocationId,
          };
        });

        const stockLevels = await tx.stockLevel.findMany({
          where: {
            OR: stockLevelConditions.map(condition => ({
              productId: condition.productId,
              productVariantId: condition.productVariantId,
              locationId: condition.locationId,
            })),
          },
        });

        // Create stock level map for O(1) lookup
        const stockLevelMap = new Map(
          stockLevels.map(sl => [
            `${sl.productId || "null"}-${sl.productVariantId || "null"}-${sl.locationId}`,
            sl,
          ])
        );

        // Validate stock availability for all items
        for (const dispatchItem of dispatchDto.items) {
          const item = itemMap.get(dispatchItem.itemId)!;
          const stockKey = `${item.productId}-${item.productVariantId || "null"}-${transfer.fromLocationId}`;
          const stockLevel = stockLevelMap.get(stockKey);

          const availableStock = stockLevel
            ? Number(stockLevel.quantity) - Number(stockLevel.reserved)
            : 0;

          if (availableStock < dispatchItem.quantitySent) {
            throw new BadRequestException(
              `Insufficient stock for item ${item.id}. Available: ${availableStock}, Sent: ${dispatchItem.quantitySent}`
            );
          }
        }

        // Update items with quantities sent (batch update using raw SQL)
        if (dispatchDto.items.length > 0) {
          const itemIds = dispatchDto.items.map(di => di.itemId);
          const quantities = dispatchDto.items.map(di => di.quantitySent);

          await tx.$executeRaw`
            UPDATE stock_transfer_items sti
            SET quantity_sent = updates.quantity_sent
            FROM (
              SELECT
                unnest(${itemIds}::uuid[]) AS id,
                unnest(${quantities}::numeric[]) AS quantity_sent
            ) AS updates
            WHERE sti.id = updates.id
          `;
        }

        // Update transfer status to IN_TRANSIT
        await tx.stockTransfer.update({
          where: { id },
          data: {
            status: TransferStatus.IN_TRANSIT,
            dispatchedAt: new Date(),
          },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
            movements: {
              include: {
                product: true,
                productVariant: true,
                fromLocation: true,
                toLocation: true,
                creator: { select: { id: true, email: true } },
              },
              orderBy: { createdAt: "desc" },
            },
            fromLocation: true,
            toLocation: true,
            createdBy: { select: { id: true, email: true } },
            sender: { select: { id: true, email: true } },
            receiver: { select: { id: true, email: true } },
          },
        });

        // Create stock movements (TRANSFER_OUT from origin)
        // Aggregate quantities by unique (productId, productVariantId, locationId) to avoid duplicate stock level creation
        const movementAggregator = new Map<
          string,
          {
            productId: string;
            productVariantId: string | null;
            fromLocationId: string;
            toLocationId: string;
            quantity: number;
          }
        >();

        for (const dispatchItem of dispatchDto.items) {
          const item = itemMap.get(dispatchItem.itemId)!;
          const key = `${item.productId}-${item.productVariantId || "null"}-${transfer.fromLocationId}`;

          const existing = movementAggregator.get(key);
          if (existing) {
            existing.quantity += dispatchItem.quantitySent;
          } else {
            movementAggregator.set(key, {
              productId: item.productId,
              productVariantId: item.productVariantId,
              fromLocationId: transfer.fromLocationId,
              toLocationId: transfer.toLocationId,
              quantity: dispatchItem.quantitySent,
            });
          }
        }

        // Create movements from aggregated data
        const movementDtos = Array.from(movementAggregator.values()).map(
          agg => ({
            productId: agg.productId,
            productVariantId: agg.productVariantId,
            fromLocationId: agg.fromLocationId,
            toLocationId: agg.toLocationId,
            movementType: StockMovementType.TRANSFER,
            quantity: agg.quantity,
            reference: transfer.trackingNumber,
            note: `Envío de transferencia: ${transfer.trackingNumber}`,
            transferId: transfer.id,
          })
        );

        // Create all movements in batch
        if (movementDtos.length > 0) {
          await this.stockMovementsService.createTransferMovements(
            movementDtos,
            tx,
            userId
          );
        }

        // Create audit log
        await this.createAuditLog(
          tx,
          id,
          userId,
          TransferStatus.DISPATCHING,
          TransferStatus.IN_TRANSIT,
          dispatchDto.note || `Transferencia enviada`
        );

        // Refetch transfer with movements after creating them
        const transferWithMovements = await tx.stockTransfer.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
            movements: {
              include: {
                product: true,
                productVariant: true,
                fromLocation: true,
                toLocation: true,
                creator: { select: { id: true, email: true } },
              },
              orderBy: { createdAt: "desc" },
            },
            fromLocation: true,
            toLocation: true,
            createdBy: { select: { id: true, email: true } },
            sender: { select: { id: true, email: true } },
            receiver: { select: { id: true, email: true } },
          },
        });

        return this.mapToDto(transferWithMovements!);
      },
      {
        timeout: 30000,
      }
    );
  }

  /**
   * Receive transfer (IN_TRANSIT -> RECEIVED_COMPLETE | RECEIVED_PARTIAL)
   */
  async receive(
    id: string,
    receiveDto: ReceiveTransferDto,
    userId: string
  ): Promise<StockTransferDto> {
    this.logger.log(`[RECEIVE] Receiving transfer ${id}`);

    return await this.prisma.$transaction(
      async tx => {
        const transfer = await tx.stockTransfer.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
          },
        });

        if (!transfer) {
          throw new NotFoundException(`Transfer with ID ${id} not found`);
        }

        // Validate state
        if (transfer.status !== TransferStatus.IN_TRANSIT) {
          throw new BadRequestException(
            `Transfer must be in IN_TRANSIT status to receive. Current status: ${transfer.status}`
          );
        }

        // Validate items and quantities
        const itemMap = new Map(transfer.items.map(item => [item.id, item]));

        let hasDiscrepancies = false;
        const discrepancies: Array<{
          itemId: string;
          type: DiscrepancyType;
          quantity: number;
        }> = [];

        for (const receiveItem of receiveDto.items) {
          const item = itemMap.get(receiveItem.itemId);
          if (!item) {
            throw new NotFoundException(
              `Transfer item with ID ${receiveItem.itemId} not found`
            );
          }

          const quantitySent = item.quantitySent
            ? Number(item.quantitySent)
            : 0;

          if (receiveItem.quantityReceived > quantitySent) {
            // Extra items are not allowed - received cannot exceed sent
            throw new BadRequestException(
              `Quantity received (${receiveItem.quantityReceived}) cannot exceed quantity sent (${quantitySent}) for item ${item.id}.`
            );
          } else if (receiveItem.quantityReceived < quantitySent) {
            // Missing items - must be classified as DAMAGE or NOT_RECEIVED
            if (
              !receiveItem.discrepancyType ||
              (receiveItem.discrepancyType !== DiscrepancyType.DAMAGE &&
                receiveItem.discrepancyType !== DiscrepancyType.NOT_RECEIVED)
            ) {
              throw new BadRequestException(
                `Quantity received (${receiveItem.quantityReceived}) is less than quantity sent (${quantitySent}) for item ${item.id}. Must specify DAMAGE or NOT_RECEIVED discrepancy type.`
              );
            }
            hasDiscrepancies = true;
            discrepancies.push({
              itemId: item.id,
              type: receiveItem.discrepancyType,
              quantity: quantitySent - receiveItem.quantityReceived,
            });
          }

          // Require note if discrepancies exist
          if (hasDiscrepancies && !receiveDto.note) {
            throw new BadRequestException(
              "Note is required when discrepancies exist"
            );
          }
        }

        // Update items with quantities received (batch update using raw SQL)
        if (receiveDto.items.length > 0) {
          const itemIds = receiveDto.items.map(ri => ri.itemId);
          const quantities = receiveDto.items.map(ri => ri.quantityReceived);

          await tx.$executeRaw`
            UPDATE stock_transfer_items sti
            SET quantity_received = updates.quantity_received
            FROM (
              SELECT
                unnest(${itemIds}::uuid[]) AS id,
                unnest(${quantities}::numeric[]) AS quantity_received
            ) AS updates
            WHERE sti.id = updates.id
          `;
        }

        // Determine final status
        const allItemsReceived = receiveDto.items.every(receiveItem => {
          const item = itemMap.get(receiveItem.itemId)!;
          const quantitySent = item.quantitySent
            ? Number(item.quantitySent)
            : 0;
          return receiveItem.quantityReceived === quantitySent;
        });

        const finalStatus = allItemsReceived
          ? TransferStatus.RECEIVED_COMPLETE
          : TransferStatus.RECEIVED_PARTIAL;

        // Update transfer status
        await tx.stockTransfer.update({
          where: { id },
          data: {
            status: finalStatus,
            receivedAt: new Date(),
          },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
            movements: {
              include: {
                product: true,
                productVariant: true,
                fromLocation: true,
                toLocation: true,
                creator: { select: { id: true, email: true } },
              },
              orderBy: { createdAt: "desc" },
            },
            fromLocation: true,
            toLocation: true,
            createdBy: { select: { id: true, email: true } },
            sender: { select: { id: true, email: true } },
            receiver: { select: { id: true, email: true } },
          },
        });

        // Create stock movements for discrepancies only
        // Note: TRANSFER movements were already created at dispatch, so we don't create them again here
        // Aggregate discrepancy movements by unique (productId, productVariantId, discrepancyType)
        const discrepancyAggregator = new Map<
          string,
          {
            productId: string;
            productVariantId: string | null;
            type: DiscrepancyType;
            quantity: number;
            typeLabel: string;
          }
        >();

        for (const receiveItem of receiveDto.items) {
          const item = itemMap.get(receiveItem.itemId)!;

          // Handle discrepancies
          const discrepancy = discrepancies.find(d => d.itemId === item.id);
          if (discrepancy) {
            // Aggregate discrepancy movements
            let discrepancyTypeLabel: string = discrepancy.type;
            if (discrepancy.type === DiscrepancyType.DAMAGE) {
              discrepancyTypeLabel = "DAÑO";
            } else if (discrepancy.type === DiscrepancyType.NOT_RECEIVED) {
              discrepancyTypeLabel = "NO RECIBIDO";
            }

            const discrepancyKey = `${item.productId}-${item.productVariantId || "null"}-${discrepancy.type}`;
            const existingDiscrepancy =
              discrepancyAggregator.get(discrepancyKey);
            if (existingDiscrepancy) {
              existingDiscrepancy.quantity += discrepancy.quantity;
            } else {
              discrepancyAggregator.set(discrepancyKey, {
                productId: item.productId,
                productVariantId: item.productVariantId,
                type: discrepancy.type,
                quantity: discrepancy.quantity,
                typeLabel: discrepancyTypeLabel,
              });
            }
          }
        }

        // Build movement DTOs from aggregated data
        const movementDtos: Array<{
          productId: string;
          productVariantId: string | null;
          fromLocationId: string | null;
          toLocationId: string | null;
          movementType: StockMovementType;
          quantity: number;
          reference: string;
          note: string;
          transferId: string;
        }> = [];

        // Add discrepancy movements
        for (const agg of discrepancyAggregator.values()) {
          if (agg.type === DiscrepancyType.DAMAGE) {
            // DAMAGE: Create DAMAGE movement at receiving location (reduces stock)
            movementDtos.push({
              productId: agg.productId,
              productVariantId: agg.productVariantId,
              fromLocationId: transfer.toLocationId, // Damage occurs at receiving location
              toLocationId: null,
              movementType: StockMovementType.DAMAGE,
              quantity: agg.quantity,
              reference: transfer.trackingNumber,
              note: `Daño en transferencia: ${transfer.trackingNumber}. ${receiveDto.note || ""}`,
              transferId: transfer.id,
            });
          } else if (agg.type === DiscrepancyType.NOT_RECEIVED) {
            // NOT_RECEIVED: Create two movements
            // 1. NEGATIVE_ADJUSTMENT at receiving location (reduces stock because not received)
            // 2. RETURN at sending location (increases stock back because not received)
            const notReceivedMovements = [
              {
                productId: agg.productId,
                productVariantId: agg.productVariantId,
                fromLocationId: transfer.toLocationId,
                toLocationId: null,
                movementType: StockMovementType.NEGATIVE_ADJUSTMENT,
                quantity: agg.quantity,
                reference: transfer.trackingNumber,
                note: `No recibido en transferencia: ${transfer.trackingNumber}. ${receiveDto.note || ""}`,
                transferId: transfer.id,
              },
              {
                productId: agg.productId,
                productVariantId: agg.productVariantId,
                fromLocationId: null,
                toLocationId: transfer.fromLocationId, // Return to sending location
                movementType: StockMovementType.RETURN,
                quantity: agg.quantity,
                reference: transfer.trackingNumber,
                note: `Devolución por no recibido en transferencia: ${transfer.trackingNumber}. ${receiveDto.note || ""}`,
                transferId: transfer.id,
              },
            ];
            movementDtos.push(...notReceivedMovements);
          }
        }

        // Create all movements in batch
        if (movementDtos.length > 0) {
          await this.stockMovementsService.createTransferMovements(
            movementDtos,
            tx,
            userId
          );
        }

        // Create audit log
        await this.createAuditLog(
          tx,
          id,
          userId,
          TransferStatus.IN_TRANSIT,
          finalStatus,
          receiveDto.note ||
            `Transferencia recibida${hasDiscrepancies ? " con discrepancias" : ""}`
        );

        // Refetch transfer with movements after creating them
        const transferWithMovements = await tx.stockTransfer.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                product: true,
                productVariant: true,
              },
            },
            movements: {
              include: {
                product: true,
                productVariant: true,
                fromLocation: true,
                toLocation: true,
                creator: { select: { id: true, email: true } },
              },
              orderBy: { createdAt: "desc" },
            },
            fromLocation: true,
            toLocation: true,
            createdBy: { select: { id: true, email: true } },
            sender: { select: { id: true, email: true } },
            receiver: { select: { id: true, email: true } },
          },
        });

        return this.mapToDto(transferWithMovements!);
      },
      {
        timeout: 30000,
      }
    );
  }

  /**
   * Cancel transfer (only when CREATED or ACCEPTED)
   */
  async cancel(id: string, userId: string): Promise<StockTransferDto> {
    this.logger.log(`[CANCEL] Cancelling transfer ${id}`);

    return await this.prisma.$transaction(async tx => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
      });

      if (!transfer) {
        throw new NotFoundException(`Transfer with ID ${id} not found`);
      }

      // Can only cancel when status is CREATED or ACCEPTED
      if (
        transfer.status !== TransferStatus.CREATED &&
        transfer.status !== TransferStatus.ACCEPTED
      ) {
        throw new BadRequestException(
          `Cannot cancel transfer. Transfers can only be cancelled when in CREATED or ACCEPTED status. Current status: ${transfer.status}`
        );
      }

      // Update status
      const updated = await tx.stockTransfer.update({
        where: { id },
        data: {
          status: TransferStatus.CANCELLED,
        },
        include: {
          items: {
            include: {
              product: true,
              productVariant: true,
            },
          },
          logs: {
            include: {
              user: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          movements: {
            include: {
              product: true,
              productVariant: true,
              fromLocation: true,
              toLocation: true,
              creator: { select: { id: true, email: true } },
            },
            orderBy: { createdAt: "desc" },
          },
          fromLocation: true,
          toLocation: true,
          createdBy: { select: { id: true, email: true } },
          sender: { select: { id: true, email: true } },
          receiver: { select: { id: true, email: true } },
        },
      });

      // Create audit log
      await this.createAuditLog(
        tx,
        id,
        userId,
        transfer.status,
        TransferStatus.CANCELLED,
        "Transferencia cancelada"
      );

      return this.mapToDto(updated);
    });
  }

  /**
   * Get transfer PDF data
   */
  async getTransferPdfData(transferId: string) {
    const transfer = await this.prisma.stockTransfer.findUnique({
      where: { id: transferId },
      include: {
        items: {
          include: {
            product: true,
            productVariant: {
              include: {
                product: true,
              },
            },
          },
        },
        fromLocation: true,
        toLocation: true,
        createdBy: { select: { id: true, email: true } },
        sender: {
          include: {
            employees: {
              where: { isDeleted: false, isActive: true },
              include: {
                person: true,
              },
            },
          },
        },
        receiver: {
          include: {
            employees: {
              where: { isDeleted: false, isActive: true },
              include: {
                person: true,
              },
            },
          },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException(`Transfer with ID ${transferId} not found`);
    }

    // Helper to get user display name
    const getUserDisplayName = (user: any): string => {
      if (!user) return "Unknown";
      if (user.email) return user.email;

      // Try to get from employee's person
      const employee = user.employees?.[0];
      const person = employee?.person;
      if (person) {
        const name =
          `${person.firstName || ""} ${person.lastName || ""}`.trim();
        if (name) return name;
      }

      return "Unknown";
    };

    return {
      companyName: "Esli Cosmetics",
      companyAddress:
        "De la Iglesia Pio X, 1c hacia abajo. Edificio doble planta, Esli Cosmetics.",
      companyEmail: "cosmeticseym@gmail.com",
      trackingNumber: transfer.trackingNumber,
      createdAt: transfer.createdAt.toISOString(),
      createdBy: getUserDisplayName(transfer.createdBy),
      fromLocation: transfer.fromLocation?.name || "N/A",
      toLocation: transfer.toLocation?.name || "N/A",
      sender: transfer.sender ? getUserDisplayName(transfer.sender) : undefined,
      receiver: transfer.receiver
        ? getUserDisplayName(transfer.receiver)
        : undefined,
      items: transfer.items.map(item => ({
        id: item.id,
        name:
          item.productVariant?.name || item.product?.name || "Unknown Product",
        parentName: item.productVariant?.product?.name ?? undefined,
        variantName: item.productVariant?.name ?? undefined,
        sku: item.productVariant?.sku || item.product?.sku || undefined,
        quantityRequested: Number(item.quantityRequested),
        quantitySent: item.quantitySent ? Number(item.quantitySent) : undefined,
        quantityReceived: item.quantityReceived
          ? Number(item.quantityReceived)
          : undefined,
      })),
    };
  }

  /**
   * Map Prisma model to DTO
   */
  private mapToDto(transfer: any): StockTransferDto {
    return {
      id: transfer.id,
      trackingNumber: transfer.trackingNumber,
      status: transfer.status,
      fromLocationId: transfer.fromLocationId,
      toLocationId: transfer.toLocationId,
      createdById: transfer.createdById,
      senderId: transfer.senderId,
      receiverId: transfer.receiverId,
      createdAt: transfer.createdAt,
      dispatchedAt: transfer.dispatchedAt,
      receivedAt: transfer.receivedAt,
      items:
        transfer.items?.map((item: any) => ({
          id: item.id,
          transferId: item.transferId,
          productId: item.productId,
          productVariantId: item.productVariantId,
          quantityRequested: Number(item.quantityRequested),
          quantitySent: item.quantitySent
            ? Number(item.quantitySent)
            : undefined,
          quantityReceived: item.quantityReceived
            ? Number(item.quantityReceived)
            : undefined,
          product: item.product,
          productVariant: item.productVariant,
        })) || [],
      logs:
        transfer.logs?.map((log: any) => ({
          id: log.id,
          transferId: log.transferId,
          userId: log.userId,
          previousStatus: log.previousStatus,
          newStatus: log.newStatus,
          note: log.note,
          createdAt: log.createdAt,
          user: log.user,
        })) || [],
      movements: transfer.movements || [],
      fromLocation: transfer.fromLocation,
      toLocation: transfer.toLocation,
      createdBy: transfer.createdBy,
      sender: transfer.sender,
      receiver: transfer.receiver,
    };
  }
}

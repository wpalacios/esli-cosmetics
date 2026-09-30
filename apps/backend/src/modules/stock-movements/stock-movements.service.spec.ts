import { BadRequestException } from "@nestjs/common";
import { StockMovementType } from "@prisma/client";
import { StockMovementsService } from "./stock-movements.service";
import { CreateStockMovementDto } from "./dto/create-stock-movement.dto";

jest.mock("@prisma/client", () => {
  const actual = jest.requireActual("@prisma/client");
  return {
    ...actual,
    PrismaClient: jest.fn(() => {
      throw new Error(
        "PrismaClient must not be instantiated in inventory unit tests"
      );
    }),
  };
});

type MockTx = {
  stockLevel: { findMany: jest.Mock };
  stockMovement: { createMany: jest.Mock };
  $executeRaw: jest.Mock;
  getCallOrder: () => string[];
};

function buildSaleDto(
  overrides: Partial<CreateStockMovementDto> = {}
): CreateStockMovementDto {
  return {
    productVariantId: "variant-a",
    productId: "product-a",
    fromLocationId: "loc-a",
    toLocationId: null,
    movementType: StockMovementType.SALE,
    quantity: 2,
    reference: "TEST-SALE",
    note: "test sale",
    ...overrides,
  };
}

function buildAnnulmentDto(
  overrides: Partial<CreateStockMovementDto> = {}
): CreateStockMovementDto {
  return {
    productVariantId: "variant-a",
    productId: "product-a",
    fromLocationId: null,
    toLocationId: "loc-a",
    movementType: StockMovementType.ANNULMENT,
    quantity: 2,
    reference: "TEST-ANNUL",
    note: "test annulment",
    ...overrides,
  };
}

function buildPurchaseDto(
  overrides: Partial<CreateStockMovementDto> = {}
): CreateStockMovementDto {
  return {
    productVariantId: "variant-a",
    productId: "product-a",
    fromLocationId: null,
    toLocationId: "loc-a",
    movementType: StockMovementType.PURCHASE,
    quantity: 5,
    reference: "TEST-PUR",
    note: "test purchase",
    ...overrides,
  };
}

function createMockTx(
  existingRows: Array<{
    id: string;
    productId: string;
    productVariantId: string;
    locationId: string;
  }> = []
): MockTx {
  const callOrder: string[] = [];

  return {
    stockLevel: {
      findMany: jest.fn().mockResolvedValue(existingRows),
    },
    stockMovement: {
      createMany: jest.fn().mockImplementation(async () => {
        callOrder.push("createMany");
      }),
    },
    $executeRaw: jest.fn().mockImplementation(async () => {
      callOrder.push("executeRaw");
    }),
    getCallOrder: () => callOrder,
  };
}

function buildService(): StockMovementsService {
  return new StockMovementsService(
    {} as never,
    {
      checkAndNotifyLowStock: jest.fn().mockResolvedValue(undefined),
      checkAndNotifyMultiple: jest.fn().mockResolvedValue(undefined),
    } as never,
    {} as never
  );
}

describe("StockMovementsService inventory integrity (mocked, no database)", () => {
  let service: StockMovementsService;

  beforeEach(() => {
    service = buildService();
  });

  describe("createSaleOrderMovements", () => {
    it("updates stock_levels before creating movements", async () => {
      const tx = createMockTx([
        {
          id: "sl-1",
          productId: "product-a",
          productVariantId: "variant-a",
          locationId: "loc-a",
        },
      ]);

      await service.createSaleOrderMovements([buildSaleDto()], tx as never);

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.createMany).toHaveBeenCalledTimes(1);
      expect(tx.getCallOrder()).toEqual(["executeRaw", "createMany"]);
    });

    it("fails without writing movements when stock row is missing", async () => {
      const tx = createMockTx([]);

      await expect(
        service.createSaleOrderMovements([buildSaleDto()], tx as never)
      ).rejects.toThrow(BadRequestException);

      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
    });

    it("fails when sale lines lack product reference", async () => {
      const tx = createMockTx([]);

      await expect(
        service.createSaleOrderMovements(
          [
            buildSaleDto({
              productId: undefined,
              productVariantId: undefined,
            }),
          ],
          tx as never
        )
      ).rejects.toThrow(BadRequestException);

      expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
    });

    it("aggregates multiple sale lines for the same triplet", async () => {
      const tx = createMockTx([
        {
          id: "sl-1",
          productId: "product-a",
          productVariantId: "variant-a",
          locationId: "loc-a",
        },
      ]);

      await service.createSaleOrderMovements(
        [buildSaleDto({ quantity: 1 }), buildSaleDto({ quantity: 3 })],
        tx as never
      );

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ quantity: 1 }),
          expect.objectContaining({ quantity: 3 }),
        ]),
      });
    });

    it("fails entire batch when one variant in a mixed order has no stock row", async () => {
      const tx = createMockTx([
        {
          id: "sl-1",
          productId: "product-a",
          productVariantId: "variant-a",
          locationId: "loc-a",
        },
      ]);

      await expect(
        service.createSaleOrderMovements(
          [
            buildSaleDto({
              productVariantId: "variant-a",
              productId: "product-a",
            }),
            buildSaleDto({
              productVariantId: "variant-b",
              productId: "product-b",
              quantity: 1,
            }),
          ],
          tx as never
        )
      ).rejects.toThrow(BadRequestException);

      expect(tx.$executeRaw).not.toHaveBeenCalled();
      expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
    });

    it("releases reserved quantity when alsoReleaseReserved is set", async () => {
      const tx = createMockTx([
        {
          id: "sl-1",
          productId: "product-a",
          productVariantId: "variant-a",
          locationId: "loc-a",
        },
      ]);

      await service.createSaleOrderMovements(
        [buildSaleDto({ quantity: 2 })],
        tx as never,
        "user-1",
        {
          alsoReleaseReserved: true,
        }
      );

      expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
      expect(tx.getCallOrder()).toEqual([
        "executeRaw",
        "executeRaw",
        "createMany",
      ]);
    });
  });

  describe("createSaleAnnulmentMovements", () => {
    it("updates stock_levels before creating movements", async () => {
      const tx = createMockTx([]);

      await service.createSaleAnnulmentMovements(
        [buildAnnulmentDto()],
        tx as never
      );

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      expect(tx.stockMovement.createMany).toHaveBeenCalledTimes(1);
      expect(tx.getCallOrder()).toEqual(["executeRaw", "createMany"]);
    });

    it("fails when annulment lines lack product reference", async () => {
      const tx = createMockTx([]);

      await expect(
        service.createSaleAnnulmentMovements(
          [
            buildAnnulmentDto({
              productId: undefined,
              productVariantId: undefined,
            }),
          ],
          tx as never
        )
      ).rejects.toThrow(BadRequestException);

      expect(tx.stockMovement.createMany).not.toHaveBeenCalled();
    });
  });

  describe("createTransferMovements", () => {
    it("updates stock_levels before creating movements", async () => {
      const tx = createMockTx([]);

      await service.createTransferMovements(
        [
          {
            productVariantId: "variant-a",
            productId: "product-a",
            fromLocationId: "loc-a",
            toLocationId: "loc-b",
            movementType: StockMovementType.TRANSFER,
            quantity: 1,
            reference: "TRF-TEST",
            note: "transfer test",
          },
        ],
        tx as never
      );

      expect(tx.$executeRaw).toHaveBeenCalled();
      expect(tx.stockMovement.createMany).toHaveBeenCalled();
      expect(tx.getCallOrder()[0]).toBe("executeRaw");
      expect(tx.getCallOrder().at(-1)).toBe("createMany");
    });

    it("aggregates source and destination deltas for transfers", async () => {
      const tx = createMockTx([]);

      await service.createTransferMovements(
        [
          {
            productVariantId: "variant-a",
            productId: "product-a",
            fromLocationId: "loc-a",
            toLocationId: "loc-b",
            movementType: StockMovementType.TRANSFER,
            quantity: 3,
            reference: "TRF-TEST",
            note: "transfer test",
          },
        ],
        tx as never
      );

      expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
      const executeArg = tx.$executeRaw.mock.calls[0];
      expect(executeArg).toBeDefined();
    });
  });

  describe("createBulkPurchaseMovements", () => {
    it("updates stock_levels before creating purchase movements", async () => {
      const tx = createMockTx([]);
      const privateService = service as unknown as {
        createBulkPurchaseMovements: (
          dtos: CreateStockMovementDto[],
          tx: unknown,
          userId?: string
        ) => Promise<void>;
      };

      await privateService.createBulkPurchaseMovements(
        [buildPurchaseDto()],
        tx,
        "user-1"
      );

      expect(tx.getCallOrder()).toEqual(["executeRaw", "createMany"]);
    });
  });
});

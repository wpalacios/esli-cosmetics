import { BadRequestException, ConflictException } from "@nestjs/common";
import { ProductType } from "@prisma/client";
import { QuotesService } from "./quotes.service";

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

describe("QuotesService inventory validation (mocked, no database)", () => {
  let service: QuotesService;

  beforeEach(() => {
    service = new QuotesService({} as never, {} as never, {} as never);
  });

  it("resolves stock by product triplet, not variant-only", async () => {
    const tx = {
      productVariant: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: "variant-a",
              name: "Variant A",
              productId: "product-a",
              product: { type: ProductType.STANDARD, kitItems: [] },
            },
          ])
          .mockResolvedValueOnce([]),
      },
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "sl-canonical",
            productId: "product-a",
            productVariantId: "variant-a",
            quantity: 10,
            reserved: 2,
          },
        ]),
      },
    };

    const result = await (
      service as unknown as {
        validateStockAvailability: (
          items: Array<{ productVariantId: string; quantity: number }>,
          locationId: string,
          tx: unknown
        ) => Promise<{
          stockLevelMap: Map<
            string,
            { id: string; quantity: unknown; reserved: unknown }
          >;
        }>;
      }
    ).validateStockAvailability(
      [{ productVariantId: "variant-a", quantity: 5 }],
      "loc-a",
      tx
    );

    expect(tx.stockLevel.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            productId: "product-a",
            productVariantId: "variant-a",
            locationId: "loc-a",
          },
        ],
      },
      select: {
        id: true,
        productId: true,
        productVariantId: true,
        quantity: true,
        reserved: true,
      },
    });

    expect(result.stockLevelMap.get("variant-a")?.id).toBe("sl-canonical");
  });

  it("throws when requested quantity exceeds triplet-resolved availability", async () => {
    const tx = {
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "variant-a",
            name: "Variant A",
            productId: "product-a",
            product: { type: ProductType.STANDARD, kitItems: [] },
          },
        ]),
      },
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "sl-canonical",
            productId: "product-a",
            productVariantId: "variant-a",
            quantity: 3,
            reserved: 1,
          },
        ]),
      },
    };

    await expect(
      (
        service as unknown as {
          validateStockAvailability: (
            items: Array<{ productVariantId: string; quantity: number }>,
            locationId: string,
            tx: unknown
          ) => Promise<unknown>;
        }
      ).validateStockAvailability(
        [{ productVariantId: "variant-a", quantity: 5 }],
        "loc-a",
        tx
      )
    ).rejects.toThrow(ConflictException);
  });

  it("throws when variant is missing productId", async () => {
    const tx = {
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "variant-a",
            name: "Variant A",
            productId: null,
            product: { type: ProductType.STANDARD, kitItems: [] },
          },
        ]),
      },
      stockLevel: {
        findMany: jest.fn(),
      },
    };

    await expect(
      (
        service as unknown as {
          validateStockAvailability: (
            items: Array<{ productVariantId: string; quantity: number }>,
            locationId: string,
            tx: unknown
          ) => Promise<unknown>;
        }
      ).validateStockAvailability(
        [{ productVariantId: "variant-a", quantity: 1 }],
        "loc-a",
        tx
      )
    ).rejects.toThrow(BadRequestException);

    expect(tx.stockLevel.findMany).not.toHaveBeenCalled();
  });
});

describe("QuotesService reservation reconciliation (mocked, no database)", () => {
  let service: QuotesService;

  beforeEach(() => {
    service = new QuotesService({} as never, {} as never, {} as never);
  });

  type ReconcileFn = (params: {
    previousVariantQtyMap: Map<string, number>;
    currentVariantQtyMap: Map<string, number>;
    variantMap: Map<string, { productId: string }>;
    oldLocationId: string;
    newLocationId: string;
    wasAlreadyApproved: boolean;
    tx: unknown;
  }) => Promise<void>;

  type ReserveArgs = [
    Map<string, number>,
    Map<string, { id: string }>,
    unknown,
    (Map<string, number> | undefined)?,
  ];
  type ReleaseArgs = [
    Map<string, number>,
    Map<string, { id: string }>,
    unknown,
  ];

  const variantMap = new Map<string, { productId: string }>([
    ["variant-a", { productId: "product-a" }],
    ["variant-b", { productId: "product-b" }],
  ]);

  const makeSpies = (svc: QuotesService) => {
    const priv = svc as unknown as {
      reserveQuoteInventory: (...a: unknown[]) => Promise<void>;
      releaseQuoteInventory: (...a: unknown[]) => Promise<void>;
    };
    return {
      reserveSpy: jest
        .spyOn(priv, "reserveQuoteInventory")
        .mockResolvedValue(undefined),
      releaseSpy: jest
        .spyOn(priv, "releaseQuoteInventory")
        .mockResolvedValue(undefined),
    };
  };

  const callReconcile = (
    svc: QuotesService,
    params: Parameters<ReconcileFn>[0]
  ): Promise<void> =>
    (
      svc as unknown as { reconcileQuoteReservations: ReconcileFn }
    ).reconcileQuoteReservations(params);

  it("Exercise 1: releases a removed line by including it in the union stock map", async () => {
    // Same location, APPROVED quote: B was removed (in previous, absent in current).
    const tx = {
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([
          { id: "sl-a", productId: "product-a", productVariantId: "variant-a" },
          { id: "sl-b", productId: "product-b", productVariantId: "variant-b" },
        ]),
      },
    };

    const { reserveSpy, releaseSpy } = makeSpies(service);

    await callReconcile(service, {
      previousVariantQtyMap: new Map([
        ["variant-a", 10],
        ["variant-b", 10],
      ]),
      currentVariantQtyMap: new Map([["variant-a", 10]]),
      variantMap,
      oldLocationId: "loc-1",
      newLocationId: "loc-1",
      wasAlreadyApproved: true,
      tx,
    });

    // No explicit release branch on same-location edits; deltas flow through reserve.
    expect(releaseSpy).not.toHaveBeenCalled();
    expect(reserveSpy).toHaveBeenCalledTimes(1);

    const [currentMap, levelMap, , previousMap] = reserveSpy.mock
      .calls[0] as ReserveArgs;
    // The removed variant MUST be present in both the level map and the previous
    // map so its negative delta (0 − 10) releases the orphan reservation.
    expect(levelMap.has("variant-b")).toBe(true);
    expect(previousMap?.get("variant-b")).toBe(10);
    expect(currentMap.has("variant-b")).toBe(false);
  });

  it("Exercise 2: on location change, releases at old location and reserves at new", async () => {
    const tx = {
      stockLevel: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: "sl-a-old",
              productId: "product-a",
              productVariantId: "variant-a",
            },
          ])
          .mockResolvedValueOnce([
            {
              id: "sl-a-new",
              productId: "product-a",
              productVariantId: "variant-a",
            },
          ]),
      },
    };

    const { reserveSpy, releaseSpy } = makeSpies(service);

    await callReconcile(service, {
      previousVariantQtyMap: new Map([["variant-a", 10]]),
      currentVariantQtyMap: new Map([["variant-a", 10]]),
      variantMap,
      oldLocationId: "loc-1",
      newLocationId: "loc-2",
      wasAlreadyApproved: true,
      tx,
    });

    expect(releaseSpy).toHaveBeenCalledTimes(1);
    expect(reserveSpy).toHaveBeenCalledTimes(1);

    const [releaseMap, oldLevelMap] = releaseSpy.mock.calls[0] as ReleaseArgs;
    expect(releaseMap.get("variant-a")).toBe(10);
    expect(oldLevelMap.get("variant-a")?.id).toBe("sl-a-old");

    const [reserveMap, newLevelMap, , previousArg] = reserveSpy.mock
      .calls[0] as ReserveArgs;
    expect(reserveMap.get("variant-a")).toBe(10);
    expect(newLevelMap.get("variant-a")?.id).toBe("sl-a-new");
    // Reserving at a fresh location must NOT diff against a previous map.
    expect(previousArg).toBeUndefined();
  });

  it("DRAFT→APPROVED reserves with an empty previous map (no spurious release)", async () => {
    const tx = {
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "sl-a",
            productId: "product-a",
            productVariantId: "variant-a",
          },
        ]),
      },
    };

    const { reserveSpy, releaseSpy } = makeSpies(service);

    await callReconcile(service, {
      previousVariantQtyMap: new Map([["variant-a", 99]]), // ignored when not approved
      currentVariantQtyMap: new Map([["variant-a", 5]]),
      variantMap,
      oldLocationId: "loc-1",
      newLocationId: "loc-1",
      wasAlreadyApproved: false,
      tx,
    });

    expect(releaseSpy).not.toHaveBeenCalled();
    const [, , , previousArg] = reserveSpy.mock.calls[0] as ReserveArgs;
    expect(previousArg?.size).toBe(0);
  });

  it("loadStockLevelMapForVariants resolves rows by (product, variant, location) triplet", async () => {
    const tx = {
      stockLevel: {
        findMany: jest.fn().mockResolvedValue([
          { id: "sl-a", productId: "product-a", productVariantId: "variant-a" },
          { id: "sl-b", productId: "product-b", productVariantId: "variant-b" },
        ]),
      },
    };

    const map = await (
      service as unknown as {
        loadStockLevelMapForVariants: (
          variantIds: string[],
          variantMap: Map<string, { productId: string }>,
          locationId: string,
          tx: unknown
        ) => Promise<Map<string, { id: string }>>;
      }
    ).loadStockLevelMapForVariants(
      ["variant-a", "variant-b"],
      variantMap,
      "loc-1",
      tx
    );

    expect(tx.stockLevel.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          {
            productId: "product-a",
            productVariantId: "variant-a",
            locationId: "loc-1",
          },
          {
            productId: "product-b",
            productVariantId: "variant-b",
            locationId: "loc-1",
          },
        ],
      },
      select: { id: true, productId: true, productVariantId: true },
    });
    expect(map.get("variant-a")?.id).toBe("sl-a");
    expect(map.get("variant-b")?.id).toBe("sl-b");
  });
});

import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/** Injected when DATABASE_URL omits connection_limit; tune via DATABASE_CONNECTION_LIMIT. */
const DEFAULT_CONNECTION_LIMIT = "15";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL || "";
    const resolvedUrl = PrismaService.buildDatabaseUrl(databaseUrl);
    PrismaService.logDatabasePoolSettings(resolvedUrl);

    super({
      log:
        process.env.NODE_ENV === "development"
          ? ["query", "info", "warn", "error"]
          : ["error"],
      datasources: {
        db: {
          url: resolvedUrl,
        },
      },
      transactionOptions: {
        maxWait: 10000,
        timeout: 30000,
      },
    });
  }

  /**
   * Ensures DATABASE_URL has connection_limit (and optional pool_timeout) for Prisma's pool.
   * Default limit 12 balances concurrent API traffic vs typical hosted Postgres caps; override
   * with DATABASE_URL query params or DATABASE_CONNECTION_LIMIT / DATABASE_POOL_TIMEOUT.
   */
  private static buildDatabaseUrl(url: string): string {
    if (!url) return url;

    try {
      const urlObj = new URL(url);

      if (!urlObj.searchParams.has("connection_limit")) {
        const defaultLimit =
          process.env.DATABASE_CONNECTION_LIMIT ?? DEFAULT_CONNECTION_LIMIT;
        urlObj.searchParams.set("connection_limit", defaultLimit);
      }

      if (
        !urlObj.searchParams.has("pool_timeout") &&
        process.env.DATABASE_POOL_TIMEOUT
      ) {
        urlObj.searchParams.set(
          "pool_timeout",
          process.env.DATABASE_POOL_TIMEOUT
        );
      }

      // Enable pgbouncer mode when using a connection pooler (e.g. Supabase pooler).
      // This disables prepared statements, which are incompatible with PgBouncer's
      // transaction-mode pooling and cause silent connection failures under load.
      if (
        !urlObj.searchParams.has("pgbouncer") &&
        urlObj.hostname.includes("pooler")
      ) {
        urlObj.searchParams.set("pgbouncer", "true");
      }

      return urlObj.toString();
    } catch (error) {
      if (process.env.NODE_ENV === "development" && error instanceof Error) {
        console.warn(
          "⚠️  Could not parse DATABASE_URL as URL, using string fallback:",
          error.message
        );
      }

      let out = url;
      if (!out.includes("connection_limit=")) {
        const defaultLimit =
          process.env.DATABASE_CONNECTION_LIMIT ?? DEFAULT_CONNECTION_LIMIT;
        const sep = out.includes("?") ? "&" : "?";
        out = `${out}${sep}connection_limit=${defaultLimit}`;
      }
      if (!out.includes("pool_timeout=") && process.env.DATABASE_POOL_TIMEOUT) {
        const sep = out.includes("?") ? "&" : "?";
        out = `${out}${sep}pool_timeout=${process.env.DATABASE_POOL_TIMEOUT}`;
      }
      if (!out.includes("pgbouncer=") && out.includes("pooler")) {
        const sep = out.includes("?") ? "&" : "?";
        out = `${out}${sep}pgbouncer=true`;
      }
      return out;
    }
  }

  private static logDatabasePoolSettings(resolvedUrl: string): void {
    if (process.env.NODE_ENV === "test" || !resolvedUrl) {
      return;
    }

    const limitMatch = /connection_limit=(\d+)/.exec(resolvedUrl);
    const poolTimeoutMatch = /pool_timeout=(\d+)/.exec(resolvedUrl);
    const limit = limitMatch ? limitMatch[1] : "unspecified";
    const poolTimeout = poolTimeoutMatch
      ? `${poolTimeoutMatch[1]}s`
      : "default";

  }

  async onModuleInit() {
    await this.$connect();
  }

  async enableShutdownHooks() {
    // Modern approach for handling shutdown
    process.on("beforeExit", async () => {
      await this.$disconnect();
    });
  }
  /**
   * Execute a soft delete by updating isDeleted to true
   */
  async softDelete(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Restore a soft deleted record
   */
  async restore(model: string, id: string) {
    return (this as any)[model].update({
      where: { id },
      data: {
        isDeleted: false,
        deletedAt: null,
      },
    });
  }

  /**
   * Find records including soft deleted ones
   */
  async findManyWithDeleted(model: string, args: any = {}) {
    return (this as any)[model].findMany({
      ...args,
      where: {
        ...args.where,
        // Don't filter by isDeleted - include all records
      },
    });
  }

  /**
   * Find only soft deleted records
   */
  async findManyDeleted(model: string, args: any = {}) {
    return (this as any)[model].findMany({
      ...args,
      where: {
        ...args.where,
        isDeleted: true,
      },
    });
  }

  /**
   * Health check for database connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find records with automatic soft delete filtering
   */
  async findManyActive(model: string, args: any = {}) {
    return (this as any)[model].findMany({
      ...args,
      where: {
        ...args.where,
        isDeleted: false,
      },
    });
  }

  /**
   * Find first active record (not soft deleted)
   */
  async findFirstActive(model: string, args: any = {}) {
    return (this as any)[model].findFirst({
      ...args,
      where: {
        ...args.where,
        isDeleted: false,
      },
    });
  }

  /**
   * Find unique active record (not soft deleted)
   */
  async findUniqueActive(model: string, args: any = {}) {
    return (this as any)[model].findUnique({
      ...args,
      where: {
        ...args.where,
        isDeleted: false,
      },
    });
  }
}

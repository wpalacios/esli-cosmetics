import { ConflictException, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";

const defaultLogger = new Logger("PrismaTransactionRetry");

function messageFromUnknown(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

/**
 * Returns true when the error is safe to retry (serialization / deadlock).
 * Mirrors the classification used in OrdersService.
 */
export function isRetryablePrismaTransactionError(
  error: unknown,
  logger: Logger = defaultLogger
): boolean {
  const errorMessage = messageFromUnknown(error);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") {
      logger.warn(
        `[TX_RETRY][CLASSIFY] Retryable Prisma error. code=${error.code}, message="${errorMessage}"`
      );
      return true;
    }

    if (error.code === "P2010") {
      const meta = (error.meta ?? {}) as {
        code?: string;
        sqlState?: string;
        message?: string;
      };

      const dbCode = String(meta.code ?? meta.sqlState ?? "");
      const dbMsg = String(meta.message ?? "").toLowerCase();

      const retryable =
        dbCode === "40001" ||
        dbCode === "40P01" ||
        dbMsg.includes("could not serialize access") ||
        dbMsg.includes("deadlock");

      logger.warn(
        `[TX_RETRY][CLASSIFY] Prisma raw DB error. prismaCode=${error.code}, dbCode=${dbCode || "N/A"}, retryable=${retryable}, message="${errorMessage}"`
      );

      return retryable;
    }

    logger.warn(
      `[TX_RETRY][CLASSIFY] Non-retryable Prisma error. code=${error.code}, message="${errorMessage}"`
    );
    return false;
  }

  const msg = errorMessage.toLowerCase();
  const retryable =
    msg.includes("40001") ||
    msg.includes("40P01") ||
    msg.includes("could not serialize access") ||
    msg.includes("write conflict") ||
    msg.includes("deadlock");

  logger.warn(
    `[TX_RETRY][CLASSIFY] Non-Prisma error. retryable=${retryable}, message="${errorMessage}"`
  );

  return retryable;
}

/**
 * Runs an interactive transaction factory with retries for concurrency errors.
 */
export async function runWithPrismaTransactionRetry<T>(
  operation: () => Promise<T>,
  options?: { maxRetries?: number; logger?: Logger }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const logger = options?.logger ?? defaultLogger;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = messageFromUnknown(error);
      const retryable = isRetryablePrismaTransactionError(error, logger);

      logger.warn(
        `[TX_RETRY] Attempt ${attempt + 1}/${maxRetries + 1}. retryable=${retryable}. message="${errorMessage}"`
      );

      if (!retryable) throw error;

      if (attempt === maxRetries) {
        throw new ConflictException(
          "The operation could not be completed because related data is being updated concurrently. Multiple retry attempts were made. Please try again."
        );
      }

      const backoffMs =
        Math.min(1200, 80 * 2 ** attempt) + Math.floor(Math.random() * 120);

      logger.warn(
        `[TX_RETRY] Retry ${attempt + 1}/${maxRetries} in ${backoffMs}ms`
      );

      await new Promise(resolve => setTimeout(resolve, backoffMs));
    }
  }

  throw new ConflictException("Transaction retry failed unexpectedly.");
}
